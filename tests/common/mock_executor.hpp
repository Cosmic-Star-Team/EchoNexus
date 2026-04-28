#ifndef ECHONEXUS_TESTS_COMMON_MOCK_EXECUTOR_HPP
#define ECHONEXUS_TESTS_COMMON_MOCK_EXECUTOR_HPP

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <stdexcept>

#include <serve.hpp>

namespace echo::tests::common {
    struct mock_executor final : echo::executor {
        std::size_t serve_calls = 0;
        std::optional<std::uint16_t> last_port;
        std::shared_ptr<echo::next_fn_t> last_handler;

        auto serve(
            const std::uint16_t port,
            echo::next_fn_t handler
        ) -> echo::awaitable<void> override {
            ++serve_calls;
            last_port = port;

            if (handler) {
                last_handler = std::make_shared<echo::next_fn_t>(std::move(handler));
            } else {
                last_handler.reset();
            }

            co_return;
        }

        [[nodiscard]] auto has_handler() const -> bool {
            return last_handler != nullptr && static_cast<bool>(*last_handler);
        }

        auto dispatch(
            std::shared_ptr<echo::type::request> req
        ) -> echo::awaitable<echo::type::response> {
            if (!has_handler()) {
                throw std::logic_error("mock executor has no captured handler");
            }

            co_return co_await (*last_handler)(std::move(req));
        }
    };
} // namespace echo::tests::common

#endif // ECHONEXUS_TESTS_COMMON_MOCK_EXECUTOR_HPP
