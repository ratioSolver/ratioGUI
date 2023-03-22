#include "gui_server.h"
#include "item.h"
#include "type.h"

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

                json::json j_sc{{"type", "state_changed"},
                                {"state", to_json(exec.get_solver())},
                                {"timelines", to_timelines(exec.get_solver())},
                                {"time", to_json(current_time)}};
                json::json j_executing(json::json_type::array);
                for (const auto &atm : executing)
                    j_executing.push_back(get_id(*atm));
                j_sc["executing"] = std::move(j_executing);
                conn.send_text(j_sc.to_string());

                json::json j_gr{{"type", "graph"}};
                json::json j_flaws(json::json_type::array);
                for (const auto &f : flaws)
                    j_flaws.push_back(to_json(*f));
                j_gr["flaws"] = std::move(j_flaws);
                if (c_flaw)
                    j_gr["current_flaw"] = get_id(*c_flaw);
                json::json j_resolvers(json::json_type::array);
                for (const auto &r : resolvers)
                    j_resolvers.push_back(to_json(*r));
                j_gr["resolvers"] = std::move(j_resolvers);
                if (c_resolver)
                    j_gr["current_resolver"] = get_id(*c_resolver);
                conn.send_text(j_gr.to_string()); })
            .onclose([&](crow::websocket::connection &conn, [[maybe_unused]] const std::string &reason)
                     { std::lock_guard<std::mutex> _(mtx); users.erase(&conn); })
            .onmessage([&]([[maybe_unused]] crow::websocket::connection &conn, [[maybe_unused]] const std::string &data, [[maybe_unused]] bool is_binary)
                       { if(data == "tick") exec.tick(); });
    }

    void gui_server::start() { app.bindaddr(host).port(port).run(); }
    void gui_server::wait_for_server_start() { app.wait_for_server_start(); }
    void gui_server::stop() { app.stop(); }

    void gui_server::log([[maybe_unused]] const std::string &msg) { std::lock_guard<std::mutex> _(mtx); }
    void gui_server::read([[maybe_unused]] const std::string &script) { std::lock_guard<std::mutex> _(mtx); }
    void gui_server::read([[maybe_unused]] const std::vector<std::string> &files) { std::lock_guard<std::mutex> _(mtx); }

    void gui_server::state_changed()
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_sc{{"type", "state_changed"}, {"state", to_json(exec.get_solver())}, {"timelines", to_timelines(exec.get_solver())}, {"time", to_json(current_time)}};
        json::json j_executing(json::json_type::array);
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sc["executing"] = std::move(j_executing);

        broadcast(j_sc.to_string());
    }

    void gui_server::started_solving()
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_ss{{"type", "started_solving"}};

        broadcast(j_ss.to_string());
    }
    void gui_server::solution_found()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        json::json j_sf{{"type", "solution_found"}, {"state", to_json(exec.get_solver())}, {"timelines", to_timelines(exec.get_solver())}, {"time", to_json(current_time)}};
        json::json j_executing(json::json_type::array);
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sf["executing"] = std::move(j_executing);

        broadcast(j_sf.to_string());
    }
    void gui_server::inconsistent_problem()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        json::json j_ip{{"type", "inconsistent_problem"}};

        broadcast(j_ip.to_string());
    }

    void gui_server::flaw_created(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        flaws.insert(&f);

        json::json j_fc = to_json(f);
        j_fc["type"] = "flaw_created";

        broadcast(j_fc.to_string());
    }
    void gui_server::flaw_state_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fsc{{"type", "flaw_state_changed"}, {"id", get_id(f)}, {"state", exec.get_solver().get_sat_core().value(f.get_phi())}};

        broadcast(j_fsc.to_string());
    }
    void gui_server::flaw_cost_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fcc{{"type", "flaw_cost_changed"}, {"id", get_id(f)}, {"cost", to_json(f.get_estimated_cost())}};

        broadcast(j_fcc.to_string());
    }
    void gui_server::flaw_position_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fpc{{"type", "flaw_position_changed"}, {"id", get_id(f)}, {"pos", to_json(f.get_solver().get_idl_theory().bounds(f.get_position()))}};

        broadcast(j_fpc.to_string());
    }
    void gui_server::current_flaw(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = &f;
        c_resolver = nullptr;

        json::json j_cf{{"type", "current_flaw"}, {"id", get_id(f)}};

        broadcast(j_cf.to_string());
    }

    void gui_server::resolver_created(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        resolvers.insert(&r);

        json::json j_rc = to_json(r);
        j_rc["type"] = "resolver_created";

        broadcast(j_rc.to_string());
    }
    void gui_server::resolver_state_changed(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_rsc{{"type", "resolver_state_changed"}, {"id", get_id(r)}, {"state", exec.get_solver().get_sat_core().value(r.get_rho())}};

        broadcast(j_rsc.to_string());
    }
    void gui_server::current_resolver(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_resolver = &r;

        json::json j_cr{{"type", "current_resolver"}, {"id", get_id(r)}};

        broadcast(j_cr.to_string());
    }

    void gui_server::causal_link_added(const ratio::flaw &f, const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_cla{{"type", "causal_link_added"}, {"flaw_id", get_id(f)}, {"resolver_id", get_id(r)}};

        broadcast(j_cla.to_string());
    }

    void gui_server::tick(const utils::rational &time)
    {
        std::lock_guard<std::mutex> _(mtx);
        current_time = time;

        json::json j_t{{"type", "tick"}, {"time", to_json(time)}};

        broadcast(j_t.to_string());
    }
    void gui_server::starting(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_st{{"type", "starting"}};
        json::json starting(json::json_type::array);
        for (const auto &a : atoms)
            starting.push_back(get_id(*a));
        j_st["starting"] = std::move(starting);

        broadcast(j_st.to_string());
    }
    void gui_server::start(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        executing.insert(atoms.cbegin(), atoms.cend());

        json::json j_st{{"type", "start"}};
        json::json start(json::json_type::array);
        for (const auto &a : atoms)
            start.push_back(get_id(*a));
        j_st["start"] = std::move(start);

        broadcast(j_st.to_string());
    }
    void gui_server::ending(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_en{{"type", "ending"}};
        json::json ending(json::json_type::array);
        for (const auto &a : atoms)
            ending.push_back(get_id(*a));
        j_en["ending"] = std::move(ending);

        broadcast(j_en.to_string());
    }
    void gui_server::end(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        for (const auto &a : atoms)
            executing.erase(a);

        json::json j_en{{"type", "end"}};
        json::json end(json::json_type::array);
        for (const auto &a : atoms)
            end.push_back(get_id(*a));
        j_en["end"] = std::move(end);

        broadcast(j_en.to_string());
    }

    void gui_server::broadcast(const std::string &msg)
    {
        for (const auto &u : users)
            u->send_text(msg);
    }
} // namespace ratio::gui
