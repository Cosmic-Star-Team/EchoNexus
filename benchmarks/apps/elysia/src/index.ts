import { Elysia } from "elysia";

const port = Number(Bun.env.BENCHMARK_PORT ?? "8080");
const requestedWorkers = Number(Bun.env.BENCHMARK_WORKERS ?? "1");
const reusePort = Bun.env.BENCHMARK_REUSE_PORT === "1";
const isChild = Bun.env.BENCHMARK_CHILD === "1";

function buildApp() {
  return new Elysia()
    .derive(({ path }) => ({
      scope: path.startsWith("/api/v1/users/") ? "user" : "missing",
    }))
    .get("/healthz", "ok")
    .get("/plaintext", "Hello, World!")
    .get("/json", () => ({
      message: "Hello, World!",
      ok: true,
    }))
    .get("/time_json", () => {
      const now = new Date();
      return {
        localTime: now.toString(),
        unixMs: now.getTime(),
        timezoneOffsetMinutes: -now.getTimezoneOffset(),
      };
    })
    .get("/api/v1/users/:id/profile", ({ params, scope }) => ({
      id: params.id,
      scope,
      active: true,
    }));
}

if (requestedWorkers > 1 && reusePort && !isChild) {
  for (let index = 0; index < requestedWorkers; index += 1) {
    Bun.spawn({
      cmd: ["bun", "run", "src/index.ts"],
      cwd: `${import.meta.dir}/..`,
      env: {
        ...process.env,
        BENCHMARK_CHILD: "1",
        BENCHMARK_WORKERS: "1",
        BENCHMARK_REUSE_PORT: "1",
      },
      stdout: "ignore",
      stderr: "ignore",
    });
  }

  await new Promise(() => undefined);
} else {
  buildApp().listen({
    hostname: "127.0.0.1",
    port,
    reusePort,
  });

  await new Promise(() => undefined);
}
