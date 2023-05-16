#pragma once

#include "server.h"

namespace ratio::gui
{
  class gui_server : public network::server
  {
  public:
    gui_server(const std::string &address = "0.0.0.0", unsigned short port = 8080);

  private:
  };
} // namespace gui
