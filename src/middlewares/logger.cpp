#include <middlewares/logger.hpp>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <print>
#include <string_view>

namespace {
    [[nodiscard]] auto to_lower_copy(
        std::string_view value
    ) -> std::string {
        std::string lowered(value);
        std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](const unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });

        return lowered;
    }

    [[nodiscard]] auto trim(
        std::string_view value
    ) -> std::string_view {
        while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front()))) {
            value.remove_prefix(1);
        }

        while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back()))) {
            value.remove_suffix(1);
        }

        return value;
    }

    [[nodiscard]] auto read_header(
        const echo::type::map_t& headers,
        std::string_view name
    ) -> const std::string* {
        const std::string lowered_name = to_lower_copy(name);

        for (const auto& [key, value] : headers) {
            if (to_lower_copy(key) == lowered_name) return &value;
        }

        return nullptr;
    }

    [[nodiscard]] auto get_client_ip(
        const echo::type::request& req
    ) -> std::string {
        if (const auto* x_forwarded_for = read_header(req.headers, "x-forwarded-for");
            x_forwarded_for != nullptr && !x_forwarded_for->empty()) {
            std::string_view first_hop = *x_forwarded_for;
            if (const auto comma = first_hop.find(','); comma != std::string_view::npos) {
                first_hop = first_hop.substr(0, comma);
            }

            const std::string_view forwarded_ip = trim(first_hop);
            if (!forwarded_ip.empty()) return std::string(forwarded_ip);
        }

        if (!req.remote_addr.empty()) return req.remote_addr;
        return "unknown";
    }

} // namespace

auto echo::middlewares::logger(
    std::shared_ptr<type::request> req,
    std::optional<next_fn_t> next
) -> boost::asio::awaitable<type::response> {
    const auto start = std::chrono::steady_clock::now();

    const std::string method = req->method.empty() ? "UNKNOWN" : req->method;
    const std::string path   = req->path.empty() ? "/" : req->path;

    const std::string client_ip = get_client_ip(*req);
    req->set_ctx("client_ip", client_ip);

    type::response res(404);
    if (next) {
        res = co_await (*next)(req);
    }

    const auto elapsed    = std::chrono::steady_clock::now() - start;
    const auto latency_us = std::chrono::duration_cast<std::chrono::microseconds>(elapsed).count();
    const auto latency_ms = static_cast<double>(latency_us) / 1000.0;
    req->set_ctx("latency_ms", latency_ms);

    const auto log_info = req->get_ctx<const char*>("log-info");

    // TODO: Use a abstract logger interface
    std::println(
        stderr,
        "[{}] {} {} status={} latency_ms={:.3f} client_ip={}{}",
        res.status == 200 ? "INFO" : "ERROR",
        method,
        path,
        res.status,
        latency_ms,
        client_ip,
        log_info ? *log_info : ""
    );

    co_return res;
}
