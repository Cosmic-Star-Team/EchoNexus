#include <catch2/catch_test_macros.hpp>

#include <common/beast_test_server.hpp>
#include <integration/serve_test_app.hpp>

TEST_CASE(
    "beast executor converts unhandled handler exceptions into a 500 response"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/explode");

    REQUIRE(response.result_int() == 500);
    REQUIRE(response.body() == "Unhandled exception: boom");
    REQUIRE(response[echo::tests::common::http::field::content_type] == "text/plain; charset=utf-8");
}
