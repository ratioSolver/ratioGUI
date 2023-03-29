#pragma once

#include "core_listener.h"
#include "solver_listener.h"
#include "executor_listener.h"
#include "crow_all.h"
#include <mutex>

namespace ratio::gui
{
  class timeline_extractor;

  class gui_server : public riddle::core_listener, public ratio::solver_listener, public ratio::executor::executor_listener
  {
    friend class timeline_extractor;

  public:
    gui_server(ratio::executor::executor &exec, const std::string &host = "127.0.0.1", const unsigned short port = 8080);

    ratio::solver &get_solver() { return slv; }
    ratio::executor::executor &get_executor() { return exec; }

    void start();
    void wait_for_server_start();
    void stop();

  private:
    void log(const std::string &msg) override;
    void read(const std::string &script) override;
    void read(const std::vector<std::string> &files) override;

    void state_changed() override;

    void started_solving() override;
    void solution_found() override;
    void inconsistent_problem() override;

  private:
    void flaw_created(const ratio::flaw &f) override;
    void flaw_state_changed(const ratio::flaw &f) override;
    void flaw_cost_changed(const ratio::flaw &f) override;
    void flaw_position_changed(const ratio::flaw &f) override;
    void current_flaw(const ratio::flaw &f) override;

    void resolver_created(const ratio::resolver &r) override;
    void resolver_state_changed(const ratio::resolver &r) override;
    void current_resolver(const ratio::resolver &r) override;

    void causal_link_added(const ratio::flaw &f, const ratio::resolver &r) override;

  private:
    void executor_state_changed(ratio::executor::executor_state state) override;
    void tick(const utils::rational &time) override;
    void starting(const std::unordered_set<ratio::atom *> &atoms) override;
    void start(const std::unordered_set<ratio::atom *> &atoms) override;
    void ending(const std::unordered_set<ratio::atom *> &atoms) override;
    void end(const std::unordered_set<ratio::atom *> &atoms) override;

  private:
    void broadcast(const std::string &msg);

  private:
    ratio::executor::executor &exec;
    std::unordered_set<const ratio::flaw *> flaws;
    const ratio::flaw *c_flaw = nullptr;
    std::unordered_set<const ratio::resolver *> resolvers;
    const ratio::resolver *c_resolver = nullptr;
    utils::rational current_time;
    std::unordered_set<ratio::atom *> executing;
    const std::string host;
    const unsigned short port;
    crow::SimpleApp app;
    std::unordered_set<crow::websocket::connection *> users;
    std::mutex mtx;
  };
} // namespace ratio::gui