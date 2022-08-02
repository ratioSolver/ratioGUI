#include "gui_server.h"
#include "item.h"
#include "predicate.h"

namespace ratio::gui
{
    gui_server::gui_server(ratio::executor::executor &exec, const std::string &host, const unsigned short port) : core_listener(exec.get_solver()), solver_listener(exec.get_solver()), executor_listener(exec), exec(exec), host(host), port(port)
    {
        app.loglevel(crow::LogLevel::Warning);
        CROW_ROUTE(app, "/")
        ([]()
         {
            crow::mustache::context ctx;
            ctx["title"] = "oRatio";
            return crow::mustache::load("index.html").render(ctx); });

        CROW_ROUTE(app, "/solver")
            .websocket()
            .onopen([&](crow::websocket::connection &conn)
                    { std::lock_guard<std::mutex> _(mtx);
                users.insert(&conn);

                crow::json::wvalue j_sc;
                j_sc["type"] = "state_changed";
                j_sc["state"] = extract_state();
                j_sc["timelines"] = extract_timelines();
                std::vector<uintptr_t> j_executing;
                for (const auto &atm : executing)
                    j_executing.push_back(get_id(*atm));
                j_sc["executing"] = j_executing;
                j_sc["time"] = to_json(current_time);
                conn.send_text(j_sc.dump());

                crow::json::wvalue j_gr;
                j_gr["type"] = "graph";
                std::vector<crow::json::wvalue> j_flaws;
                for (const auto &f : flaws)
                    j_flaws.push_back(to_json(*f));
                j_gr["flaws"] = std::move(j_flaws);
                if (c_flaw)
                    j_gr["current_flaw"] = get_id(*c_flaw);
                std::vector<crow::json::wvalue> j_resolvers;
                for (const auto &r : resolvers)
                    j_resolvers.push_back(to_json(*r));
                j_gr["resolvers"] = std::move(j_resolvers);
                if (c_resolver)
                    j_gr["current_resolver"] = get_id(*c_resolver);
                conn.send_text(j_gr.dump()); })
            .onclose([&](crow::websocket::connection &conn, [[maybe_unused]] const std::string &reason)
                     { std::lock_guard<std::mutex> _(mtx); users.erase(&conn); })
            .onmessage([&]([[maybe_unused]] crow::websocket::connection &conn, [[maybe_unused]] const std::string &data, [[maybe_unused]] bool is_binary)
                       { if(data == "tick") exec.tick(); });
    }
    gui_server::~gui_server() {}

    void gui_server::start() { app.bindaddr(host).port(port).run(); }
    void gui_server::wait_for_server_start() { app.wait_for_server_start(); }
    void gui_server::stop() { app.stop(); }

    void gui_server::log([[maybe_unused]] const std::string &msg) { std::lock_guard<std::mutex> _(mtx); }
    void gui_server::read([[maybe_unused]] const std::string &script) { std::lock_guard<std::mutex> _(mtx); }
    void gui_server::read([[maybe_unused]] const std::vector<std::string> &files) { std::lock_guard<std::mutex> _(mtx); }

    void gui_server::state_changed()
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_sc;
        j_sc["type"] = "state_changed";
        j_sc["state"] = extract_state();
        j_sc["timelines"] = extract_timelines();
        std::vector<uintptr_t> j_executing;
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sc["executing"] = j_executing;
        j_sc["time"] = to_json(current_time);

