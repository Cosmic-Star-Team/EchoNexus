import { describe, expect, test } from "bun:test";

import {
  buildCaseFailureSkipResult,
  buildGlobalCommandSkipResults,
  prepareFrameworksWithSkips,
} from "../src/runtime";
import type { BenchmarkOptions } from "../src/types";

describe("buildGlobalCommandSkipResults", () => {
  test("builds session-wide skipped results for frameworks still runnable after preflight", () => {
    const options: BenchmarkOptions = {
      frameworks: ["fastapi", "gin", "koa"],
      workloads: ["plaintext"],
      workers: [1, 4],
      concurrency: [50],
      buildProfile: "release",
      warmupSeconds: 5,
      measureSeconds: 10,
      cooldownSeconds: 1,
      setupOnly: false,
    };

    const results = buildGlobalCommandSkipResults({
      options,
      missingCommands: ["oha"],
      skippedFrameworks: [
        {
          framework: "gin",
          missingCommands: ["go"],
          notes: ["missing required framework SDK/command: go"],
        },
      ],
    });

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.status === "skipped")).toBe(true);
    expect(results.every((result) => result.notes[0] === "missing required global command: oha")).toBe(true);
    expect(results.map((result) => result.framework)).toEqual([
      "fastapi",
      "fastapi",
      "koa",
      "koa",
    ]);
    expect(results.map((result) => result.workers)).toEqual([1, 4, 1, 4]);
  });
});

describe("prepareFrameworksWithSkips", () => {
  test("converts setup failures into framework-wide skipped results and keeps later frameworks runnable", async () => {
    const options: BenchmarkOptions = {
      frameworks: ["fastapi", "gin", "koa"],
      workloads: ["plaintext"],
      workers: [1],
      concurrency: [50],
      buildProfile: "release",
      warmupSeconds: 5,
      measureSeconds: 10,
      cooldownSeconds: 1,
      setupOnly: false,
    };

    const prepared: string[] = [];
    const result = await prepareFrameworksWithSkips({
      options,
      frameworks: ["fastapi", "gin", "koa"],
      prepareFramework: async (framework) => {
        prepared.push(framework);
        if (framework === "gin") {
          throw Object.assign(new Error("Command failed (1): go build ./..."), {
            stdout: "stdout line",
            stderr: "stderr line",
          });
        }
      },
    });

    expect(prepared).toEqual(["fastapi", "gin", "koa"]);
    expect(result.availableFrameworks).toEqual(["fastapi", "koa"]);
    expect(result.skippedFrameworks).toEqual([
      {
        framework: "gin",
        missingCommands: [],
        notes: [
          "Command failed (1): go build ./...",
          "stdout: stdout line",
          "stderr: stderr line",
        ],
      },
    ]);
    expect(
      result.skipResults.map((skipResult) => ({
        framework: skipResult.framework,
        status: skipResult.status,
        notes: skipResult.notes,
      })),
    ).toEqual([
      {
        framework: "gin",
        status: "skipped",
        notes: [
          "Command failed (1): go build ./...",
          "stdout: stdout line",
          "stderr: stderr line",
        ],
      },
    ]);
  });
});

describe("buildCaseFailureSkipResult", () => {
  test("converts a case execution failure into a skipped result with preserved diagnostics", () => {
    const result = buildCaseFailureSkipResult({
      case: {
        framework: "koa",
        workload: "plaintext",
        workers: 4,
        mode: "multi-worker",
        concurrency: 200,
      },
      executionModel: "single-process-event-loop",
      warmupSeconds: 5,
      measureSeconds: 10,
      error: Object.assign(new Error("Command failed (42): bun run bench"), {
        exitCode: 42,
        stdout: "stdout line",
        stderr: "stderr line",
      }),
    });

    expect(result).toEqual({
      framework: "koa",
      workload: "plaintext",
      workers: 4,
      mode: "multi-worker",
      concurrency: 200,
      executionModel: "single-process-event-loop",
      warmupSeconds: 5,
      measureSeconds: 10,
      status: "skipped",
      requestsPerSec: null,
      successRequestsPerSec: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
      errorRate: null,
      peakRssMb: null,
      avgCpuPercent: null,
      notes: [
        "benchmark case skipped: Command failed (42): bun run bench",
        "exit code: 42",
        "stdout: stdout line",
        "stderr: stderr line",
      ],
    });
  });

  test("merges thrown command diagnostics with captured app diagnostics when both exist", () => {
    const result = buildCaseFailureSkipResult({
      case: {
        framework: "koa",
        workload: "plaintext",
        workers: 1,
        mode: "single-worker",
        concurrency: 50,
      },
      executionModel: "single-process-event-loop",
      warmupSeconds: 5,
      measureSeconds: 10,
      error: Object.assign(new Error("Command failed (42): bun run bench"), {
        exitCode: 42,
        stdout: "command stdout",
        stderr: "command stderr",
      }),
      stdout: "app stdout",
      stderr: "app stderr",
    });

    expect(result.notes).toEqual([
      "benchmark case skipped: Command failed (42): bun run bench",
      "exit code: 42",
      "stdout: command stdout | app stdout",
      "stderr: command stderr | app stderr",
    ]);
  });
});
