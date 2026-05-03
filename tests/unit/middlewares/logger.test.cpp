#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <optional>

#include <common/test_support.hpp>
#include <middlewares/logger.hpp>

TEST_CASE(
    "logger stores the first forwarded IP address in request context"
) {
    auto req                        = echo::tests::common::make_request("GET", "/logs");
    req->headers["X-Forwarded-For"] = " 203.0.113.7 , 198.51.100.1 ";

    bool next_called = false;
    const echo::next_fn_t next =
        [&next_called](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        next_called = true;
        co_return echo::type::response::text("logged", 201);
    };

    const auto response =
        echo::tests::common::run_awaitable(echo::middlewares::logger(req, std::optional<echo::next_fn_t>{next}));

    const auto* client_ip = req->get_ctx<std::string>("client_ip");
    REQUIRE(client_ip != nullptr);
    REQUIRE(*client_ip == "203.0.113.7");
}

TEST_CASE(
    "logger stores request latency in context"
) {
    auto req = echo::tests::common::make_request("GET", "/logs");

    const echo::next_fn_t next = [](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("logged", 201);
    };

    const auto response =
        echo::tests::common::run_awaitable(echo::middlewares::logger(req, std::optional<echo::next_fn_t>{next}));

    const auto* latency_ms = req->get_ctx<double>("latency_ms");
    REQUIRE(latency_ms != nullptr);
    REQUIRE(*latency_ms >= 0.0);

    REQUIRE(response.status == 201);
}

TEST_CASE(
    "logger preserves the downstream response"
) {
    auto req = echo::tests::common::make_request("GET", "/logs");

    bool next_called = false;
    const echo::next_fn_t next =
        [&next_called](std::shared_ptr<echo::type::request>) -> echo::awaitable<echo::type::response> {
        next_called = true;
        co_return echo::type::response::text("logged", 201);
    };

    const auto response =
        echo::tests::common::run_awaitable(echo::middlewares::logger(req, std::optional<echo::next_fn_t>{next}));

    REQUIRE(next_called);
    REQUIRE(response.status == 201);
    REQUIRE(response.body == "logged");
}

TEST_CASE(
    "logger falls back to the remote address when forwarding headers are absent"
) {
    auto req         = echo::tests::common::make_request("GET", "/logs");
    req->remote_addr = "198.51.100.44";

    const auto response = echo::tests::common::run_awaitable(echo::middlewares::logger(req, std::nullopt));

    const auto* client_ip = req->get_ctx<std::string>("client_ip");
    REQUIRE(client_ip != nullptr);
    REQUIRE(*client_ip == "198.51.100.44");
}

TEST_CASE(
    "logger returns a 404 response when there is no downstream handler"
) {
    auto req = echo::tests::common::make_request("GET", "/logs");

    const auto response = echo::tests::common::run_awaitable(echo::middlewares::logger(req, std::nullopt));

    REQUIRE(response.status == 404);
}
