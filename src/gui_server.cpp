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

                json::json j_ss{{"type", "solvers"}};
                json::json j_slvs(json::json_type::array);
                j_slvs.push_back({{"id", get_id(exec.get_solver())},
                                  {"name", exec.get_name()},
                                  {"state", ratio::executor::to_string(exec.get_state())}});
                j_ss["solvers"] = std::move(j_slvs);
                conn.send_text(j_ss.to_string());

                json::json j_sc{{"type", "state_changed"},
                                {"solver_id", get_id(exec.get_solver())},
                                {"state", to_json(exec.get_solver())},
                                {"timelines", to_timelines(exec.get_solver())},
                                {"time", to_json(current_time)}};
                json::json j_executing(json::json_type::array);
                for (const auto &atm : executing)
                    j_executing.push_back(get_id(*atm));
                j_sc["executing"] = std::move(j_executing);
                conn.send_text(j_sc.to_string());

                json::json j_gr{{"type", "graph"},
                                {"solver_id", get_id(exec.get_solver())},};
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

        json::json j_sc{{"type", "state_changed"}, {"solver_id", get_id(exec.get_solver())}, {"state", to_json(exec.get_solver())}, {"timelines", to_timelines(exec.get_solver())}, {"time", to_json(current_time)}};
        json::json j_executing(json::json_type::array);
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sc["executing"] = std::move(j_executing);

        broadcast(j_sc.to_string());
    }

    void gui_server::started_solving()
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_ss{{"type", "started_solving"}, {"solver_id", get_id(exec.get_solver())}};

        broadcast(j_ss.to_string());
    }
    void gui_server::solution_found()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        json::json j_sf = solution_found_message(exec.get_solver());
        j_sf["time"] = to_json(current_time);
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

        broadcast(inconsistent_problem_message(exec.get_solver()).to_string());
    }

    void gui_server::flaw_created(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        flaws.insert(&f);

        broadcast(flaw_created_message(f).to_string());
    }
    void gui_server::flaw_state_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(flaw_state_changed_message(f).to_string());
    }
    void gui_server::flaw_cost_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(flaw_cost_changed_message(f).to_string());
    }
    void gui_server::flaw_position_changed(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(flaw_position_changed_message(f).to_string());
    }
    void gui_server::current_flaw(const ratio::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = &f;
        c_resolver = nullptr;

        broadcast(current_flaw_message(f).to_string());
    }

    void gui_server::resolver_created(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        resolvers.insert(&r);

        broadcast(resolver_created_message(r).to_string());
    }
    void gui_server::resolver_state_changed(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(resolver_state_changed_message(r).to_string());
    }
    void gui_server::current_resolver(const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_resolver = &r;

        broadcast(current_resolver_message(r).to_string());
    }

    void gui_server::causal_link_added(const ratio::flaw &f, const ratio::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(causal_link_added_message(f, r).to_string());
    }

    void gui_server::executor_state_changed([[maybe_unused]] ratio::executor::executor_state state)
    {
        LOG_DEBUG("gui_server::executor_state_changed" << ratio::executor::to_string(state));
        std::lock_guard<std::mutex> _(mtx);
        broadcast(ratio::executor::state_changed_message(exec).to_string());
    }

    void gui_server::tick(const utils::rational &time)
    {
        std::lock_guard<std::mutex> _(mtx);
        current_time = time;

        broadcast(ratio::executor::tick_message(exec, time).to_string());
    }
    void gui_server::starting(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(ratio::executor::starting_message(exec, atoms).to_string());
    }
    void gui_server::start(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        executing.insert(atoms.cbegin(), atoms.cend());

        broadcast(ratio::executor::start_message(exec, atoms).to_string());
    }
    void gui_server::ending(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(ratio::executor::ending_message(exec, atoms).to_string());
    }
    void gui_server::end(const std::unordered_set<ratio::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        for (const auto &a : atoms)
            executing.erase(a);

        broadcast(ratio::executor::end_message(exec, atoms).to_string());
    }

    void gui_server::broadcast(const std::string &msg)
    {
        for (const auto &u : users)
            u->send_text(msg);
    }
} // namespace ratio::gui
