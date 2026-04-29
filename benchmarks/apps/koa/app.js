const cluster = require("node:cluster");
const { availableParallelism } = require("node:os");
const Koa = require("koa");

const port = Number(process.env.BENCHMARK_PORT || "8080");
const requestedWorkers = Number(process.env.BENCHMARK_WORKERS || "1");
const workerCount = Math.max(1, requestedWorkers);

function buildApp() {
  const app = new Koa();

  app.use(async (ctx, next) => {
    if (ctx.path.startsWith("/api/v1/users/")) {
      ctx.state.scope = "user";
    }

    await next();
  });

  app.use(async (ctx) => {
    if (ctx.path === "/healthz") {
      ctx.type = "text/plain";
      ctx.body = "ok";
      return;
    }

    if (ctx.path === "/plaintext") {
      ctx.type = "text/plain";
      ctx.body = "Hello, World!";
      return;
    }

    if (ctx.path === "/json") {
      ctx.body = {
        message: "Hello, World!",
        ok: true,
      };
      return;
    }

    if (ctx.path === "/time_json") {
      const now = new Date();
      ctx.body = {
        localTime: now.toString(),
        unixMs: now.getTime(),
        timezoneOffsetMinutes: -now.getTimezoneOffset(),
      };
      return;
    }

    const match = ctx.path.match(/^\/api\/v1\/users\/([^/]+)\/profile$/);
    if (match) {
      ctx.body = {
        id: match[1],
        scope: ctx.state.scope || "missing",
        active: true,
      };
      return;
    }

    ctx.status = 404;
    ctx.type = "text/plain";
    ctx.body = "not found";
  });

  return app;
}

if (workerCount > 1 && cluster.isPrimary) {
  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork({
      ...process.env,
      BENCHMARK_WORKERS: "1",
    });
  }

  const limit = availableParallelism ? availableParallelism() : workerCount;
  if (workerCount > limit) {
    process.stderr.write(`requested ${workerCount} Koa workers on a ${limit}-core host\n`);
  }
} else {
  buildApp().listen(port, "127.0.0.1");
}
