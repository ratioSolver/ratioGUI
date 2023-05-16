#include "gui_server.h"

namespace ratio::gui
{
    gui_server::gui_server(const std::string &address, unsigned short port) : network::server(address, port)
    {
        add_file_route("^/$", "client/dist/index.html");
        add_file_route("^/assets/.*$", "client/dist");
    }
} // namespace ratio::gui
