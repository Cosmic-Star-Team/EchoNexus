#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <optional>
#include <stdexcept>
#include <string>

#include <common/test_support.hpp>
#include <middlewares/cors.hpp>

TEST_CASE(
    "cors rejects enabling credentials on the permissive preset"
) {
    echo::middlewares::cors permissive(echo::middlewares::cors::preset::permissive);
    REQUIRE_THROWS_AS(permissive.allow_credentials(true), std::invalid_argument);
}

TEST_CASE(
    "cors rejects a wildcard origin when credentials are already enabled"
) {
    echo::middlewares::cors wildcard_origin;
    wildcard_origin.allow_credentials(true);
    REQUIRE_THROWS_AS(wildcard_origin.allow_origin("*"), std::invalid_argument);
}

TEST_CASE(
    "cors rejects wildcard request headers when credentials are already enabled"
) {
    echo::middlewares::cors wildcard_header;
    wildcard_header.allow_credentials(true);
    REQUIRE_THROWS_AS(wildcard_header.allow_header("*"), std::invalid_argument);
}

TEST_CASE(
    "cors adds the allow-origin header for a permitted simple request"
) {
    echo::middlewares::cors cors;
    cors.allow_origin("https://example.com");

    bool next_called = false;
    const echo::next_fn_t next =
        [&next_called](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        next_called = true;

        auto response = echo::type::response::text("ok", 202);
        response.set_header("Vary", "Accept-Encoding");
        co_return response;
    };

    auto req               = echo::tests::common::make_request("GET", "/items");
    req->headers["Origin"] = "https://example.com";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    REQUIRE(next_called);

    const auto* allow_origin = response.get_header("access-control-allow-origin");
    REQUIRE(allow_origin != nullptr);
    REQUIRE(*allow_origin == "https://example.com");
}

TEST_CASE(
    "cors exposes configured response headers on a permitted simple request"
) {
    echo::middlewares::cors cors;
    cors.allow_origin("https://example.com").expose_header("X-Trace-Id");

    const echo::next_fn_t next = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("ok", 202);
    };

    auto req               = echo::tests::common::make_request("GET", "/items");
    req->headers["Origin"] = "https://example.com";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    const auto* expose_headers = response.get_header("access-control-expose-headers");
    REQUIRE(expose_headers != nullptr);
    REQUIRE(*expose_headers == "X-Trace-Id");
}

TEST_CASE(
    "cors appends Origin to an existing Vary header on a permitted simple request"
) {
    echo::middlewares::cors cors;
    cors.allow_origin("https://example.com");

    const echo::next_fn_t next = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        auto response = echo::type::response::text("ok", 202);
        response.set_header("Vary", "Accept-Encoding");
        co_return response;
    };

    auto req               = echo::tests::common::make_request("GET", "/items");
    req->headers["Origin"] = "https://example.com";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    const auto* vary = response.get_header("vary");
    REQUIRE(vary != nullptr);
    REQUIRE(*vary == "Accept-Encoding, Origin");
}

TEST_CASE(
    "cors development preset handles preflight requests without calling downstream handlers"
) {
    echo::middlewares::cors cors(echo::middlewares::cors::preset::development);
    cors.max_age(600);

    bool next_called = false;
    const echo::next_fn_t next =
        [&next_called](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        next_called = true;
        co_return echo::type::response::text("unexpected", 500);
    };

    auto req                                       = echo::tests::common::make_request("OPTIONS", "/items");
    req->headers["Origin"]                         = "https://dev.example";
    req->headers["Access-Control-Request-Method"]  = "PATCH";
    req->headers["Access-Control-Request-Headers"] = "X-Trace-Id, Content-Type";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    REQUIRE_FALSE(next_called);
    REQUIRE(response.status == 200);
}

TEST_CASE(
    "cors development preset mirrors requested method and headers on preflight requests"
) {
    echo::middlewares::cors cors(echo::middlewares::cors::preset::development);

    const echo::next_fn_t next = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("unexpected", 500);
    };

    auto req                                       = echo::tests::common::make_request("OPTIONS", "/items");
    req->headers["Origin"]                         = "https://dev.example";
    req->headers["Access-Control-Request-Method"]  = "PATCH";
    req->headers["Access-Control-Request-Headers"] = "X-Trace-Id, Content-Type";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    const auto* allow_methods = response.get_header("access-control-allow-methods");
    REQUIRE(allow_methods != nullptr);
    REQUIRE(*allow_methods == "PATCH");

    const auto* allow_headers = response.get_header("access-control-allow-headers");
    REQUIRE(allow_headers != nullptr);
    REQUIRE(*allow_headers == "X-Trace-Id, Content-Type");
}

TEST_CASE(
    "cors development preset includes credentials max-age and vary metadata on preflight requests"
) {
    echo::middlewares::cors cors(echo::middlewares::cors::preset::development);
    cors.max_age(600);

    const echo::next_fn_t next = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("unexpected", 500);
    };

    auto req                                       = echo::tests::common::make_request("OPTIONS", "/items");
    req->headers["Origin"]                         = "https://dev.example";
    req->headers["Access-Control-Request-Method"]  = "PATCH";
    req->headers["Access-Control-Request-Headers"] = "X-Trace-Id, Content-Type";

    const auto response = echo::tests::common::run_awaitable(cors.handle(req, std::optional<echo::next_fn_t>{next}));

    const auto* allow_origin = response.get_header("access-control-allow-origin");
    REQUIRE(allow_origin != nullptr);
    REQUIRE(*allow_origin == "https://dev.example");

    const auto* allow_credentials = response.get_header("access-control-allow-credentials");
    REQUIRE(allow_credentials != nullptr);
    REQUIRE(*allow_credentials == "true");

    const auto* max_age = response.get_header("access-control-max-age");
    REQUIRE(max_age != nullptr);
    REQUIRE(*max_age == "600");

    const auto* vary = response.get_header("vary");
    REQUIRE(vary != nullptr);
    REQUIRE(*vary == "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
}
