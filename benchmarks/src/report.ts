import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  BenchmarkSessionConfig,
  BenchmarkSessionReport,
  CaseResult,
  SystemMetadata,
  ToolchainMetadata,
} from "./types";

function formatStamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatMetric(value: number | null | undefined, digits = 2): string {
  if (value == null) {
    return "-";
  }

  return formatNumber(value, digits);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }

  return `${formatNumber(value * 100)}%`;
}

function formatIntegerList(values: number[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return "-";
  }

  return values.join(", ");
}

function formatStringList(values: string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return "-";
  }

  return values.join(", ");
}

function formatMemoryBytes(bytes: number | null | undefined): string {
  if (bytes == null) {
    return "-";
  }

  const gib = bytes / 1024 / 1024 / 1024;
  return `${formatNumber(gib)} GiB (${bytes} bytes)`;
}

function renderConfigSummary(lines: string[], config: BenchmarkSessionConfig | undefined): void {
  if (config === undefined) {
    return;
  }

  lines.push("## Run Summary", "");
  lines.push(`- Frameworks: ${formatStringList(config.frameworks)}`);
  lines.push(`- Workloads: ${formatStringList(config.workloads)}`);
  lines.push(`- Workers: ${formatIntegerList(config.workers)}`);
  lines.push(`- Concurrency: ${formatIntegerList(config.concurrency)}`);
  lines.push(`- Build Profile: ${config.buildProfile}`);
  lines.push(`- Warmup Seconds: ${config.warmupSeconds}`);
  lines.push(`- Measure Seconds: ${config.measureSeconds}`);
  lines.push(`- Cooldown Seconds: ${config.cooldownSeconds}`);

  if (config.outputTag) {
    lines.push(`- Output Tag: ${config.outputTag}`);
  }

  lines.push("");
}

function renderSystem(lines: string[], system: SystemMetadata | undefined): void {
  if (system === undefined) {
    return;
  }

  lines.push("## System", "");
  lines.push(`- OS: ${system.osName}`);
  lines.push(`- OS Version: ${system.osVersion}`);
  lines.push(`- Kernel Version: ${system.kernelVersion}`);
  lines.push(`- Architecture: ${system.architecture}`);
  lines.push(`- CPU Model: ${system.cpuModel}`);
  lines.push(`- Logical CPU Count: ${system.logicalCpuCount}`);
  lines.push(`- Physical CPU Count: ${system.physicalCpuCount ?? "-"}`);
  lines.push(`- Total Memory: ${formatMemoryBytes(system.totalMemoryBytes)}`);

  if (system.hostname) {
    lines.push(`- Hostname: ${system.hostname}`);
  }

  lines.push("");
}

function renderToolchains(lines: string[], toolchains: ToolchainMetadata | undefined): void {
  if (toolchains === undefined) {
    return;
  }

  const entries: Array<[string, string | null]> = [
    ["Bun", toolchains.bun],
    ["Node", toolchains.node],
    ["Python", toolchains.python],
    ["Go", toolchains.go],
    ["Java", toolchains.java],
    ["Gradle", toolchains.gradle],
    ["Cargo", toolchains.cargo],
    ["Rustc", toolchains.rustc],
    ["CMake", toolchains.cmake],
    ["oha", toolchains.oha],
    ["C Compiler", toolchains.cCompiler],
    ["C Compiler Version", toolchains.cCompilerVersion],
    ["CXX Compiler", toolchains.cxxCompiler],
    ["CXX Compiler Version", toolchains.cxxCompilerVersion],
  ];
  const populated = entries.filter(([, value]) => value !== null);

  if (populated.length === 0) {
    return;
  }

  lines.push("## Toolchains", "");
  for (const [label, value] of populated) {
    lines.push(`- ${label}: ${value}`);
  }
  lines.push("");
}

