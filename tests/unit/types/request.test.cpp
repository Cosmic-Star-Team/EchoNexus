#include <catch2/catch_test_macros.hpp>

#include <string>

#include <types/request.hpp>

TEST_CASE(
    "request get_query returns the stored value for a matching key"
) {
    echo::type::request req;
    req.query["page"] = "1";

    const auto* page = req.get_query("page");

    REQUIRE(page != nullptr);
    REQUIRE(*page == "1");
}

TEST_CASE(
    "request get_query returns nullptr for a missing key"
) {
    echo::type::request req;

    REQUIRE(req.get_query("missing") == nullptr);
}

TEST_CASE(
    "request get_header matches an exact header name"
) {
    echo::type::request req;
    req.headers["Content-Type"] = "text/plain";

    const auto* content_type = req.get_header("Content-Type");
    REQUIRE(content_type != nullptr);
    REQUIRE(*content_type == "text/plain");
}

TEST_CASE(
    "request get_header matches header names case-insensitively"
) {
    echo::type::request req;
    req.headers["x-request-id"] = "trace-123";

    const auto* request_id = req.get_header("X-Request-Id");
    REQUIRE(request_id != nullptr);
    REQUIRE(*request_id == "trace-123");
}

TEST_CASE(
    "request get_header returns nullptr for a missing header"
) {
    echo::type::request req;
    REQUIRE(req.get_header("authorization") == nullptr);
}

TEST_CASE(
    "request get_ctx returns the stored value for a matching type"
) {
    echo::type::request req;
    req.set_ctx("answer", 42);

    auto* answer = req.get_ctx<int>("answer");
    REQUIRE(answer != nullptr);
    REQUIRE(*answer == 42);
}

TEST_CASE(
    "request get_ctx returns nullptr when the stored type does not match"
) {
    echo::type::request req;
    req.set_ctx("answer", 42);

    REQUIRE(req.get_ctx<std::string>("answer") == nullptr);
}

TEST_CASE(
    "request const get_ctx returns the stored value"
) {
    echo::type::request req;
    req.set_ctx("name", std::string("EchoNexus"));

    const echo::type::request& const_req = req;
    const auto* name                     = const_req.get_ctx<std::string>("name");
    REQUIRE(name != nullptr);
    REQUIRE(*name == "EchoNexus");
}
