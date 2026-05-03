#include <catch2/catch_test_macros.hpp>

#include <vector>

#include <types/response.hpp>

TEST_CASE(
    "response set_header normalizes header keys to lowercase"
) {
    echo::type::response response(201);
    response.set_header("X-Trace-Id", "trace-123");

    const auto* trace_id = response.get_header("x-trace-id");
    REQUIRE(trace_id != nullptr);
    REQUIRE(*trace_id == "trace-123");
}

TEST_CASE(
    "response set_body updates the content-length header"
) {
    echo::type::response response(201);
    response.set_body("hello");

    const auto* content_length = response.get_header("Content-Length");
    REQUIRE(content_length != nullptr);
    REQUIRE(*content_length == "5");
}

TEST_CASE(
    "response text creates a plain-text response with the default success status"
) {
    const auto response = echo::type::response::text("ok");

    REQUIRE(response.status == 200);
    REQUIRE(response.message == "OK");
    REQUIRE(response.body == "ok");

    const auto* content_type = response.get_header("content-type");
    REQUIRE(content_type != nullptr);
    REQUIRE(*content_type == "text/plain; charset=utf-8");
}

TEST_CASE(
    "response html preserves an explicit status code"
) {
    const auto response = echo::type::response::html("<p>ok</p>", 202);

    REQUIRE(response.status == 202);
    REQUIRE(response.message == "Accepted");

    const auto* content_type = response.get_header("content-type");
    REQUIRE(content_type != nullptr);
    REQUIRE(*content_type == "text/html; charset=utf-8");
}

TEST_CASE(
    "response redirect sets the location header"
) {
    const auto response = echo::type::response::redirect("/login", 307);

    REQUIRE(response.status == 307);
    REQUIRE(response.message == "Temporary Redirect");
    REQUIRE(response.body.empty());

    const auto* location = response.get_header("location");
    REQUIRE(location != nullptr);
    REQUIRE(*location == "/login");
}

TEST_CASE(
    "response json serializes supported values into the response body"
) {
    const auto response = echo::type::response::json(std::vector<int>{1, 2, 3});

    REQUIRE(response.status == 200);
    REQUIRE(response.message == "OK");
    REQUIRE(response.body == "[1,2,3]");
}

TEST_CASE(
    "response json sets the JSON content type and content length"
) {
    const auto response = echo::type::response::json(std::vector<int>{1, 2, 3});

    const auto* content_type = response.get_header("content-type");
    REQUIRE(content_type != nullptr);
    REQUIRE(*content_type == "application/json; charset=utf-8");

    const auto* content_length = response.get_header("content-length");
    REQUIRE(content_length != nullptr);
    REQUIRE(*content_length == "7");
}
