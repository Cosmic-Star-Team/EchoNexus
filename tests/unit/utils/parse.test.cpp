#include <catch2/catch_test_macros.hpp>

#include <utils/parse.hpp>

TEST_CASE(
    "parse_query stores explicit key-value pairs"
) {
    const auto query = echo::utils::parse_query("name=leo&city=shanghai");

    REQUIRE(query.at("name") == "leo");
    REQUIRE(query.at("city") == "shanghai");
}

TEST_CASE(
    "parse_query stores empty values for keys followed by an equals sign"
) {
    const auto query = echo::utils::parse_query("empty=");

    REQUIRE(query.contains("empty"));
    REQUIRE(query.at("empty").empty());
}

TEST_CASE(
    "parse_query stores bare keys with an empty value"
) {
    const auto query = echo::utils::parse_query("flag");

    REQUIRE(query.contains("flag"));
    REQUIRE(query.at("flag").empty());
}

TEST_CASE(
    "parse_query ignores fragments with an empty key"
) {
    const auto query = echo::utils::parse_query("name=leo&&=ignored");

    REQUIRE(query.size() == 1);
    REQUIRE(query.at("name") == "leo");
}

TEST_CASE(
    "parse_target preserves a path that does not contain a query string"
) {
    const auto [path, query] = echo::utils::parse_target("/users");

    REQUIRE(path == "/users");
    REQUIRE(query.empty());
}

TEST_CASE(
    "parse_target uses the root path when the target starts with a query string"
) {
    const auto [path, query] = echo::utils::parse_target("?page=2&sort=asc");

    REQUIRE(path == "/");
    REQUIRE(query.size() == 2);
    REQUIRE(query.at("page") == "2");
    REQUIRE(query.at("sort") == "asc");
}
