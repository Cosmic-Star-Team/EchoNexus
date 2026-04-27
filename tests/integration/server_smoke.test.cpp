#include <catch2/catch_test_macros.hpp>

#include <memory>

#include <serve.hpp>

TEST_CASE(
    "integration test target can link server transport types when Beast is enabled"
) {
    auto executor = std::make_unique<echo::beast_executor>();
    echo::nexus app(std::move(executor));

    SUCCEED();
}
