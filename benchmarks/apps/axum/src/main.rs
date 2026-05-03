use axum::{
    body::Body,
    extract::{Extension, Path},
    http::{Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use chrono::Local;
use serde::Serialize;
use std::{env, net::SocketAddr};

#[derive(Clone)]
struct Scope(&'static str);

#[derive(Serialize)]
struct HelloPayload {
    message: &'static str,
    ok: bool,
}

#[derive(Serialize)]
struct ProfilePayload {
    id: String,
    scope: String,
    active: bool,
}

async fn time_json() -> Json<serde_json::Value> {
    let now = Local::now();

    Json(serde_json::json!({
        "localTime": now.to_rfc3339(),
        "unixMs": now.timestamp_millis(),
        "timezoneOffsetMinutes": now.offset().local_minus_utc() / 60,
    }))
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn plaintext() -> impl IntoResponse {
    (StatusCode::OK, "Hello, World!")
}

async fn json_route() -> Json<HelloPayload> {
    Json(HelloPayload {
        message: "Hello, World!",
        ok: true,
    })
}

async fn add_scope(request: Request<Body>, next: Next) -> Response {
    let mut request = request;
    if request.uri().path().starts_with("/api/v1/users/") {
        request.extensions_mut().insert(Scope("user"));
    }
    next.run(request).await
}

async fn profile(
    Path(id): Path<String>,
    scope: Option<Extension<Scope>>,
) -> Json<ProfilePayload> {
    Json(ProfilePayload {
        id,
        scope: scope
            .map(|Extension(value)| value.0.to_string())
            .unwrap_or_else(|| "missing".to_string()),
        active: true,
    })
}

fn app() -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/plaintext", get(plaintext))
        .route("/json", get(json_route))
        .route("/time_json", get(time_json))
        .route("/api/v1/users/{id}/profile", get(profile))
        .layer(middleware::from_fn(add_scope))
}

async fn async_main() {
    let port = env::var("BENCHMARK_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind axum benchmark listener");

    axum::serve(listener, app())
        .await
        .expect("axum benchmark server stopped unexpectedly");
}

fn main() {
    let workers = env::var("BENCHMARK_WORKERS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(1);

    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(workers.max(1))
        .enable_all()
        .build()
        .expect("failed to build tokio runtime")
        .block_on(async_main());
}
