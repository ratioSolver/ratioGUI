#include "gui_server.h"

namespace ratio::gui
{
    gui_server::gui_server(ratio::executor::executor &exec, const std::string &address, unsigned short port) : server(address, port), core_listener(exec.get_solver()), solver_listener(exec.get_solver()), executor_listener(exec)
    {
        add_file_route("^/$", "client/dist/index.html");
        add_file_route("^/favicon.ico$", "client/dist");
        add_file_route("^/assets/.*$", "client/dist");
        add_ws_route("^/solver$")
            .on_open([this](network::websocket_session &session)
                     { sessions.insert(&session); })
            .on_close([this](network::websocket_session &session)
                      { sessions.erase(&session); })
            .on_message([this](network::websocket_session &session, const std::string &message) {});
    }
} // namespace ratio::gui
