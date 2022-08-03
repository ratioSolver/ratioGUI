#include "sv_timeline_extractor.h"
#include "gui_server.h"
#include "state_variable.h"

namespace ratio::gui
{
    sv_timeline_extractor::sv_timeline_extractor(gui_server &gs) : timeline_extractor(gs, gs.get_solver().get_type(STATE_VARIABLE_NAME)) {}

    std::vector<crow::json::wvalue> sv_timeline_extractor::extract_timelines() const noexcept
    {
        std::vector<crow::json::wvalue> tls;
        // we partition atoms for each state-variable they might insist on..
        std::unordered_map<const ratio::core::item *, std::vector<ratio::core::atom *>> sv_instances;
        for (const auto &atm : static_cast<const ratio::solver::state_variable &>(tp).get_atoms())
            if (gs.get_solver().get_sat_core()->value(get_sigma(gs.get_solver(), *atm)) == semitone::True) // we filter out those which are not strictly active..
            {
                const auto c_scope = atm->get(TAU_KW);
                if (auto enum_scope = dynamic_cast<ratio::core::enum_item *>(&*c_scope))
                    for (const auto &val : gs.get_solver().get_ov_theory().value(enum_scope->get_var()))
                        sv_instances[static_cast<const ratio::core::item *>(val)].emplace_back(atm);
                else
                    sv_instances[static_cast<ratio::core::item *>(&*c_scope)].emplace_back(atm);
            }

        for (const auto &[sv, atms] : sv_instances)
        {
            crow::json::wvalue tl;
            tl["id"] = get_id(*sv);
#ifdef COMPUTE_NAMES
            tl["name"] = gs.get_solver().guess_name(*sv);
#endif
            tl["type"] = STATE_VARIABLE_NAME;

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
            const auto origin_expr = gs.get_solver().ratio::core::core::get("origin");
            const auto horizon_expr = gs.get_solver().ratio::core::core::get("horizon");
            pulses.insert(gs.get_solver().ratio::core::core::arith_value(origin_expr));
            pulses.insert(gs.get_solver().ratio::core::core::arith_value(horizon_expr));

            std::set<ratio::core::atom *> overlapping_atoms;
            std::set<semitone::inf_rational>::iterator p = pulses.begin();
            if (const auto at_start_p = starting_atoms.find(*p); at_start_p != starting_atoms.cend())
                overlapping_atoms.insert(at_start_p->second.cbegin(), at_start_p->second.cend());
            if (const auto at_end_p = ending_atoms.find(*p); at_end_p != ending_atoms.cend())
                for (const auto &a : at_end_p->second)
                    overlapping_atoms.erase(a);

            std::vector<crow::json::wvalue> j_vals;
            for (p = std::next(p); p != pulses.end(); ++p)
            {
                crow::json::wvalue j_val;
                j_val["from"] = to_json(*std::prev(p));
                j_val["to"] = to_json(*p);

                std::vector<uintptr_t> j_atms;
                for (const auto &atm : overlapping_atoms)
                    j_atms.emplace_back(get_id(*atm));
                j_val["atoms"] = std::move(j_atms);
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
