#include <catch2/catch_test_macros.hpp>

#include <types/response.hpp>

TEST_CASE(
    "unit test target can compile against public EchoNexus headers"
) {
    const echo::type::response response = echo::type::response::text("ok");

    REQUIRE(response.status == 200);
    REQUIRE(response.message == "OK");
    REQUIRE(response.body == "ok");

    const auto* content_type = response.get_header("content-type");
    REQUIRE(content_type != nullptr);
    REQUIRE(*content_type == "text/plain; charset=utf-8");
}
