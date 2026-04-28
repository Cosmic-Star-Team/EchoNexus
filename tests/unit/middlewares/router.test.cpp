#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <optional>
#include <string>

#include <common/test_support.hpp>
#include <middlewares/router.hpp>

namespace {
    auto text_route(
        std::string body,
        unsigned int status = 200
    ) -> echo::handler_t {
        return [body = std::move(body), status](std::shared_ptr<echo::type::request>, std::optional<echo::next_fn_t>)
                   -> echo::awaitable<echo::type::response> { co_return echo::type::response::text(body, status); };
    }
} // namespace

TEST_CASE(
    "router dispatches a matching literal route"
) {
    echo::middlewares::router router;
    router.get("/health", text_route("ok"));

    const auto ok = echo::tests::common::run_awaitable(
        router.handle(echo::tests::common::make_request("GET", "/health"), std::nullopt)
    );

    REQUIRE(ok.status == 200);
    REQUIRE(ok.body == "ok");
}

TEST_CASE(
    "router applies route-local middleware to a matching endpoint"
) {
    echo::middlewares::router router;
    router.route("/health")
        .get(text_route("ok"))
        .layer(
            [](std::shared_ptr<echo::type::request> req,
               std::optional<echo::next_fn_t> next) -> echo::awaitable<echo::type::response> {
                auto response = co_await next.value()(req);
                response.set_header("X-Route-Layer", "1");
                co_return response;
            }
        );

    const auto response = echo::tests::common::run_awaitable(
        router.handle(echo::tests::common::make_request("GET", "/health"), std::nullopt)
    );

    const auto* route_layer = response.get_header("x-route-layer");
    REQUIRE(route_layer != nullptr);
    REQUIRE(*route_layer == "1");
}

TEST_CASE(
    "router returns a 405 response with an Allow header for method mismatches"
) {
    echo::middlewares::router router;
    router.get("/health", text_route("ok"));

    const auto method_mismatch = echo::tests::common::run_awaitable(
        router.handle(echo::tests::common::make_request("POST", "/health"), std::nullopt)
    );

    REQUIRE(method_mismatch.status == 405);

    const auto* allow = method_mismatch.get_header("allow");
    REQUIRE(allow != nullptr);
    REQUIRE(*allow == "GET");
}

TEST_CASE(
    "router stores dynamic route parameters in request context"
) {
    echo::middlewares::router router;
    router.get(
        "/users/{id}",
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            const auto* params = req->get_ctx<echo::type::map_t>("params");
            co_return echo::type::response::text(params == nullptr ? "missing" : params->at("id"));
        }
    );

    auto dynamic_request        = echo::tests::common::make_request("GET", "/users/42");
    const auto dynamic_response = echo::tests::common::run_awaitable(router.handle(dynamic_request, std::nullopt));

    REQUIRE(dynamic_response.status == 200);
    REQUIRE(dynamic_response.body == "42");
}

TEST_CASE(
    "router restores any dynamic params after dispatch completes"
) {
    echo::middlewares::router router;
    router.get(
        "/users/{id}",
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            const auto* params = req->get_ctx<echo::type::map_t>("params");
            co_return echo::type::response::text(params == nullptr ? "missing" : params->at("id"));
        }
    );

    auto dynamic_request        = echo::tests::common::make_request("GET", "/users/42");
    const auto dynamic_response = echo::tests::common::run_awaitable(router.handle(dynamic_request, std::nullopt));

    REQUIRE(dynamic_response.status == 200);
    REQUIRE(dynamic_request->get_ctx<echo::type::map_t>("params") == nullptr);
}

TEST_CASE(
    "router prefers a more specific literal route over a matching dynamic route"
) {
    echo::middlewares::router router;
    router.get("/users/{id}", text_route("dynamic"));
    router.get("/users/me", text_route("me"));

    const auto literal_response = echo::tests::common::run_awaitable(
        router.handle(echo::tests::common::make_request("GET", "/users/me"), std::nullopt)
    );

    REQUIRE(literal_response.status == 200);
    REQUIRE(literal_response.body == "me");
}

TEST_CASE(
    "router dispatches requests into nested child routers"
) {
    echo::middlewares::router api;
    api.get("/projects", text_route("projects"));

    echo::middlewares::router root;
    root.nest("/api", api);

    const auto nested = echo::tests::common::run_awaitable(
        root.handle(echo::tests::common::make_request("GET", "/api/projects"), std::nullopt)
    );

    REQUIRE(nested.status == 200);
    REQUIRE(nested.body == "projects");
}

TEST_CASE(
    "router uses its fallback when no route matches"
) {
    echo::middlewares::router root;
    root.fallback(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("miss:" + req->path, 404);
        }
    );

    const auto miss = echo::tests::common::run_awaitable(
        root.handle(echo::tests::common::make_request("GET", "/missing"), std::nullopt)
    );

    REQUIRE(miss.status == 404);
    REQUIRE(miss.body == "miss:/missing");
}
