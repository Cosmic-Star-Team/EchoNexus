#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <optional>
#include <stdexcept>
#include <string>

#include <common/mock_executor.hpp>
#include <common/test_support.hpp>
#include <serve.hpp>

TEST_CASE(
    "nexus rejects a null executor"
) {
    REQUIRE_THROWS_AS(echo::nexus(nullptr), std::invalid_argument);
}

TEST_CASE(
    "nexus serve invokes the executor exactly once"
) {
    auto executor      = std::make_unique<echo::tests::common::mock_executor>();
    auto* executor_ptr = executor.get();

    echo::nexus app(std::move(executor));
    app.fallback(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("fallback:" + req->path, 202);
        }
    );

    echo::tests::common::run_awaitable(app.serve(18765));

    REQUIRE(executor_ptr->serve_calls == 1);
}

TEST_CASE(
    "nexus serve passes the requested port to its executor"
) {
    auto executor      = std::make_unique<echo::tests::common::mock_executor>();
    auto* executor_ptr = executor.get();

    echo::nexus app(std::move(executor));
    app.fallback(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("fallback:" + req->path, 202);
        }
    );

    echo::tests::common::run_awaitable(app.serve(18765));

    REQUIRE(executor_ptr->last_port == 18765);
}

TEST_CASE(
    "nexus serve installs a callable handler on its executor"
) {
    auto executor      = std::make_unique<echo::tests::common::mock_executor>();
    auto* executor_ptr = executor.get();

    echo::nexus app(std::move(executor));
    app.fallback(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("fallback:" + req->path, 202);
        }
    );

    echo::tests::common::run_awaitable(app.serve(18765));

    REQUIRE(executor_ptr->has_handler());
}

TEST_CASE(
    "nexus serve installs a handler that runs the configured fallback"
) {
    auto executor      = std::make_unique<echo::tests::common::mock_executor>();
    auto* executor_ptr = executor.get();

    echo::nexus app(std::move(executor));
    app.fallback(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("fallback:" + req->path, 202);
        }
    );

    echo::tests::common::run_awaitable(app.serve(18765));

    const auto response =
        echo::tests::common::run_awaitable(executor_ptr->dispatch(echo::tests::common::make_request("GET", "/health")));

    REQUIRE(response.status == 202);
    REQUIRE(response.body == "fallback:/health");
}

TEST_CASE(
    "nexus handler passed to the executor preserves middleware chaining"
) {
    auto executor      = std::make_unique<echo::tests::common::mock_executor>();
    auto* executor_ptr = executor.get();

    echo::nexus app(std::move(executor));
    app.use(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t> next) -> echo::awaitable<echo::type::response> {
            auto response = co_await next.value()(req);
            response.set_header("X-Middleware", req->method);
            co_return response;
        }
    );
    app.fallback(
        [](std::shared_ptr<echo::type::request>,
           std::optional<echo::next_fn_t>) -> echo::awaitable<echo::type::response> {
            co_return echo::type::response::text("ok");
        }
    );

    echo::tests::common::run_awaitable(app.serve(30123));

    const auto response =
        echo::tests::common::run_awaitable(executor_ptr->dispatch(echo::tests::common::make_request("POST", "/items")));

    REQUIRE(response.status == 200);
    REQUIRE(response.body == "ok");

    const auto* header = response.get_header("x-middleware");
    REQUIRE(header != nullptr);
    REQUIRE(*header == "POST");
}

#ifndef DISABLE_BOOST_BEAST
TEST_CASE(
    "beast executor rejects an empty request handler"
) {
    echo::beast_executor executor;

    REQUIRE_THROWS_AS(echo::tests::common::run_awaitable(executor.serve(8081, {})), std::invalid_argument);
}
#endif
