import { existsSync } from "node:fs";

import { FRAMEWORKS } from "../configs/frameworks";
import { buildCases } from "./cases";
import { resolveGoExecutable, resolveSpringBootJavaExecutable } from "./executables";
import type { BenchmarkOptions, CaseResult, FrameworkId, PlatformKind } from "./types";

export interface SkippedFramework {
  framework: FrameworkId;
  missingCommands: string[];
  notes: string[];
}

export interface FrameworkPreflightResult {
  availableFrameworks: FrameworkId[];
  skippedFrameworks: SkippedFramework[];
}

interface PreflightFrameworksOptions {
  platform: PlatformKind;
  frameworks: FrameworkId[];
  commandExists?: (command: string) => Promise<boolean>;
}

function pythonLauncher(platform: PlatformKind): string {
  if (process.env.BENCHMARK_PYTHON) {
    return process.env.BENCHMARK_PYTHON;
  }

  return platform === "windows" ? "python" : "python3";
}

export function frameworkRequiredCommands(platform: PlatformKind, framework: FrameworkId): string[] {
  switch (framework) {
    case "echonexus":
      return ["cmake"];
    case "fastapi":
    case "flask":
      return [pythonLauncher(platform)];
    case "koa":
    case "elysia":
      return ["node", "npm"];
    case "axum":
      return ["cargo", "rustc"];
    case "gin":
      return [resolveGoExecutable(platform)];
    case "springboot":
      return [resolveSpringBootJavaExecutable(platform)];
  }
}

function missingCommandNote(missingCommands: string[]): string {
  if (missingCommands.length === 1) {
    return `missing required framework SDK/command: ${missingCommands[0]}`;
  }

  return `missing required framework SDK/commands: ${missingCommands.join(", ")}`;
}

export async function commandExists(command: string): Promise<boolean> {
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command);
  }

  const child = Bun.spawn({
    cmd: [process.platform === "win32" ? "where.exe" : "which", command],
    stdout: "ignore",
    stderr: "ignore",
  });

  return (await child.exited) === 0;
}

export async function preflightFrameworks(
  options: PreflightFrameworksOptions,
): Promise<FrameworkPreflightResult> {
  const probe = options.commandExists ?? commandExists;
  const availableFrameworks: FrameworkId[] = [];
  const skippedFrameworks: SkippedFramework[] = [];

  for (const framework of options.frameworks) {
    const missingCommands: string[] = [];

    for (const command of frameworkRequiredCommands(options.platform, framework)) {
      if (!(await probe(command))) {
        missingCommands.push(command);
      }
    }

    if (missingCommands.length === 0) {
      availableFrameworks.push(framework);
      continue;
    }

    skippedFrameworks.push({
      framework,
      missingCommands,
      notes: [missingCommandNote(missingCommands)],
    });
  }

  return {
    availableFrameworks,
    skippedFrameworks,
  };
}

function emptyMetrics() {
  return {
    requestsPerSec: null,
    successRequestsPerSec: null,
    p50Ms: null,
    p95Ms: null,
    p99Ms: null,
    maxMs: null,
    errorRate: null,
    peakRssMb: null,
    avgCpuPercent: null,
  };
}

export function buildFrameworkSkipResults(options: {
  options: BenchmarkOptions;
  skippedFrameworks: SkippedFramework[];
}): CaseResult[] {
  return options.skippedFrameworks.flatMap((skippedFramework) =>
    buildCases({
      frameworks: [skippedFramework.framework],
      workloads: options.options.workloads,
      workers: options.options.workers,
      concurrency: options.options.concurrency,
    }).map((benchmarkCase) => ({
      ...benchmarkCase,
      ...emptyMetrics(),
      executionModel: FRAMEWORKS[skippedFramework.framework].executionModel,
      warmupSeconds: options.options.warmupSeconds,
      measureSeconds: options.options.measureSeconds,
      status: "skipped" as const,
      notes: [...skippedFramework.notes],
    })),
  );
}
