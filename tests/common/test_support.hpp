#ifndef ECHONEXUS_TESTS_COMMON_TEST_SUPPORT_HPP
#define ECHONEXUS_TESTS_COMMON_TEST_SUPPORT_HPP

#include <boost/asio/co_spawn.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/use_future.hpp>

#include <memory>
#include <string>
#include <utility>

#include <types/request.hpp>

namespace echo::tests::common {
    inline void run_awaitable(
        boost::asio::awaitable<void> task
    ) {
        boost::asio::io_context io_context;
        auto future = boost::asio::co_spawn(io_context, std::move(task), boost::asio::use_future);

        io_context.run();
        future.get();
    }

    template <typename T>
    [[nodiscard]] inline auto run_awaitable(
        boost::asio::awaitable<T> task
    ) -> T {
        boost::asio::io_context io_context;
        auto future = boost::asio::co_spawn(io_context, std::move(task), boost::asio::use_future);

        io_context.run();
        return future.get();
    }

    [[nodiscard]] inline auto make_request(
        std::string method = "GET",
        std::string path   = "/"
    ) -> std::shared_ptr<echo::type::request> {
        auto req    = std::make_shared<echo::type::request>();
        req->method = std::move(method);
        req->path   = path.empty() ? "/" : std::move(path);
        req->target = req->path;

        return req;
    }
} // namespace echo::tests::common

#endif // ECHONEXUS_TESTS_COMMON_TEST_SUPPORT_HPP
