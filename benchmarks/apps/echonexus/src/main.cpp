#include <middlewares/router.hpp>
#include <serve.hpp>
#include <types/request.hpp>
#include <types/response.hpp>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <exception>
#include <iostream>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace echonexus_benchmark {
    struct hello_payload {
        std::string message;
        bool ok;
    };

    struct time_payload {
        std::string localTime;
        std::int64_t unixMs;
        int timezoneOffsetMinutes;
    };

    struct profile_payload {
        std::string id;
        std::string scope;
        bool active;
    };
} // namespace echonexus_benchmark

namespace {
    auto local_tm_from_time(std::time_t time_value) -> std::tm {
        std::tm local_tm {};

#ifdef _WIN32
        localtime_s(&local_tm, &time_value);
#else
        localtime_r(&time_value, &local_tm);
#endif

        return local_tm;
    }

    auto utc_tm_from_time(std::time_t time_value) -> std::tm {
        std::tm utc_tm {};

#ifdef _WIN32
        gmtime_s(&utc_tm, &time_value);
#else
        gmtime_r(&time_value, &utc_tm);
#endif

        return utc_tm;
    }

    auto format_timezone_offset(int offset_minutes) -> std::string {
        const char sign = offset_minutes >= 0 ? '+' : '-';
        const int absolute_minutes = offset_minutes >= 0 ? offset_minutes : -offset_minutes;
        const int hours = absolute_minutes / 60;
        const int minutes = absolute_minutes % 60;
        char buffer[7];
        std::snprintf(buffer, sizeof(buffer), "%c%02d:%02d", sign, hours, minutes);
        return buffer;
    }

    auto current_time_payload() -> echonexus_benchmark::time_payload {
        const auto now = std::chrono::system_clock::now();
        const auto unix_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        )
                                 .count();
        const auto time_value = std::chrono::system_clock::to_time_t(now);
        std::tm local_tm = local_tm_from_time(time_value);
        std::tm utc_tm = utc_tm_from_time(time_value);
        const auto local_seconds = std::mktime(&local_tm);
        const auto utc_seconds = std::mktime(&utc_tm);
        const auto offset_minutes =
            static_cast<int>(std::difftime(local_seconds, utc_seconds) / 60.0);

        char timestamp[32];
        std::strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%S", &local_tm);

        return echonexus_benchmark::time_payload{
            .localTime = std::string(timestamp) + format_timezone_offset(offset_minutes),
            .unixMs = unix_ms,
            .timezoneOffsetMinutes = offset_minutes,
        };
    }

    auto healthz(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("ok");
    }

    auto plaintext(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("Hello, World!");
    }

    auto json(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::json(echonexus_benchmark::hello_payload{
            .message = "Hello, World!",
            .ok = true,
        });
    }

    auto time_json(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::json(current_time_payload());
    }

    auto add_scope(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t> next
    ) -> echo::awaitable<echo::type::response> {
        if (req->path.starts_with("/api/v1/users/")) {
            req->set_ctx("scope", std::string("user"));
        }

        if (!next.has_value()) {
            co_return echo::type::response::text("Benchmark middleware chain is incomplete.", 500);
        }

        co_return co_await next.value()(req);
    }

    auto user_profile(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        const auto* params = req->get_ctx<echo::type::map_t>("params");
        const auto* scope  = req->get_ctx<std::string>("scope");

        std::string id_value = "missing";
        if (params != nullptr) {
            const auto id_it = params->find("id");
            if (id_it != params->end()) {
                id_value = id_it->second;
            }
        }

        const std::string scope_value = scope == nullptr ? "missing" : *scope;

        co_return echo::type::response::json(echonexus_benchmark::profile_payload{
            .id = std::move(id_value),
            .scope = scope_value,
            .active = true,
        });
    }

    auto not_found(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("No route for " + req->path, 404);
    }
} // namespace

auto main() -> int {
#ifdef DISABLE_BOOST_BEAST
    std::cerr
        << "Boost.Beast is disabled. Rebuild without ECHONEXUS_DISABLE_BEAST "
           "to run echonexus_benchmark.\n";
    return 1;
#else
    const auto parse_env_uint = [](const char* name, unsigned default_value) {
        if (const char* raw = std::getenv(name); raw != nullptr) {
            try {
                return static_cast<unsigned>(std::stoul(raw));
            } catch (const std::exception&) {
                return default_value;
            }
        }

        return default_value;
    };

    const auto worker_count = std::max(1, static_cast<int>(parse_env_uint("BENCHMARK_WORKERS", 1)));
    const auto port = static_cast<std::uint16_t>(parse_env_uint("BENCHMARK_PORT", 8080));

    echo::net::io_context ioc(worker_count);

    echo::nexus app(std::make_unique<echo::beast_executor>());

    echo::middlewares::router root;
    root.use(add_scope);
    root.get("/healthz", healthz);
    root.get("/plaintext", plaintext);
    root.get("/json", json);
    root.get("/time_json", time_json);
    root.route("/api/v1/users/{id}/profile").get(user_profile);

    app.use(std::make_shared<echo::middlewares::router>(root));
    app.fallback(not_found);

    echo::net::co_spawn(ioc, app.serve(port), [&ioc](std::exception_ptr ep) {
        if (!ep) {
            return;
        }

        try {
            std::rethrow_exception(ep);
        } catch (const std::exception& e) {
            std::cerr << "Server error: " << e.what() << '\n';
        }

        ioc.stop();
    });

    std::vector<std::thread> workers;
    workers.reserve(static_cast<std::size_t>(worker_count > 0 ? worker_count - 1 : 0));
    for (int index = 1; index < worker_count; ++index) {
        workers.emplace_back([&ioc]() {
            ioc.run();
        });
    }

    ioc.run();

    for (auto& worker : workers) {
        if (worker.joinable()) {
            worker.join();
        }
    }

    return 0;
#endif
}