        broadcast(j_sc.dump());
    }

    void gui_server::started_solving()
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_ss;
        j_ss["type"] = "started_solving";

        broadcast(j_ss.dump());
    }
    void gui_server::solution_found()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        crow::json::wvalue j_sf;
        j_sf["type"] = "solution_found";
        j_sf["state"] = extract_state();
        j_sf["timelines"] = extract_timelines();
        std::vector<uintptr_t> j_executing;
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sf["executing"] = j_executing;
        j_sf["time"] = to_json(current_time);

        broadcast(j_sf.dump());
    }
    void gui_server::inconsistent_problem()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        crow::json::wvalue j_ip;
        j_ip["type"] = "inconsistent_problem";

        broadcast(j_ip.dump());
    }

    void gui_server::flaw_created(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        flaws.insert(&f);

        crow::json::wvalue j_fc;
        j_fc["type"] = "flaw_created";

        broadcast(j_fc.dump());
    }
    void gui_server::flaw_state_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_fsc;
        j_fsc["type"] = "flaw_state_changed";
        j_fsc["id"] = get_id(f);
        j_fsc["state"] = slv.get_sat_core()->value(f.get_phi());

        broadcast(j_fsc.dump());
    }
    void gui_server::flaw_cost_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_fcc;
        j_fcc["type"] = "flaw_cost_changed";
        j_fcc["id"] = get_id(f);
        j_fcc["cost"] = to_json(f.get_estimated_cost());

        broadcast(j_fcc.dump());
    }
    void gui_server::flaw_position_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_fpc;
        j_fpc["type"] = "flaw_position_changed";
        j_fpc["id"] = get_id(f);
        j_fpc["pos"] = to_json(slv.get_idl_theory().bounds(f.get_position()));

        broadcast(j_fpc.dump());
    }
    void gui_server::current_flaw(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = &f;
        c_resolver = nullptr;

        crow::json::wvalue j_cf;
        j_cf["type"] = "current_flaw";
        j_cf["id"] = get_id(f);

        broadcast(j_cf.dump());
    }

    void gui_server::resolver_created(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        resolvers.insert(&r);

        crow::json::wvalue j_rc;
        j_rc["type"] = "resolver_created";

        broadcast(j_rc.dump());
    }
    void gui_server::resolver_state_changed(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_rsc;
        j_rsc["type"] = "resolver_state_changed";
        j_rsc["id"] = get_id(r);
        j_rsc["state"] = slv.get_sat_core()->value(r.get_rho());

        broadcast(j_rsc.dump());
    }
    void gui_server::current_resolver(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_resolver = &r;

        crow::json::wvalue j_cr;
        j_cr["type"] = "current_resolver";
        j_cr["id"] = get_id(r);

        broadcast(j_cr.dump());
    }

    void gui_server::causal_link_added(const ratio::solver::flaw &f, const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_cla;
        j_cla["type"] = "current_resolver";
        j_cla["flaw_id"] = get_id(f);
        j_cla["resolver_id"] = get_id(r);

        broadcast(j_cla.dump());
    }

    void gui_server::tick(const semitone::rational &time)
    {
        std::lock_guard<std::mutex> _(mtx);
        current_time = time;

        crow::json::wvalue j_t;
        j_t["type"] = "tick";
        j_t["time"] = to_json(time);

        broadcast(j_t.dump());
    }
    void gui_server::starting(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_st;
        j_st["type"] = "starting";
        std::vector<uintptr_t> starting;
        for (const auto &a : atoms)
            starting.push_back(get_id(*a));
        j_st["starting"] = starting;

        broadcast(j_st.dump());
    }
    void gui_server::start(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        executing.insert(atoms.cbegin(), atoms.cend());

        crow::json::wvalue j_st;
        j_st["type"] = "start";
        std::vector<uintptr_t> start;
        for (const auto &a : atoms)
            start.push_back(get_id(*a));
        j_st["start"] = start;

        broadcast(j_st.dump());
    }
    void gui_server::ending(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        crow::json::wvalue j_en;
        j_en["type"] = "ending";
        std::vector<uintptr_t> ending;
        for (const auto &a : atoms)
            ending.push_back(get_id(*a));
        j_en["ending"] = ending;

        broadcast(j_en.dump());
    }
    void gui_server::end(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        for (const auto &a : atoms)
            executing.erase(a);

        crow::json::wvalue j_en;
        j_en["type"] = "end";
        std::vector<uintptr_t> end;
        for (const auto &a : atoms)
            end.push_back(get_id(*a));
        j_en["end"] = end;

        broadcast(j_en.dump());
    }

    void gui_server::broadcast(const std::string &msg)
    {
        for (const auto &u : users)
            u->send_text(msg);
    }

    crow::json::wvalue gui_server::extract_state() const noexcept
    {
        std::set<ratio::core::item *> all_items;
        std::set<ratio::core::atom *> all_atoms;
        for ([[maybe_unused]] const auto &[pred_name, pred] : slv.get_predicates())
            for (const auto &a : pred->get_instances())
                all_atoms.insert(static_cast<ratio::core::atom *>(&*a));
        std::queue<ratio::core::type *> q;
        for ([[maybe_unused]] const auto &[tp_name, tp] : slv.get_types())
            if (!tp->is_primitive())
                q.push(tp.get());
        while (!q.empty())
        {
            for (const auto &i : q.front()->get_instances())
                all_items.insert(&*i);
            for ([[maybe_unused]] const auto &[pred_name, pred] : q.front()->get_predicates())
                for (const auto &a : pred->get_instances())
                    all_atoms.insert(static_cast<ratio::core::atom *>(&*a));
            for ([[maybe_unused]] const auto &[tp_name, tp] : q.front()->get_types())
                q.push(tp.get());
            q.pop();
        }

        crow::json::wvalue j_core;

        if (!all_items.empty())
        {
            std::vector<crow::json::wvalue> j_itms;
            for (const auto &itm : all_items)
                j_itms.push_back(to_json(*itm));
            j_core["items"] = std::move(j_itms);
        }

        if (!all_atoms.empty())
        {
            std::vector<crow::json::wvalue> j_atms;
            for (const auto &atm : all_atoms)
                j_atms.push_back(to_json(*atm));
            j_core["atoms"] = std::move(j_atms);
        }

        if (!slv.get_vars().empty())
            j_core["exprs"] = to_json(slv.get_vars());
        return j_core;
    }

    crow::json::wvalue gui_server::extract_timelines() const noexcept
    {
    }

    crow::json::wvalue gui_server::to_json(const ratio::core::item &itm) const noexcept
    {
        crow::json::wvalue j_itm;
        j_itm["id"] = get_id(itm);
        j_itm["type"] = itm.get_type().get_full_name();
#ifdef COMPUTE_NAMES
        j_itm["name"] = slv.guess_name(itm);
#endif
        if (auto ci = dynamic_cast<const ratio::core::complex_item *>(&itm))
            if (!ci->get_vars().empty())
                j_itm["exprs"] = to_json(ci->get_vars());
        return j_itm;
    }

    crow::json::wvalue gui_server::to_json(const std::map<std::string, ratio::core::expr> &vars) const noexcept
    {
        std::vector<crow::json::wvalue> j_exprs;
        for (const auto &[xpr_name, xpr] : vars)
        {
            crow::json::wvalue j_var;
            j_var["name"] = xpr_name;
            j_var["type"] = xpr->get_type().get_full_name();
            j_var["value"] = value(xpr);
            j_exprs.push_back(j_var);
        }
        return j_exprs;
    }
    crow::json::wvalue gui_server::value(const ratio::core::expr &var) const noexcept
    {
        if (&var->get_type() == &slv.get_bool_type())
        {
            crow::json::wvalue j_val;
            const auto val = static_cast<ratio::core::bool_item &>(*var).get_value();
            j_val["lit"] = (sign(val) ? "b" : "!b") + std::to_string(variable(val));
            switch (slv.get_sat_core()->value(val))
            {
            case semitone::True:
                j_val["val"] = "True";
                break;
            case semitone::False:
                j_val["val"] = "False";
                break;
            case semitone::Undefined:
                j_val["val"] = "Undefined";
                break;
            }
            return j_val;
        }
        else if (&var->get_type() == &slv.get_real_type())
        {
            crow::json::wvalue j_val;
            const auto val = static_cast<ratio::core::arith_item &>(*var).get_value();
            const auto [lb, ub] = slv.get_lra_theory().bounds(val);

            j_val["lin"] = to_string(val);
            if (!is_negative_infinite(lb))
                j_val["lb"] = to_json(lb);
            if (!is_positive_infinite(ub))
                j_val["ub"] = to_json(ub);
            return j_val;
        }
        else if (&var->get_type() == &slv.get_time_type())
        {
            crow::json::wvalue j_val;
            const auto val = static_cast<ratio::core::arith_item &>(*var).get_value();
            const auto [lb, ub] = slv.get_rdl_theory().bounds(val);

            j_val["lin"] = to_string(val);
            if (!is_negative_infinite(lb))
                j_val["lb"] = to_json(lb);
            if (!is_positive_infinite(ub))
                j_val["ub"] = to_json(ub);
            return j_val;
        }
        else if (&var->get_type() == &slv.get_string_type())
            return static_cast<ratio::core::string_item &>(*var).get_value();
        else if (auto ev = dynamic_cast<ratio::core::enum_item *>(var.get()))
        {
            crow::json::wvalue j_val;
            j_val["var"] = std::to_string(ev->get_var());
            std::vector<uintptr_t> vals;
            for (const auto &v : slv.get_ov_theory().value(ev->get_var()))
                vals.push_back(get_id(static_cast<ratio::core::item &>(*v)));
            j_val["vals"] = vals;
            return j_val;
        }
        else
            return get_id(*var);
    }

    crow::json::wvalue gui_server::to_json(const ratio::solver::flaw &f) const noexcept
    {
        crow::json::wvalue j_f;
        j_f["id"] = get_id(f);
        std::vector<uintptr_t> causes;
        for (const auto &c : f.get_causes())
            causes.push_back(get_id(*c));
        j_f["causes"] = causes;
        j_f["state"] = slv.get_sat_core()->value(f.get_phi());
        j_f["cost"] = to_json(f.get_estimated_cost());
        j_f["pos"] = to_json(slv.get_idl_theory().bounds(f.get_position()));

        return j_f;
    }
    crow::json::wvalue gui_server::to_json(const ratio::solver::resolver &r) const noexcept
    {
        crow::json::wvalue j_r;
        j_r["id"] = get_id(r);
        std::vector<uintptr_t> preconditions;
        for (const auto &p : r.get_preconditions())
            preconditions.push_back(get_id(*p));
        j_r["preconditions"] = preconditions;
        j_r["effect"] = get_id(r.get_effect());
        j_r["state"] = slv.get_sat_core()->value(r.get_rho());
        j_r["intrinsic_cost"] = to_json(r.get_intrinsic_cost());

        return j_r;
    }

    crow::json::wvalue gui_server::to_json(const semitone::rational &rat) { return {{"num", rat.numerator()}, {"den", rat.denominator()}}; }
    crow::json::wvalue gui_server::to_json(const semitone::inf_rational &inf)
    {
        crow::json::wvalue j_val = to_json(inf.get_rational());
        if (inf.get_infinitesimal() != semitone::rational::ZERO)
            j_val["inf"] = to_json(inf.get_infinitesimal());
        return j_val;
    }
    crow::json::wvalue gui_server::to_json(const std::pair<semitone::I, semitone::I> &pair)
    {
        crow::json::wvalue j_p;
        if (pair.first > std::numeric_limits<semitone::I>::min())
            j_p["lb"] = pair.first;
        if (pair.second > std::numeric_limits<semitone::I>::max())
            j_p["ub"] = pair.second;
        return j_p;
    }
} // namespace ratio::gui
