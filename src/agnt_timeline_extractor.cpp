#include "agnt_timeline_extractor.h"
#include "gui_server.h"
#include "agent.h"

namespace ratio::gui
{
    agnt_timeline_extractor::agnt_timeline_extractor(gui_server &gs) : timeline_extractor(gs, gs.get_solver().get_type(AGENT_NAME)) {}

    std::vector<crow::json::wvalue> agnt_timeline_extractor::extract_timelines() const noexcept
    {
        std::vector<crow::json::wvalue> tls;
        // we partition atoms for each agent they might insist on..
        std::unordered_map<const ratio::core::item *, std::vector<ratio::core::atom *>> agnt_instances;
        for (auto &agnt_instance : tp.get_instances())
            agnt_instances[&*agnt_instance];
        for (const auto &atm : static_cast<const ratio::solver::agent &>(tp).get_atoms())
            if (gs.get_solver().get_sat_core()->value(get_sigma(gs.get_solver(), *atm)) == semitone::True) // we filter out those which are not strictly active..
            {
                const auto c_scope = atm->get(TAU_KW);
                if (const auto enum_scope = dynamic_cast<ratio::core::enum_item *>(&*c_scope))
                    for (const auto &val : gs.get_solver().get_ov_theory().value(enum_scope->get_var()))
                        agnt_instances.at(static_cast<const ratio::core::item *>(val)).emplace_back(atm);
                else
                    agnt_instances.at(static_cast<ratio::core::item *>(&*c_scope)).emplace_back(atm);
            }

        for (const auto &[agnt, atms] : agnt_instances)
        {
            crow::json::wvalue tl;
            tl["id"] = get_id(*agnt);
#ifdef COMPUTE_NAMES
            tl["name"] = gs.get_solver().guess_name(*agnt);
#endif
            tl["type"] = AGENT_NAME;

            // for each pulse, the atoms starting at that pulse..
            std::map<semitone::inf_rational, std::set<ratio::core::atom *>> starting_atoms;
            // for each pulse, the atoms ending at that pulse..
            std::map<semitone::inf_rational, std::set<ratio::core::atom *>> ending_atoms;
            // all the pulses of the timeline..
            std::set<semitone::inf_rational> pulses;

            for (const auto &atm : atms)
            {
                const auto start = gs.get_solver().ratio::core::core::arith_value(gs.get_solver().is_impulse(*atm) ? atm->get(RATIO_AT) : atm->get(RATIO_START));
                starting_atoms[start].insert(atm);
                pulses.insert(start);
            }

            std::vector<uintptr_t> j_atms;
            for (const auto &p : pulses)
                for (const auto &atm : starting_atoms.at(p))
                    j_atms.emplace_back(get_id(*atm));
            tl["values"] = std::move(j_atms);

            tls.emplace_back(std::move(tl));
        }

        return tls;
    }
} // namespace ratio::gui
