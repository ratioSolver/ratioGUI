#include "gui_server.h"

#define LOCALHOST_ADDRESS "127.0.0.1"

int main(int argc, char const *argv[])
{
    if (argc < 3)
    {
        std::cerr << "usage: oRatio <input-file> [<input-file> ...] <output-file>\n";
        return -1;
    }

    // the problem files..
    std::vector<std::string> prob_names;
    for (int i = 1; i < argc - 1; i++)
        prob_names.push_back(argv[i]);

    // the solution file..
    std::string sol_name = argv[argc - 1];

#ifdef NDEBUG
    if (std::ifstream(sol_name).good())
    {
        std::cout << "The solution file `" << sol_name << "` already exists! Please, specify a different solution file..";
        return -1;
    }
#endif

    std::cout << "starting oRatio GUI Server";
#ifndef NDEBUG
    std::cout << " in debug mode";
#endif
    std::cout << "..\n";

    ratio::solver s;
    ratio::executor::executor exec(s);

    ratio::gui::gui_server server(exec, LOCALHOST_ADDRESS, 8080);

    auto srv_st = std::async(std::launch::async, [&server]()
                             { server.network::server::start(); });

    return 0;
}