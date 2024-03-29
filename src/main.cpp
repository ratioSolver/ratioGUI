#include "gui_server.h"
#include <thread>
#include <iostream>
#include <fstream>

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

    ratio::gui::gui_server srv(exec, LOCALHOST_ADDRESS, 8080);

    auto srv_st = std::async(std::launch::async, [&srv]()
                             { srv.network::server::start(); });

#ifndef NDEBUG
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
#endif

    try
    {
        std::cout << "parsing input files..\n";
        s.read(prob_names);

        std::cout << "solving the problem..\n";
        if (s.solve())
            std::cout << "hurray!! we have found a solution..\n";
        else
        {
            std::cout << "the problem is unsolvable..\n";
            srv.stop();
            return 1;
        }

        std::ofstream sol_file;
        sol_file.open(sol_name);
        sol_file << to_json(s).to_string();
        sol_file.close();

        exec.start_execution();
    }
    catch (const std::exception &ex)
    {
        std::cout << ex.what() << '\n';
        srv.stop();
        return 1;
    }

    return 0;
}