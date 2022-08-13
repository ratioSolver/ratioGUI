#include "cr_timeline_extractor.h"
#include "gui_server.h"
#include "consumable_resource.h"

namespace ratio::gui
{
    cr_timeline_extractor::cr_timeline_extractor(gui_server &gs) : timeline_extractor(gs, gs.get_solver().get_type(CONSUMABLE_RESOURCE_NAME)) {}

    std::vector<crow::json::wvalue> cr_timeline_extractor::extract_timelines() const noexcept
    {
        std::vector<crow::json::wvalue> tls;
        // we partition atoms for each consumable-resource they might insist on..
        std::unordered_map<ratio::core::item *, std::vector<ratio::core::atom *>> cr_instances;
        for (auto &cr_instance : tp.get_instances())
            cr_instances[&*cr_instance];
        for (const auto &atm : static_cast<const ratio::solver::consumable_resource &>(tp).get_atoms())
            if (gs.get_solver().get_sat_core()->value(get_sigma(gs.get_solver(), *atm)) == semitone::True) // we filter out those which are not strictly active..
            {
                const auto c_scope = atm->get(TAU_KW);
                if (const auto enum_scope = dynamic_cast<ratio::core::enum_item *>(&*c_scope))
                    for (const auto &val : gs.get_solver().get_ov_theory().value(enum_scope->get_var()))
                        cr_instances.at(static_cast<ratio::core::item *>(val)).emplace_back(atm);
                else
                    cr_instances.at(static_cast<ratio::core::item *>(&*c_scope)).emplace_back(atm);
            }

        for (const auto &[cr, atms] : cr_instances)
        {
            crow::json::wvalue tl;
            tl["id"] = get_id(*cr);
#ifdef COMPUTE_NAMES
            tl["name"] = gs.get_solver().guess_name(*cr);
#endif
            tl["type"] = CONSUMABLE_RESOURCE_NAME;

            const auto c_initial_amount = gs.get_solver().ratio::core::core::arith_value(static_cast<ratio::core::complex_item *>(cr)->get(CONSUMABLE_RESOURCE_INITIAL_AMOUNT));
            tl["initial_amount"] = to_json(c_initial_amount);

            const auto c_capacity = gs.get_solver().ratio::core::core::arith_value(static_cast<ratio::core::complex_item *>(cr)->get(CONSUMABLE_RESOURCE_CAPACITY));
            tl["capacity"] = to_json(c_capacity);

            // for each pulse, the atoms starting at that pulse..
            std::map<semitone::inf_rational, std::set<ratio::core::atom *>> starting_atoms;
            // for each pulse, the atoms ending at that pulse..
            std::map<semitone::inf_rational, std::set<ratio::core::atom *>> ending_atoms;
            // all the pulses of the timeline..
            std::set<semitone::inf_rational> pulses;

            for (const auto &atm : atms)
            {
                const auto start = gs.get_solver().ratio::core::core::arith_value(atm->get(RATIO_START));
                const auto end = gs.get_solver().ratio::core::core::arith_value(atm->get(RATIO_END));
                starting_atoms[start].insert(atm);
                ending_atoms[end].insert(atm);
                pulses.insert(start);
                pulses.insert(end);
            }
            pulses.insert(gs.get_solver().ratio::core::core::arith_value(gs.get_solver().ratio::core::env::get("origin")));
            pulses.insert(gs.get_solver().ratio::core::core::arith_value(gs.get_solver().ratio::core::env::get("horizon")));

            std::set<ratio::core::atom *> overlapping_atoms;
            std::set<semitone::inf_rational>::iterator p = pulses.begin();
            if (const auto at_start_p = starting_atoms.find(*p); at_start_p != starting_atoms.cend())
                overlapping_atoms.insert(at_start_p->second.cbegin(), at_start_p->second.cend());
            if (const auto at_end_p = ending_atoms.find(*p); at_end_p != ending_atoms.cend())
                for (const auto &a : at_end_p->second)
                    overlapping_atoms.erase(a);

            std::vector<crow::json::wvalue> j_vals;
            semitone::inf_rational c_val = c_initial_amount;
            for (p = std::next(p); p != pulses.end(); ++p)
            {
                crow::json::wvalue j_val;
                j_val["from"] = to_json(*std::prev(p));
                j_val["to"] = to_json(*p);

                std::vector<uintptr_t> j_atms;
                semitone::inf_rational c_angular_coefficient; // the concurrent resource update..
                for (const auto &atm : overlapping_atoms)
                {
                    auto c_coeff = static_cast<const ratio::solver::consumable_resource &>(tp).get_produce_predicate().is_assignable_from(atm->get_type()) ? gs.get_solver().ratio::core::core::arith_value(atm->get(CONSUMABLE_RESOURCE_USE_AMOUNT_NAME)) : -gs.get_solver().ratio::core::core::arith_value(atm->get(CONSUMABLE_RESOURCE_USE_AMOUNT_NAME));
                    c_coeff /= (gs.get_solver().ratio::core::core::arith_value(atm->get(RATIO_END)) - gs.get_solver().ratio::core::core::arith_value(atm->get(RATIO_START))).get_rational();
                    c_angular_coefficient += c_coeff;
                }
                j_val["atoms"] = std::move(j_atms);
                j_val["start"] = to_json(c_val);
                c_val += (c_angular_coefficient *= (*p - *std::prev(p)).get_rational());
                j_val["start"] = to_json(c_val);

                j_vals.emplace_back(std::move(j_val));

                if (const auto at_start_p = starting_atoms.find(*p); at_start_p != starting_atoms.cend())
                    overlapping_atoms.insert(at_start_p->second.cbegin(), at_start_p->second.cend());
                if (const auto at_end_p = ending_atoms.find(*p); at_end_p != ending_atoms.cend())
                    for (const auto &a : at_end_p->second)
                        overlapping_atoms.erase(a);
            }
            tl["values"] = std::move(j_vals);

            tls.emplace_back(std::move(tl));
        }

        return tls;
    }
} // namespace ratio::gui
