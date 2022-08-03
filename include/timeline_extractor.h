#pragma once
#include "gui_server.h"

namespace ratio::gui
{
  class timeline_extractor
  {
  public:
    timeline_extractor(gui_server &gs, const ratio::core::type &tp) : gs(gs), tp(tp) { gs.timeline_extractors.emplace(&tp, this); }
    virtual ~timeline_extractor() { gs.timeline_extractors.erase(&tp); }

    virtual std::vector<crow::json::wvalue> extract_timelines() const noexcept = 0;

  protected:
    gui_server &gs;
    const ratio::core::type &tp;
  };
} // namespace ratio::gui
