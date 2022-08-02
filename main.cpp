#include "crow_all.h"

int main(int, char **)
{
    crow::SimpleApp app;

    CROW_ROUTE(app, "/")
    ([]()
     { return "Hello world"; });

    app.port(8080).multithreaded().run();
}