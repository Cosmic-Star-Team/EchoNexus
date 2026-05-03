#include <catch2/catch_test_macros.hpp>

#include <common/beast_test_server.hpp>
#include <integration/serve_test_app.hpp>

TEST_CASE(
    "integration serve app applies CORS headers to simple requests"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response =
        server.request(echo::tests::common::http::verb::get, "/json", "", {{"Origin", "https://frontend.example"}});

    REQUIRE(response.result_int() == 200);
    REQUIRE(response["Access-Control-Allow-Origin"] == "https://frontend.example");
    REQUIRE(response["Access-Control-Allow-Credentials"] == "true");
    REQUIRE(response["Access-Control-Expose-Headers"] == "X-Trace-Id");
    REQUIRE(response["Vary"] == "Origin");
}

TEST_CASE(
    "integration serve app handles preflight CORS requests"
) {
    echo::tests::common::beast_test_server server(echo::tests::integration::configure_serve_test_app);

    const auto response = server.request(
        echo::tests::common::http::verb::options,
        "/body",
        "",
        {
            {"Origin", "https://frontend.example"},
            {"Access-Control-Request-Method", "POST"},
            {"Access-Control-Request-Headers", "Content-Type, X-Trace-Id"},
        }
    );

    REQUIRE(response.result_int() == 200);
    REQUIRE(response["Access-Control-Allow-Origin"] == "https://frontend.example");
    REQUIRE(response["Access-Control-Allow-Methods"] == "POST");
    REQUIRE(response["Access-Control-Allow-Headers"] == "Content-Type, X-Trace-Id");
    REQUIRE(response["Access-Control-Allow-Credentials"] == "true");
    REQUIRE(response["Access-Control-Max-Age"] == "600");
    REQUIRE(response["Vary"] == "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
}