function renderResultTable(lines: string[], results: CaseResult[]): void {
  lines.push(
    "| Framework | Execution Model | Workers | Concurrency | Status | QPS | Success QPS | Err % | p95 ms | Peak RSS MB | Avg CPU % | Notes |",
    "| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  );

  for (const result of results) {
    lines.push(
      [
        "|",
        result.framework,
        "|",
        result.executionModel ?? "-",
        "|",
        result.workers,
        "|",
        result.concurrency,
        "|",
        result.status ?? "passed",
        "|",
        formatMetric(result.requestsPerSec),
        "|",
        formatMetric(result.successRequestsPerSec),
        "|",
        formatPercent(result.errorRate),
        "|",
        formatMetric(result.p95Ms),
        "|",
        formatMetric(result.peakRssMb),
        "|",
        formatMetric(result.avgCpuPercent),
        "|",
        result.notes.join("; "),
        "|",
      ].join(" "),
    );
  }
}

function renderGroupedResults(lines: string[], report: BenchmarkSessionReport): void {
  const workloadOrder = report.config?.workloads ?? [];
  const resultsByWorkload = new Map<string, CaseResult[]>();

  for (const result of report.results) {
    const group = resultsByWorkload.get(result.workload) ?? [];
    group.push(result);
    resultsByWorkload.set(result.workload, group);
  }

  const workloadNames = [...resultsByWorkload.keys()].sort((left, right) => {
    const leftIndex = workloadOrder.indexOf(left as (typeof workloadOrder)[number]);
    const rightIndex = workloadOrder.indexOf(right as (typeof workloadOrder)[number]);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });

  lines.push("## Results", "");

  for (const workload of workloadNames) {
    lines.push(`### ${workload}`, "");
    const results = resultsByWorkload.get(workload)!;
    const workers = [...new Set(results.map((result) => result.workers))].sort((left, right) => left - right);

    for (const workerCount of workers) {
      lines.push(`#### workers=${workerCount}`, "");

      const rows = results
        .filter((result) => result.workers === workerCount)
        .sort((left, right) => {
          if (left.framework !== right.framework) {
            return left.framework.localeCompare(right.framework);
          }

          return left.concurrency - right.concurrency;
        });

      renderResultTable(lines, rows);
      lines.push("");
    }
  }
}

function renderProblemSummary(lines: string[], results: CaseResult[]): void {
  const problemResults = results.filter((result) => (result.status ?? "passed") !== "passed");
  if (problemResults.length === 0) {
    return;
  }

  lines.push("## Skipped And Failed", "");
  for (const result of problemResults) {
    lines.push(
      `- ${result.framework} ${result.workload} workers=${result.workers} c=${result.concurrency} ${result.status ?? "passed"}: ${result.notes.join("; ") || "no details"}`,
    );
  }
  lines.push("");
}

function reportStem(report: BenchmarkSessionReport): string {
  const base = formatStamp(new Date());
  const outputTag = report.config?.outputTag?.trim();
  if (!outputTag) {
    return base;
  }

  const sanitized = outputTag.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return sanitized.length > 0 ? `${base}--${sanitized}` : base;
}

export function renderMarkdown(report: BenchmarkSessionReport): string {
  const lines = [
    "# Benchmark Report",
    "",
    `- Generated At: ${report.generatedAt}`,
    `- Platform: ${report.platform}`,
    `- Logical CPUs: ${report.cpuCount}`,
  ];

  if (report.startedAt) {
    lines.push(`- Started At: ${report.startedAt}`);
  }

  if (report.finishedAt) {
    lines.push(`- Finished At: ${report.finishedAt}`);
  }

  if (report.totalDurationSeconds !== undefined) {
    lines.push(`- Total Duration: ${formatNumber(report.totalDurationSeconds)}s`);
  }

  if (report.preset) {
    lines.push(`- Preset: ${report.preset}`);
  }

  lines.push("");
  renderConfigSummary(lines, report.config);
  renderSystem(lines, report.system);
  renderToolchains(lines, report.toolchains);
  renderGroupedResults(lines, report);
  renderProblemSummary(lines, report.results);

  return lines.join("\n");
}

export async function writeReportFiles(
  benchmarksRoot: string,
  report: BenchmarkSessionReport,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const stem = reportStem(report);
  const resultsDir = join(benchmarksRoot, "results");
  const jsonPath = join(resultsDir, `${stem}.json`);
  const markdownPath = join(resultsDir, `${stem}.md`);

  await mkdir(resultsDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderMarkdown(report)}\n`, "utf8");

  return { jsonPath, markdownPath };
}
