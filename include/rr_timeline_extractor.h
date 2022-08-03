#pragma once
#include "timeline_extractor.h"

namespace ratio::gui
{
  class rr_timeline_extractor final : public timeline_extractor
  {
  public:
    rr_timeline_extractor(gui_server &gs);

    std::vector<crow::json::wvalue> extract_timelines() const noexcept;
  };
} // namespace ratio::gui
