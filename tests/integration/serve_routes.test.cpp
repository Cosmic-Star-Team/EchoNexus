#include <catch2/catch_test_macros.hpp>

#include <common/beast_test_server.hpp>
#include <integration/serve_test_app.hpp>

TEST_CASE(
    "integration serve app handles the root static route"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/");

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == "Hello from integration");
}

TEST_CASE(
    "integration serve app exposes query parameters through request mapping"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/query?page=2&filter=active");

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == "2|active");
}

TEST_CASE(
    "integration serve app exposes request bodies to handlers"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::post, "/body", "payload");

    REQUIRE(response.result_int() == 201);
    REQUIRE(response.body() == "payload");
}

TEST_CASE(
    "integration serve app supports dynamic nested routes with route middleware context"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(echo::tests::common::http::verb::get, "/api/v1/users/42");

    REQUIRE(response.result_int() == 200);
    REQUIRE(response.body() == "{\"uid\":\"42\",\"scope\":\"users\"}");
}
