import { existsSync } from "node:fs";

import { resolveGoExecutable, resolveSpringBootJavaExecutable } from "./executables";
import { buildFrameworkSkipResults as buildSharedFrameworkSkipResults } from "./skip-results";
import type { SkippedFramework } from "./skip-results";
import type { BenchmarkOptions, CaseResult, FrameworkId, PlatformKind } from "./types";

export type { SkippedFramework } from "./skip-results";

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

export function buildFrameworkSkipResults(options: {
  options: BenchmarkOptions;
  skippedFrameworks: SkippedFramework[];
}): CaseResult[] {
  return buildSharedFrameworkSkipResults(options);
}
