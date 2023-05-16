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
    std::unordered_set<network::websocket_session *> sessions;
  };
} // namespace gui
