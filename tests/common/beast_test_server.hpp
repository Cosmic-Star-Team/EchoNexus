#ifndef ECHONEXUS_TESTS_COMMON_BEAST_TEST_SERVER_HPP
#define ECHONEXUS_TESTS_COMMON_BEAST_TEST_SERVER_HPP

#include <boost/asio/co_spawn.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>

#include <chrono>
#include <functional>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include <serve.hpp>

namespace echo::tests::common {
    namespace net   = boost::asio;
    namespace beast = boost::beast;
    namespace http  = beast::http;
    using tcp       = net::ip::tcp;

    [[nodiscard]] inline auto find_unused_port() -> std::uint16_t {
        net::io_context io_context;
        tcp::acceptor acceptor(io_context, tcp::endpoint(tcp::v4(), 0));

        return acceptor.local_endpoint().port();
    }

    struct beast_test_server {
        std::shared_ptr<echo::nexus> app;
        net::io_context io_context;
        std::jthread thread;
        std::uint16_t port = find_unused_port();
        std::exception_ptr serve_error;

        explicit beast_test_server(
            const std::function<void(echo::nexus&)>& configure
        ) : app(std::make_shared<echo::nexus>(std::make_unique<echo::beast_executor>())) {
            configure(*app);

            net::co_spawn(io_context, app->serve(port), [this](std::exception_ptr ep) { serve_error = ep; });

            thread = std::jthread([this]() { io_context.run(); });
        }

        ~beast_test_server() { io_context.stop(); }

        [[nodiscard]] auto request(
            http::verb method,
            std::string target,
            std::string body                                         = "",
            std::vector<std::pair<std::string, std::string>> headers = {}
        ) -> http::response<http::string_body> {
            for (int attempt = 0; attempt < 50; ++attempt) {
                if (serve_error) {
                    std::rethrow_exception(serve_error);
                }

                try {
                    net::io_context client_context;
                    tcp::resolver resolver(client_context);
                    beast::tcp_stream stream(client_context);

                    const auto endpoints = resolver.resolve("127.0.0.1", std::to_string(port));
                    stream.connect(endpoints);

                    http::request<http::string_body> req{method, std::move(target), 11};
                    req.keep_alive(false);
                    req.set(http::field::host, "127.0.0.1");

                    for (const auto& [key, value] : headers) {
                        req.set(key, value);
                    }

                    req.body() = std::move(body);
                    req.prepare_payload();

                    http::write(stream, req);

                    beast::flat_buffer buffer;
                    http::response<http::string_body> res;
                    http::read(stream, buffer, res);

                    beast::error_code shutdown_ec;
                    tcp::socket& socket = stream.socket();
                    shutdown_ec         = socket.shutdown(tcp::socket::shutdown_both, shutdown_ec);

                    if (shutdown_ec && shutdown_ec != boost::asio::error::not_connected) {
                        throw boost::system::system_error(shutdown_ec);
                    }

                    return res;
                } catch (const boost::system::system_error& error) {
                    if (error.code() != boost::asio::error::connection_refused || attempt == 49) {
                        throw;
                    }

                    std::this_thread::sleep_for(std::chrono::milliseconds(10));
                }
            }

            throw std::runtime_error("server did not start in time");
        }
    };
} // namespace echo::tests::common

#endif // ECHONEXUS_TESTS_COMMON_BEAST_TEST_SERVER_HPP
