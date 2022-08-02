#pragma once

#include "core_listener.h"
#include "solver_listener.h"
#include "executor_listener.h"
#include "crow_all.h"
#include <mutex>

namespace ratio::gui
{

  class gui_server : public ratio::core::core_listener, public ratio::solver::solver_listener, public ratio::executor::executor_listener
  {
  public:
    gui_server(ratio::executor::executor &exec, const std::string &host = "127.0.0.1", const unsigned short port = 8080);
    ~gui_server();

    ratio::solver::solver &get_solver() { return slv; }
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
    void flaw_created(const ratio::solver::flaw &f) override;
    void flaw_state_changed(const ratio::solver::flaw &f) override;
    void flaw_cost_changed(const ratio::solver::flaw &f) override;
    void flaw_position_changed(const ratio::solver::flaw &f) override;
    void current_flaw(const ratio::solver::flaw &f) override;

    void resolver_created(const ratio::solver::resolver &r) override;
    void resolver_state_changed(const ratio::solver::resolver &r) override;
    void current_resolver(const ratio::solver::resolver &r) override;

    void causal_link_added(const ratio::solver::flaw &f, const ratio::solver::resolver &r) override;

  private:
    void tick(const semitone::rational &time) override;
    void starting(const std::unordered_set<ratio::core::atom *> &atoms) override;
    void start(const std::unordered_set<ratio::core::atom *> &atoms) override;
    void ending(const std::unordered_set<ratio::core::atom *> &atoms) override;
    void end(const std::unordered_set<ratio::core::atom *> &atoms) override;

  private:
    void broadcast(const std::string &msg);

    crow::json::wvalue extract_state() const noexcept;
    crow::json::wvalue extract_timelines() const noexcept;

    crow::json::wvalue to_json(const ratio::core::item &itm) const noexcept;
    crow::json::wvalue to_json(const std::map<std::string, ratio::core::expr> &vars) const noexcept;
    crow::json::wvalue value(const ratio::core::expr &var) const noexcept;

    crow::json::wvalue to_json(const ratio::solver::flaw &f) const noexcept;
    crow::json::wvalue to_json(const ratio::solver::resolver &r) const noexcept;

    static crow::json::wvalue to_json(const semitone::rational &rat);
    static crow::json::wvalue to_json(const semitone::inf_rational &inf);
    static crow::json::wvalue to_json(const std::pair<semitone::I, semitone::I> &pair);

    static inline uintptr_t get_id(const ratio::core::item &itm) noexcept { return reinterpret_cast<uintptr_t>(&itm); }
    static inline uintptr_t get_id(const ratio::solver::flaw &f) noexcept { return reinterpret_cast<uintptr_t>(&f); }
    static inline uintptr_t get_id(const ratio::solver::resolver &r) noexcept { return reinterpret_cast<uintptr_t>(&r); }

  private:
    ratio::executor::executor &exec;
    std::unordered_set<const ratio::solver::flaw *> flaws;
    const ratio::solver::flaw *c_flaw = nullptr;
    std::unordered_set<const ratio::solver::resolver *> resolvers;
    const ratio::solver::resolver *c_resolver = nullptr;
    semitone::rational current_time;
    std::unordered_set<ratio::core::atom *> executing;
    const std::string host;
    const unsigned short port;
    crow::SimpleApp app;
    std::unordered_set<crow::websocket::connection *> users;
    std::mutex mtx;
  };
} // namespace ratio::gui