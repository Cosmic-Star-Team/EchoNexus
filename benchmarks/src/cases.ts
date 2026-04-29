import {
  FRAMEWORK_IDS,
  PRESET_NAMES,
  WORKLOAD_IDS,
  type BenchmarkCase,
  type BenchmarkOptions,
  type BenchmarkMode,
  type PresetDuration,
  type PresetName,
  type WorkloadId,
} from "./types";

export { FRAMEWORK_IDS, PRESET_NAMES, WORKLOAD_IDS } from "./types";

export const PRESET_DURATIONS: Record<PresetName, PresetDuration> = {
  smoke: {
    warmupSeconds: 2,
    measureSeconds: 5,
    cooldownSeconds: 1,
  },
  pilot: {
    warmupSeconds: 5,
    measureSeconds: 10,
    cooldownSeconds: 2,
  },
  full: {
    warmupSeconds: 10,
    measureSeconds: 30,
    cooldownSeconds: 5,
  },
};

export const WORKLOAD_PATHS: Record<WorkloadId, string> = {
  plaintext: "/plaintext",
  json: "/json",
  time_json: "/time_json",
  param_json_middleware: "/api/v1/users/123/profile",
};

export function isPresetName(value: string): value is PresetName {
  return PRESET_NAMES.includes(value as PresetName);
}

function modeFromWorkers(workers: number): BenchmarkMode {
  return workers > 1 ? "multi-worker" : "single-worker";
}

function assertNonEmptyList<T>(values: T[], label: string): void {
  if (values.length === 0) {
    throw new Error(`Expected at least one ${label}`);
  }
}

function validateFrameworks(frameworks: string[]): void {
  assertNonEmptyList(frameworks, "framework");

  for (const framework of frameworks) {
    if (!FRAMEWORK_IDS.includes(framework as (typeof FRAMEWORK_IDS)[number])) {
      throw new Error(`Invalid framework: ${framework}`);
    }
  }
}

function validateWorkloads(workloads: string[]): void {
  assertNonEmptyList(workloads, "workload");

  for (const workload of workloads) {
    if (!WORKLOAD_IDS.includes(workload as (typeof WORKLOAD_IDS)[number])) {
      throw new Error(`Invalid workload: ${workload}`);
    }
  }
}

function validatePositiveIntegers(
  values: number[],
  label: "workers" | "concurrency",
  singularLabel: "worker" | "concurrency",
): void {
  assertNonEmptyList(values, singularLabel);

  for (const value of values) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid ${label} value: ${value}`);
    }
  }
}

function validateExplicitInput(options: Pick<
  BenchmarkOptions,
  "frameworks" | "workloads" | "workers" | "concurrency"
>): void {
  validateFrameworks(options.frameworks);
  validateWorkloads(options.workloads);
  validatePositiveIntegers(options.workers, "workers", "worker");
  validatePositiveIntegers(options.concurrency, "concurrency", "concurrency");
}

function buildExplicitCases(options: Pick<
  BenchmarkOptions,
  "frameworks" | "workloads" | "workers" | "concurrency"
>): BenchmarkCase[] {
  validateExplicitInput(options);

  return options.frameworks.flatMap((framework) =>
    options.workloads.flatMap((workload) =>
      options.workers.flatMap((workers) =>
        options.concurrency.map((concurrency) => ({
          framework,
          workload,
          workers,
          mode: modeFromWorkers(workers),
          concurrency,
        })),
      ),
    ),
  );
}

function buildLegacyPresetCases(preset: PresetName): BenchmarkCase[] {
  if (preset === "smoke") {
    return buildExplicitCases({
      frameworks: [...FRAMEWORK_IDS],
      workloads: ["plaintext"],
      workers: [1],
      concurrency: [50],
    });
  }

  if (preset === "pilot") {
    return buildExplicitCases({
      frameworks: [...FRAMEWORK_IDS],
      workloads: ["plaintext", "json"],
      workers: [1],
      concurrency: [50, 200],
    });
  }

  return buildExplicitCases({
    frameworks: [...FRAMEWORK_IDS],
    workloads: [...WORKLOAD_IDS],
    workers: [1, 4],
    concurrency: [50, 200, 500],
  });
}

export function buildCases(preset: PresetName): BenchmarkCase[];
export function buildCases(
  options: Pick<BenchmarkOptions, "frameworks" | "workloads" | "workers" | "concurrency">,
): BenchmarkCase[];
export function buildCases(
  input:
    | PresetName
    | Pick<BenchmarkOptions, "frameworks" | "workloads" | "workers" | "concurrency">,
): BenchmarkCase[] {
  if (typeof input === "string") {
    if (!isPresetName(input)) {
      throw new Error(`Unknown preset: ${input}`);
    }

    return buildLegacyPresetCases(input);
  }

  return buildExplicitCases({
    frameworks: input.frameworks,
    workloads: input.workloads,
    workers: input.workers,
    concurrency: input.concurrency,
  });
}
