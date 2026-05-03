import { describe, expect, test } from "bun:test";

import { renderMarkdown } from "../src/report";
import type { BenchmarkSessionReport } from "../src/types";

describe("renderMarkdown", () => {
  test("renders session config, machine metadata, toolchains, and grouped status-aware rows", () => {
    const report: BenchmarkSessionReport = {
      generatedAt: "2026-04-29T12:00:00.000Z",
      startedAt: "2026-04-29T11:54:30.000Z",
      finishedAt: "2026-04-29T12:00:00.000Z",
      totalDurationSeconds: 330,
      platform: "linux",
      cpuCount: 16,
      config: {
        frameworks: ["echonexus", "fastapi"],
        workloads: ["json", "time_json"],
        workers: [1, 4],
        concurrency: [50, 500],
        buildProfile: "release",
        warmupSeconds: 10,
        measureSeconds: 30,
        cooldownSeconds: 5,
        outputTag: "nightly",
      },
      system: {
        osName: "Ubuntu",
        osVersion: "24.04",
        kernelVersion: "6.8.9",
        architecture: "x86_64",
        cpuModel: "AMD Ryzen 9",
        logicalCpuCount: 16,
        physicalCpuCount: 8,
        totalMemoryBytes: 68719476736,
        hostname: "bench-host",
      },
      toolchains: {
        bun: "1.2.11",
        node: "v22.11.0",
        python: "Python 3.13.3",
        go: "go version go1.25.0 linux/amd64",
        java: "openjdk 21.0.7",
        gradle: "Gradle 8.14.3",
        cargo: "cargo 1.87.0",
        rustc: "rustc 1.87.0",
        cmake: "cmake version 3.30.0",
        oha: "oha 1.8.0",
        cCompiler: "/usr/bin/clang",
        cCompilerVersion: "Apple clang version 17.0.0",
        cxxCompiler: "/usr/bin/clang++",
        cxxCompilerVersion: "Apple clang version 17.0.0",
      },
      results: [
        {
          framework: "echonexus",
          workload: "json",
          workers: 4,
          mode: "multi-worker",
          concurrency: 500,
          warmupSeconds: 10,
          measureSeconds: 30,
          executionModel: "runtime-threaded",
          status: "passed",
          requestsPerSec: 45678.12,
          successRequestsPerSec: 45221.34,
          p50Ms: 1.23,
          p95Ms: 4.56,
          p99Ms: 8.91,
          maxMs: 19.87,
          errorRate: 0.01,
          peakRssMb: 256.78,
          avgCpuPercent: 312.45,
          notes: ["stable"],
        },
        {
          framework: "fastapi",
          workload: "time_json",
          workers: 1,
          mode: "single-worker",
          concurrency: 50,
          warmupSeconds: 10,
          measureSeconds: 30,
          executionModel: "multi-process",
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
          notes: ["unsupported on this platform"],
        },
      ],
    };

    const markdown = renderMarkdown(report);

    expect(markdown).toContain("- Total Duration: 330.00s");
    expect(markdown).toContain("## Run Summary");
    expect(markdown).toContain("- Frameworks: echonexus, fastapi");
    expect(markdown).toContain("- Build Profile: release");
    expect(markdown).toContain("- Output Tag: nightly");
    expect(markdown).toContain("## System");
    expect(markdown).toContain("- CPU Model: AMD Ryzen 9");
    expect(markdown).toContain("- Total Memory: 64.00 GiB (68719476736 bytes)");
    expect(markdown).toContain("## Toolchains");
    expect(markdown).toContain("- Bun: 1.2.11");
    expect(markdown).toContain("Success QPS");
    expect(markdown).toContain("Err %");
    expect(markdown).toContain("### json");
    expect(markdown).toContain("#### workers=4");
    expect(markdown).toContain("| echonexus | runtime-threaded | 4 | 500 | passed | 45678.12 | 45221.34 | 1.00% | 4.56 | 256.78 | 312.45 | stable |");
    expect(markdown).toContain("| fastapi | multi-process | 1 | 50 | skipped | - | - | - | - | - | - | unsupported on this platform |");
    expect(markdown).toContain("## Skipped And Failed");
  });

  test("keeps older case result object literals compatible when success qps is absent", () => {
    const report: BenchmarkSessionReport = {
      generatedAt: "2026-04-29T12:00:00.000Z",
      platform: "linux",
      cpuCount: 8,
      results: [
        {
          framework: "koa",
          workload: "plaintext",
          workers: 1,
          mode: "single-worker",
          concurrency: 50,
          warmupSeconds: 10,
          measureSeconds: 30,
          executionModel: "multi-process",
          requestsPerSec: 12345.67,
          p50Ms: 1.11,
          p95Ms: 2.22,
          p99Ms: 3.33,
          maxMs: 4.44,
          errorRate: 0,
          peakRssMb: 64.5,
          avgCpuPercent: 88.9,
          notes: [],
        },
      ],
    };

    const markdown = renderMarkdown(report);

    expect(markdown).toContain("| koa | multi-process | 1 | 50 | passed | 12345.67 | - | 0.00% | 2.22 | 64.50 | 88.90 |  |");
  });

  test("renders dashes for missing newer or undefined metric fields", () => {
    const report = {
      generatedAt: "2026-04-29T12:00:00.000Z",
      platform: "linux",
      cpuCount: 8,
      results: [
        {
          framework: "koa",
          workload: "plaintext",
          workers: 1,
          mode: "single-worker",
          concurrency: 50,
          warmupSeconds: 10,
          measureSeconds: 30,
          executionModel: "multi-process",
          requestsPerSec: 12345.67,
          p50Ms: 1.11,
          p95Ms: 2.22,
          p99Ms: 3.33,
          maxMs: 4.44,
          errorRate: undefined,
          peakRssMb: 64.5,
          avgCpuPercent: 88.9,
          notes: [],
        },
      ],
    } as BenchmarkSessionReport;

    const markdown = renderMarkdown(report);

    expect(markdown).toContain("| koa | multi-process | 1 | 50 | passed | 12345.67 | - | - | 2.22 | 64.50 | 88.90 |  |");
    expect(markdown).not.toContain("NaN%");
  });

  test("renders skipped runtime failure rows with diagnostic notes", () => {
    const report: BenchmarkSessionReport = {
      generatedAt: "2026-05-01T12:00:00.000Z",
      platform: "linux",
      cpuCount: 8,
      results: [
        {
          framework: "koa",
          workload: "plaintext",
          workers: 2,
          mode: "multi-worker",
          concurrency: 100,
          warmupSeconds: 10,
          measureSeconds: 30,
          executionModel: "single-process-event-loop",
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
          ],
        },
      ],
    };

    const markdown = renderMarkdown(report);

    expect(markdown).toContain(
      "| koa | single-process-event-loop | 2 | 100 | skipped | - | - | - | - | - | - | benchmark case skipped: Command failed (42): bun run bench; exit code: 42; stdout: stdout line |",
    );
    expect(markdown).toContain(
      "- koa plaintext workers=2 c=100 skipped: benchmark case skipped: Command failed (42): bun run bench; exit code: 42; stdout: stdout line",
    );
  });
});
