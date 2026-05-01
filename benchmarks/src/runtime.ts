import { summarizeFailureNotes } from "./failures";
import {
  buildFrameworkSkipResults,
  buildSessionSkipResults,
  buildSkippedCaseResult,
  type SkippedFramework,
} from "./skip-results";
import type { BenchmarkCase, BenchmarkOptions, CaseResult, ExecutionModel, FrameworkId } from "./types";

function missingGlobalCommandNote(missingCommands: string[]): string {
  if (missingCommands.length === 1) {
    return `missing required global command: ${missingCommands[0]}`;
  }

  return `missing required global commands: ${missingCommands.join(", ")}`;
}

export function buildGlobalCommandSkipResults(options: {
  options: BenchmarkOptions;
  missingCommands: string[];
  skippedFrameworks: SkippedFramework[];
}): CaseResult[] {
  const skippedFrameworks = new Set(options.skippedFrameworks.map((framework) => framework.framework));
  const frameworks = options.options.frameworks.filter((framework) => !skippedFrameworks.has(framework));

  if (frameworks.length === 0 || options.missingCommands.length === 0) {
    return [];
  }

  return buildSessionSkipResults({
    options: {
      ...options.options,
      frameworks,
    },
    notes: [missingGlobalCommandNote(options.missingCommands)],
  });
}

interface PrepareFrameworksWithSkipsOptions {
  options: BenchmarkOptions;
  frameworks: FrameworkId[];
  prepareFramework: (framework: FrameworkId) => Promise<void>;
}

interface FailureLike {
  message?: unknown;
  exitCode?: unknown;
  stdout?: unknown;
  stderr?: unknown;
}

function mergeFailureStreamDetails(primary: unknown, secondary: unknown): string | undefined {
  const values = [primary, secondary]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  return [...new Set(values)].join(" | ");
}

function failureNotes(error: unknown): string[] {
  const failure = error as FailureLike;

  return summarizeFailureNotes({
    message: error instanceof Error ? error.message : String(failure.message ?? error),
    exitCode: typeof failure.exitCode === "number" ? failure.exitCode : undefined,
    stdout: typeof failure.stdout === "string" ? failure.stdout : undefined,
    stderr: typeof failure.stderr === "string" ? failure.stderr : undefined,
  });
}

export function buildCaseFailureSkipResult(options: {
  case: BenchmarkCase;
  executionModel: ExecutionModel;
  warmupSeconds: number;
  measureSeconds: number;
  error: unknown;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}): CaseResult {
  const failure = options.error as FailureLike;
  const notes = summarizeFailureNotes({
    message:
      options.error instanceof Error
        ? options.error.message
        : String(failure.message ?? "benchmark execution failed"),
    exitCode: options.exitCode ?? (typeof failure.exitCode === "number" ? failure.exitCode : undefined),
    stdout: mergeFailureStreamDetails(failure.stdout, options.stdout),
    stderr: mergeFailureStreamDetails(failure.stderr, options.stderr),
  });
  const [message, ...details] = notes;

  return buildSkippedCaseResult({
    ...options.case,
    executionModel: options.executionModel,
    warmupSeconds: options.warmupSeconds,
    measureSeconds: options.measureSeconds,
    notes: [`benchmark case skipped: ${message}`, ...details],
  });
}

export async function prepareFrameworksWithSkips(options: PrepareFrameworksWithSkipsOptions): Promise<{
  availableFrameworks: FrameworkId[];
  skippedFrameworks: SkippedFramework[];
  skipResults: CaseResult[];
}> {
  const availableFrameworks: FrameworkId[] = [];
  const skippedFrameworks: SkippedFramework[] = [];

  for (const framework of options.frameworks) {
    try {
      await options.prepareFramework(framework);
      availableFrameworks.push(framework);
    } catch (error) {
      skippedFrameworks.push({
        framework,
        missingCommands: [],
        notes: failureNotes(error),
      });
    }
  }

  return {
    availableFrameworks,
    skippedFrameworks,
    skipResults: buildFrameworkSkipResults({
      options: options.options,
      skippedFrameworks,
    }),
  };
}
