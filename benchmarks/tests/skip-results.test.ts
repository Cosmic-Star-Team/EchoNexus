import { describe, expect, test } from "bun:test";

import {
  buildFrameworkSkipResults,
  buildSessionSkipResults,
  buildSkippedCaseResult,
} from "../src/skip-results";
import type { BenchmarkOptions } from "../src/types";

describe("buildSkippedCaseResult", () => {
  test("builds one skipped case with null metrics and preserved execution model", () => {
    const result = buildSkippedCaseResult({
      framework: "gin",
      workload: "plaintext",
      workers: 4,
      mode: "multi-worker",
      concurrency: 50,
      executionModel: "multi-process",
      warmupSeconds: 5,
      measureSeconds: 10,
      notes: ["missing required framework SDK/command: go"],
    });

    expect(result).toEqual({
      framework: "gin",
      workload: "plaintext",
      workers: 4,
      mode: "multi-worker",
      concurrency: 50,
      executionModel: "multi-process",
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
      notes: ["missing required framework SDK/command: go"],
    });
  });
});

describe("buildFrameworkSkipResults", () => {
  test("expands skipped gin cases across the selected matrix", () => {
    const options: BenchmarkOptions = {
      frameworks: ["gin"],
      workloads: ["plaintext", "json"],
      workers: [1, 4],
      concurrency: [50],
      buildProfile: "release",
      warmupSeconds: 5,
      measureSeconds: 10,
      cooldownSeconds: 1,
      setupOnly: false,
    };

    const results = buildFrameworkSkipResults({
      options,
      skippedFrameworks: [
        {
          framework: "gin",
          missingCommands: ["go"],
          notes: ["missing required framework SDK/command: go"],
        },
      ],
    });

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.framework === "gin")).toBe(true);
    expect(results.every((result) => result.status === "skipped")).toBe(true);
    expect(results.every((result) => result.notes[0] === "missing required framework SDK/command: go")).toBe(true);
    expect(results.map((result) => result.workers)).toEqual([1, 4, 1, 4]);
    expect(results.map((result) => result.workload)).toEqual(["plaintext", "plaintext", "json", "json"]);
  });
});

describe("buildSessionSkipResults", () => {
  test("expands a full selected session into skipped results", () => {
    const options: BenchmarkOptions = {
      frameworks: ["gin", "koa"],
      workloads: ["plaintext"],
      workers: [1, 4],
      concurrency: [50, 200],
      buildProfile: "release",
      warmupSeconds: 5,
      measureSeconds: 10,
      cooldownSeconds: 1,
      setupOnly: false,
    };

    const results = buildSessionSkipResults({
      options,
      notes: ["global setup failed"],
    });

    expect(results).toHaveLength(8);
    expect(results.every((result) => result.status === "skipped")).toBe(true);
    expect(results.every((result) => result.notes[0] === "global setup failed")).toBe(true);
    expect(results.map((result) => result.framework)).toEqual([
      "gin",
      "gin",
      "gin",
      "gin",
      "koa",
      "koa",
      "koa",
      "koa",
    ]);
    expect(results.map((result) => result.concurrency)).toEqual([50, 200, 50, 200, 50, 200, 50, 200]);
  });
});
