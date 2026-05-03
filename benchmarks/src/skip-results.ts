import { FRAMEWORKS } from "../configs/frameworks";
import { buildCases } from "./cases";
import type { BenchmarkCase, BenchmarkOptions, CaseResult, ExecutionModel, FrameworkId } from "./types";

export interface SkippedFramework {
  framework: FrameworkId;
  missingCommands: string[];
  notes: string[];
}

function nullMetrics(): Pick<
  CaseResult,
  | "requestsPerSec"
  | "successRequestsPerSec"
  | "p50Ms"
  | "p95Ms"
  | "p99Ms"
  | "maxMs"
  | "errorRate"
  | "peakRssMb"
  | "avgCpuPercent"
> {
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

export function buildSkippedCaseResult(
  options: BenchmarkCase &
    Omit<Pick<CaseResult, "executionModel" | "warmupSeconds" | "measureSeconds" | "notes">, "executionModel"> & {
      executionModel: ExecutionModel;
    },
): CaseResult {
  return {
    ...options,
    ...nullMetrics(),
    status: "skipped",
    notes: [...options.notes],
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
    }).map((benchmarkCase) =>
      buildSkippedCaseResult({
        ...benchmarkCase,
        executionModel: FRAMEWORKS[skippedFramework.framework].executionModel,
        warmupSeconds: options.options.warmupSeconds,
        measureSeconds: options.options.measureSeconds,
        notes: skippedFramework.notes,
      }),
    ),
  );
}

export function buildSessionSkipResults(options: {
  options: BenchmarkOptions;
  notes: string[];
}): CaseResult[] {
  return buildCases(options.options).map((benchmarkCase) =>
    buildSkippedCaseResult({
      ...benchmarkCase,
      executionModel: FRAMEWORKS[benchmarkCase.framework].executionModel,
      warmupSeconds: options.options.warmupSeconds,
      measureSeconds: options.options.measureSeconds,
      notes: options.notes,
    }),
  );
}
