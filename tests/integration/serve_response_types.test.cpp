#include <catch2/catch_test_macros.hpp>

#include <common/beast_test_server.hpp>
#include <integration/serve_test_app.hpp>

TEST_CASE(
    "integration serve app returns HTML responses with the HTML content type"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/html");

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == "<h1>EchoNexus Integration</h1>");
    REQUIRE(response[echo::tests::common::http::field::content_type] == "text/html; charset=utf-8");
}

TEST_CASE(
    "integration serve app returns JSON responses with custom headers"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/json");

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == R"({"kind":"json","ok":true})");
    REQUIRE(response[echo::tests::common::http::field::content_type] == "application/json; charset=utf-8");
    REQUIRE(response["X-Trace-Id"] == "trace-123");
}

TEST_CASE(
    "integration serve app uses the application fallback for unknown routes"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/missing");

    REQUIRE(response.result_int() == 404);
    REQUIRE(response.body() == "No route for /missing");
}
