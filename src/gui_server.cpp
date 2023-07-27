#include "gui_server.h"

namespace ratio::gui
{
    gui_server::gui_server(ratio::executor::executor &c_exec, const std::string &address, unsigned short port) : server(address, port), core_listener(c_exec.get_solver()), solver_listener(c_exec.get_solver()), executor_listener(c_exec)
    {
        add_file_route("^/$", "client/dist/index.html");
        add_file_route("^/favicon.ico$", "client/dist");
        add_file_route("^/assets/.*$", "client/dist");
        add_ws_route("^/solver$").on_open(std::bind(&gui_server::on_ws_open, this, std::placeholders::_1)).on_message(std::bind(&gui_server::on_ws_message, this, std::placeholders::_1, std::placeholders::_2)).on_error(std::bind(&gui_server::on_ws_error, this, std::placeholders::_1, std::placeholders::_2)).on_close(std::bind(&gui_server::on_ws_close, this, std::placeholders::_1));
    }

    void gui_server::on_ws_open(network::websocket_session &ws)
    {
        std::lock_guard<std::mutex> _(mtx);
        sessions.insert(&ws);

        json::json j_ss{{"type", "solvers"}};
        json::json j_slvs(json::json_type::array);
        j_slvs.push_back({{"id", get_id(exec.get_solver())},
                          {"name", exec.get_name()},
                          {"state", ratio::executor::to_string(exec.get_state())}});
        j_ss["solvers"] = std::move(j_slvs);
        ws.send(j_ss.to_string());

        json::json j_sc = solver_state_changed_message(exec.get_solver());
        j_sc["time"] = to_json(current_time);
        json::json j_executing(json::json_type::array);
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sc["executing"] = std::move(j_executing);
        ws.send(j_sc.to_string());

        json::json j_gr{
            {"type", "graph"},
            {"solver_id", get_id(exec.get_solver())},
        };
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
        ws.send(j_gr.to_string());
    }
    void gui_server::on_ws_message(network::websocket_session &, const std::string &msg)
    {
        if (msg == "tick")
            exec.tick();
    }
    void gui_server::on_ws_error(network::websocket_session &ws, const boost::system::error_code &)
    {
        std::lock_guard<std::mutex> _(mtx);
        sessions.erase(&ws);
    }
    void gui_server::on_ws_close(network::websocket_session &)
    {
    }

    void gui_server::log(const std::string &msg)
    {
        std::lock_guard<std::mutex> _(mtx);

        broadcast(json::json{{"type", "log"}, {"msg", msg}}.to_string());
    }

    void gui_server::state_changed()
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_sc = solver_state_changed_message(exec.get_solver());
        j_sc["time"] = to_json(current_time);
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
        LOG_DEBUG("gui_server::executor_state_changed " << ratio::executor::to_string(state));
        std::lock_guard<std::mutex> _(mtx);
        broadcast(executor_state_changed_message(exec).to_string());
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

    void gui_server::broadcast(const std::string &&msg)
    {
        auto msg_ptr = utils::c_ptr<network::message>(new network::message(std::move(msg)));
        for (auto session : sessions)
            session->send(msg_ptr);
    }
} // namespace ratio::gui
