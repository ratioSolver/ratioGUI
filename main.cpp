#include "crow_all.h"

int main(int, char **)
{
    crow::SimpleApp app;
    app.loglevel(crow::LogLevel::Warning);

    CROW_ROUTE(app, "/")
    ([]()
     {
            crow::mustache::context ctx;
            ctx["title"] = "oRatio";
            return crow::mustache::load("index.html").render(ctx); });

    app.port(8080).multithreaded().run();
}