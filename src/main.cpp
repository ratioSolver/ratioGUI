#include "gui_server.h"

#define LOCALHOST_ADDRESS "127.0.0.1"

int main(int argc, char const *argv[])
{
    ratio::gui::gui_server server(LOCALHOST_ADDRESS, 8080);

    server.start();

    return 0;
}