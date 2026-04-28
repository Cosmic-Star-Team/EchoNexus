#include <integration/serve_test_app.hpp>

#include <middlewares/cors.hpp>
#include <middlewares/logger.hpp>
#include <middlewares/router.hpp>
#include <types/request.hpp>
#include <types/response.hpp>

#include <memory>
#include <optional>
#include <stdexcept>
#include <string>

namespace {
    auto root_text(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("Hello from integration");
    }

    auto html_page(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::html("<h1>EchoNexus Integration</h1>");
    }

    auto json_page(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        auto response = echo::type::response::json(R"({"kind":"json","ok":true})", 200);
        response.set_header("X-Trace-Id", "trace-123");
        co_return response;
    }

    auto query_echo(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        const auto* page   = req->get_query("page");
        const auto* filter = req->get_query("filter");

        const std::string body =
            (page == nullptr ? std::string() : *page) + "|" + (filter == nullptr ? std::string() : *filter);

        co_return echo::type::response::text(body);
    }

    auto body_echo(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text(req->body, 201);
    }

    auto client_ip_view(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        const auto* client_ip = req->get_ctx<std::string>("client_ip");
        co_return echo::type::response::text(client_ip == nullptr ? "missing" : *client_ip);
    }

    auto explode(
        echo::type::request_ptr,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        throw std::runtime_error("boom");
    }

    auto api_user_scope(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t> next
    ) -> echo::awaitable<echo::type::response> {
        req->set_ctx("scope", std::string("users"));
        co_return co_await next.value()(req);
    }

    auto api_user_show(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        const auto* params = req->get_ctx<echo::type::map_t>("params");
        const auto* scope  = req->get_ctx<std::string>("scope");

        const std::string uid   = params == nullptr ? "missing" : params->at("uid");
        const std::string group = scope == nullptr ? "missing" : *scope;

        co_return echo::type::response::json("{\"uid\":\"" + uid + "\",\"scope\":\"" + group + "\"}", 200);
    }

    auto app_not_found(
        echo::type::request_ptr req,
        std::optional<echo::next_fn_t>
    ) -> echo::awaitable<echo::type::response> {
        co_return echo::type::response::text("No route for " + req->path, 404);
    }
} // namespace

void echo::tests::integration::configure_serve_test_app(
    echo::nexus& app
) {
    auto cors = std::make_shared<echo::middlewares::cors>(echo::middlewares::cors::preset::development);
    cors->expose_header("X-Trace-Id").max_age(600);

    echo::middlewares::router api_v1;
    api_v1.get("/users/{uid}", api_user_show).layer(api_user_scope);

    echo::middlewares::router api;
    api.nest("/v1", api_v1);

    echo::middlewares::router root;
    root.use(echo::middlewares::logger);
    root.use(cors);
    root.get("/", root_text);
    root.get("/html", html_page);
    root.get("/json", json_page);
    root.get("/query", query_echo);
    root.post("/body", body_echo);
    root.get("/meta/client-ip", client_ip_view);
    root.get("/explode", explode);
    root.nest("/api", api);

    app.use(std::make_shared<echo::middlewares::router>(root));
    app.fallback(app_not_found);
}
