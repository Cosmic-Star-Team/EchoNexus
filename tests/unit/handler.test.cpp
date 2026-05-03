#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <common/test_support.hpp>
#include <handler.hpp>

namespace {
    auto text_response(
        std::string body,
        unsigned int status = 200
    ) -> echo::handler_t {
        return [body = std::move(body), status](std::shared_ptr<echo::type::request>, std::optional<echo::next_fn_t>)
                   -> echo::awaitable<echo::type::response> { co_return echo::type::response::text(body, status); };
    }
} // namespace

TEST_CASE(
    "handler runs middleware in order around the fallback response"
) {
    echo::handler handler;
    std::vector<std::string> trace;

    handler.use(
        [&trace](std::shared_ptr<echo::type::request> req, std::optional<echo::next_fn_t> next)
            -> echo::awaitable<echo::type::response> {
            trace.push_back("first:before");
            auto response = co_await next.value()(req);
            trace.push_back("first:after");
            response.set_header("X-First", "1");
            co_return response;
        }
    );

    handler.use(
        [&trace](std::shared_ptr<echo::type::request> req, std::optional<echo::next_fn_t> next)
            -> echo::awaitable<echo::type::response> {
            trace.push_back("second:before");
            auto response = co_await next.value()(req);
            trace.push_back("second:after");
            response.set_header("X-Second", "1");
            co_return response;
        }
    );

    handler.fallback(text_response("done", 202));

    const auto response = echo::tests::common::run_awaitable(handler.handle(echo::tests::common::make_request()));

    REQUIRE(trace == std::vector<std::string>{"first:before", "second:before", "second:after", "first:after"});
    REQUIRE(response.status == 202);
    REQUIRE(response.body == "done");
    REQUIRE(response.get_header("x-first") != nullptr);
    REQUIRE(response.get_header("x-second") != nullptr);
}

TEST_CASE(
    "handler forwards to an outer tail when the local chain is exhausted"
) {
    echo::handler handler;
    handler.use(
        [](std::shared_ptr<echo::type::request> req,
           std::optional<echo::next_fn_t> next) -> echo::awaitable<echo::type::response> {
            auto response = co_await next.value()(req);
            response.set_header("X-Through", "1");
            co_return response;
        }
    );

    const echo::next_fn_t tail = [](std::shared_ptr<echo::type::request> req) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text(req->path, 206);
    };

    const auto response = echo::tests::common::run_awaitable(handler.handle_with_tail(
        echo::tests::common::make_request("GET", "/tail"),
        std::optional<echo::next_fn_t>{tail}
    ));

    REQUIRE(response.status == 206);
    REQUIRE(response.body == "/tail");

    const auto* through = response.get_header("x-through");
    REQUIRE(through != nullptr);
    REQUIRE(*through == "1");
}

TEST_CASE(
    "composed handlers keep child fallback behavior ahead of outer tails"
) {
    echo::handler child;
    child.fallback(text_response("child", 201));

    echo::handler parent;
    parent.use(child);

    const echo::next_fn_t tail = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("tail", 299);
    };

    const auto response = echo::tests::common::run_awaitable(
        parent.handle_with_tail(echo::tests::common::make_request(), std::optional<echo::next_fn_t>{tail})
    );

    REQUIRE(response.status == 201);
    REQUIRE(response.body == "child");
}
