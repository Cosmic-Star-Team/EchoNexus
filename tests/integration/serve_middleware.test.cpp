#include <catch2/catch_test_macros.hpp>

#include <common/beast_test_server.hpp>
#include <integration/serve_test_app.hpp>

TEST_CASE(
    "integration serve app exposes logger client IP context to handlers"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(
        echo::tests::common::http::verb::get,
        "/meta/client-ip",
        "",
        {{"X-Forwarded-For", "203.0.113.7, 198.51.100.1"}}
    );

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == "203.0.113.7");
}
