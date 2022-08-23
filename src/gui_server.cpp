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

                json::json j_sc;
                j_sc["type"] = "state_changed";
                j_sc["state"] = to_json(exec.get_solver());
                j_sc["timelines"] = to_timelines(exec.get_solver());
                json::array j_executing;
                for (const auto &atm : executing)
                    j_executing.push_back(get_id(*atm));
                j_sc["executing"] = std::move(j_executing);
                j_sc["time"] = to_json(current_time);
                conn.send_text(j_sc.dump());

                json::json j_gr;
                j_gr["type"] = "graph";
                json::array j_flaws;
                for (const auto &f : flaws)
                    j_flaws.push_back(to_json(*f));
                j_gr["flaws"] = std::move(j_flaws);
                if (c_flaw)
                    j_gr["current_flaw"] = get_id(*c_flaw);
                json::array j_resolvers;
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

        json::json j_sc;
        j_sc["type"] = "state_changed";
        j_sc["state"] = to_json(exec.get_solver());
        j_sc["timelines"] = to_timelines(exec.get_solver());
        json::array j_executing;
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sc["executing"] = std::move(j_executing);
        j_sc["time"] = to_json(current_time);

        broadcast(j_sc.dump());
    }

    void gui_server::started_solving()
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_ss;
        j_ss["type"] = "started_solving";

        broadcast(j_ss.dump());
    }
    void gui_server::solution_found()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        json::json j_sf;
        j_sf["type"] = "solution_found";
        j_sf["state"] = to_json(exec.get_solver());
        j_sf["timelines"] = to_timelines(exec.get_solver());
        json::array j_executing;
        for (const auto &atm : executing)
            j_executing.push_back(get_id(*atm));
        j_sf["executing"] = std::move(j_executing);
        j_sf["time"] = to_json(current_time);

        broadcast(j_sf.dump());
    }
    void gui_server::inconsistent_problem()
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = nullptr;
        c_resolver = nullptr;

        json::json j_ip;
        j_ip["type"] = "inconsistent_problem";

        broadcast(j_ip.dump());
    }

    void gui_server::flaw_created(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        flaws.insert(&f);

        json::json j_fc;
        j_fc["type"] = "flaw_created";

        broadcast(j_fc.dump());
    }
    void gui_server::flaw_state_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fsc;
        j_fsc["type"] = "flaw_state_changed";
        j_fsc["id"] = get_id(f);
        j_fsc["state"] = slv.get_sat_core()->value(f.get_phi());

        broadcast(j_fsc.dump());
    }
    void gui_server::flaw_cost_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fcc;
        j_fcc["type"] = "flaw_cost_changed";
        j_fcc["id"] = get_id(f);
        j_fcc["cost"] = to_json(f.get_estimated_cost());

        broadcast(j_fcc.dump());
    }
    void gui_server::flaw_position_changed(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_fpc;
        j_fpc["type"] = "flaw_position_changed";
        j_fpc["id"] = get_id(f);
        auto [lb, ub] = f.get_solver().get_idl_theory().bounds(f.get_position());
        json::json j_pos;
        if (lb > std::numeric_limits<semitone::I>::min())
            j_pos["lb"] = lb;
        if (ub > std::numeric_limits<semitone::I>::max())
            j_pos["ub"] = ub;
        j_fpc["pos"] = std::move(j_pos);

        broadcast(j_fpc.dump());
    }
    void gui_server::current_flaw(const ratio::solver::flaw &f)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_flaw = &f;
        c_resolver = nullptr;

        json::json j_cf;
        j_cf["type"] = "current_flaw";
        j_cf["id"] = get_id(f);

        broadcast(j_cf.dump());
    }

    void gui_server::resolver_created(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        resolvers.insert(&r);

        json::json j_rc;
        j_rc["type"] = "resolver_created";

        broadcast(j_rc.dump());
    }
    void gui_server::resolver_state_changed(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_rsc;
        j_rsc["type"] = "resolver_state_changed";
        j_rsc["id"] = get_id(r);
        j_rsc["state"] = slv.get_sat_core()->value(r.get_rho());

        broadcast(j_rsc.dump());
    }
    void gui_server::current_resolver(const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);
        c_resolver = &r;

        json::json j_cr;
        j_cr["type"] = "current_resolver";
        j_cr["id"] = get_id(r);

        broadcast(j_cr.dump());
    }

    void gui_server::causal_link_added(const ratio::solver::flaw &f, const ratio::solver::resolver &r)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_cla;
        j_cla["type"] = "current_resolver";
        j_cla["flaw_id"] = get_id(f);
        j_cla["resolver_id"] = get_id(r);

        broadcast(j_cla.dump());
    }

    void gui_server::tick(const semitone::rational &time)
    {
        std::lock_guard<std::mutex> _(mtx);
        current_time = time;

        json::json j_t;
        j_t["type"] = "tick";
        j_t["time"] = to_json(time);

        broadcast(j_t.dump());
    }
    void gui_server::starting(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_st;
        j_st["type"] = "starting";
        json::array starting;
        for (const auto &a : atoms)
            starting.push_back(get_id(*a));
        j_st["starting"] = std::move(starting);

        broadcast(j_st.dump());
    }
    void gui_server::start(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        executing.insert(atoms.cbegin(), atoms.cend());

        json::json j_st;
        j_st["type"] = "start";
        json::array start;
        for (const auto &a : atoms)
            start.push_back(get_id(*a));
        j_st["start"] = std::move(start);

        broadcast(j_st.dump());
    }
    void gui_server::ending(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);

        json::json j_en;
        j_en["type"] = "ending";
        json::array ending;
        for (const auto &a : atoms)
            ending.push_back(get_id(*a));
        j_en["ending"] = std::move(ending);

        broadcast(j_en.dump());
    }
    void gui_server::end(const std::unordered_set<ratio::core::atom *> &atoms)
    {
        std::lock_guard<std::mutex> _(mtx);
        for (const auto &a : atoms)
            executing.erase(a);

        json::json j_en;
        j_en["type"] = "end";
        json::array end;
        for (const auto &a : atoms)
            end.push_back(get_id(*a));
        j_en["end"] = std::move(end);

        broadcast(j_en.dump());
    }

    void gui_server::broadcast(const std::string &msg)
    {
        for (const auto &u : users)
            u->send_text(msg);
    }
} // namespace ratio::gui
