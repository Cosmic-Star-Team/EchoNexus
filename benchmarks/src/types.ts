export const FRAMEWORK_IDS = [
  "echonexus",
  "fastapi",
  "flask",
  "koa",
  "elysia",
  "axum",
  "gin",
  "springboot",
] as const;

export const WORKLOAD_IDS = [
  "plaintext",
  "json",
  "time_json",
  "param_json_middleware",
] as const;

export const PRESET_NAMES = ["smoke", "pilot", "full"] as const;

export type FrameworkId = (typeof FRAMEWORK_IDS)[number];
export type WorkloadId = (typeof WORKLOAD_IDS)[number];
export type PresetName = (typeof PRESET_NAMES)[number];
export type BuildProfile = "debug" | "release";
export type BenchmarkMode = "single-worker" | "multi-worker";
export type PlatformKind = "darwin" | "linux" | "windows";
export type ExecutionModel =
  | "runtime-threaded"
  | "multi-process"
  | "thread-pool"
  | "single-process-event-loop"
  | "servlet-thread-pool";
export type BenchmarkStatus = "passed" | "skipped" | "failed";

export interface PresetDuration {
  warmupSeconds: number;
  measureSeconds: number;
  cooldownSeconds: number;
}

export interface BenchmarkCase {
  framework: FrameworkId;
  workload: WorkloadId;
  workers: number;
  mode: BenchmarkMode;
  concurrency: number;
}

export interface BenchmarkOptions {
  frameworks: FrameworkId[];
  workloads: WorkloadId[];
  workers: number[];
  concurrency: number[];
  buildProfile: BuildProfile;
  warmupSeconds: number;
  measureSeconds: number;
  cooldownSeconds: number;
  outputTag?: string;
  setupOnly: boolean;
}

export interface BenchmarkSessionConfig {
  frameworks: FrameworkId[];
  workloads: WorkloadId[];
  workers: number[];
  concurrency: number[];
  buildProfile: BuildProfile;
  warmupSeconds: number;
  measureSeconds: number;
  cooldownSeconds: number;
  outputTag?: string;
}

export interface LoadMetrics {
  requestsPerSec: number | null;
  successRequestsPerSec?: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
  errorRate: number | null;
}

export interface ProcessRow {
  pid: number;
  ppid: number;
  rssBytes: number;
  cpuTimeSeconds: number;
}

export interface ResourceSample {
  timestampMs: number;
  rssBytes: number;
  cpuTimeSeconds: number;
  processCount: number;
}

export interface ResourceMetrics {
  peakRssMb: number | null;
  avgCpuPercent: number | null;
}

export interface CaseResult extends BenchmarkCase, LoadMetrics, ResourceMetrics {
  executionModel?: ExecutionModel;
  warmupSeconds: number;
  measureSeconds: number;
  status?: BenchmarkStatus;
  notes: string[];
}

export type ReportMetadataValue = string | number | boolean | null | undefined;
export type ReportMetadata = Record<string, ReportMetadataValue>;

export interface SystemMetadata {
  osName: string;
  osVersion: string;
  kernelVersion: string;
  architecture: string;
  cpuModel: string;
  logicalCpuCount: number;
  physicalCpuCount: number | null;
  totalMemoryBytes: number;
  hostname: string | null;
}

export interface ToolchainMetadata {
  bun: string | null;
  node: string | null;
  python: string | null;
  go: string | null;
  java: string | null;
  gradle: string | null;
  cargo: string | null;
  rustc: string | null;
  cmake: string | null;
  oha: string | null;
  cCompiler: string | null;
  cCompilerVersion: string | null;
  cxxCompiler: string | null;
  cxxCompilerVersion: string | null;
}

export interface CommandSpec {
  description: string;
  cmd: string[];
  cwd: string;
  env?: Record<string, string>;
  silent?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface WorkerSupport {
  supported: boolean;
  reason?: string;
}

export interface SetupContext {
  repoRoot: string;
  benchmarksRoot: string;
  platform: PlatformKind;
  buildProfile: BuildProfile;
}

export interface LaunchContext extends SetupContext {
  port: number;
  workers: number;
  mode: BenchmarkMode;
}

export interface LaunchPlan {
  cmd: string[];
  cwd: string;
  env?: Record<string, string>;
  notes: string[];
}

export interface FrameworkConfig {
  id: FrameworkId;
  displayName: string;
  executionModel: ExecutionModel;
  appDir: string;
  setup: (context: SetupContext) => CommandSpec[];
  supportsWorkers: (context: { platform: PlatformKind; workers: number }) => WorkerSupport;
  launch: (context: LaunchContext) => LaunchPlan;
}

export interface BenchmarkSessionReport {
  generatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  totalDurationSeconds?: number;
  preset?: PresetName;
  config?: BenchmarkSessionConfig;
  platform: PlatformKind;
  cpuCount: number;
  system?: SystemMetadata;
  toolchains?: ToolchainMetadata;
  results: CaseResult[];
}
