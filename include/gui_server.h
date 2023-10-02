#pragma once

#include "server.h"
#include "core_listener.h"
#include "solver_listener.h"
#include "executor_listener.h"

namespace ratio::gui
{
  class gui_server : public network::server, public riddle::core_listener, public ratio::solver_listener, public ratio::executor::executor_listener
  {
  public:
    gui_server(ratio::executor::executor &exec, const std::string &address = "0.0.0.0", unsigned short port = 8080);

  private:
    void on_ws_open(network::websocket_session &ws);
    void on_ws_message(network::websocket_session &ws, const std::string &msg);
    void on_ws_error(network::websocket_session &ws, const boost::system::error_code &ec);
    void on_ws_close(network::websocket_session &ws);

  private:
    void log(const std::string &msg) override;

    void state_changed() override;

    void started_solving() override;
    void solution_found() override;
    void inconsistent_problem() override;

    void flaw_created(const ratio::flaw &f) override;
    void flaw_state_changed(const ratio::flaw &f) override;
    void flaw_cost_changed(const ratio::flaw &f) override;
    void flaw_position_changed(const ratio::flaw &f) override;
    void current_flaw(const ratio::flaw &f) override;

    void resolver_created(const ratio::resolver &r) override;
    void resolver_state_changed(const ratio::resolver &r) override;
    void current_resolver(const ratio::resolver &r) override;

    void causal_link_added(const ratio::flaw &f, const ratio::resolver &r) override;

    void executor_state_changed(ratio::executor::executor_state state) override;
    void tick(const utils::rational &time) override;
    void starting(const std::unordered_set<ratio::atom *> &atoms) override;
    void start(const std::unordered_set<ratio::atom *> &atoms) override;
    void ending(const std::unordered_set<ratio::atom *> &atoms) override;
    void end(const std::unordered_set<ratio::atom *> &atoms) override;

    void broadcast(const std::string &&msg);

  private:
    std::unordered_set<const ratio::flaw *> flaws;
    const ratio::flaw *c_flaw = nullptr;
    std::unordered_set<const ratio::resolver *> resolvers;
    const ratio::resolver *c_resolver = nullptr;
    utils::rational current_time;
    std::unordered_set<network::websocket_session *> sessions;
    std::unordered_set<ratio::atom *> executing;
    std::mutex mtx;
  };
} // namespace gui
