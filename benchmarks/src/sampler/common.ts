import type { ProcessRow, ResourceMetrics, ResourceSample } from "../types";

export function parsePsCpuTimeSeconds(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("ps cpu time cannot be empty");
  }

  const [dayPart, remainder] = trimmed.includes("-")
    ? trimmed.split("-", 2)
    : [undefined, trimmed];
  const dayCount = dayPart === undefined ? 0 : Number(dayPart);
  const fields = remainder.split(":");
  const secondField = fields.pop();

  if (secondField === undefined) {
    throw new Error(`Invalid ps cpu time: ${raw}`);
  }

  const seconds = Number(secondField);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Invalid ps cpu time seconds: ${raw}`);
  }

  let minutes = 0;
  let hours = 0;

  if (fields.length === 1) {
    minutes = Number(fields[0]);
  } else if (fields.length === 2) {
    hours = Number(fields[0]);
    minutes = Number(fields[1]);
  } else if (fields.length > 2) {
    throw new Error(`Unsupported ps cpu time format: ${raw}`);
  }

  return dayCount * 86_400 + hours * 3_600 + minutes * 60 + seconds;
}

export function parsePsProcessTable(output: string): ProcessRow[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        throw new Error(`Unexpected ps row: ${line}`);
      }

      const [pidRaw, ppidRaw, rssRaw, timeRaw] = parts;
      return {
        pid: Number(pidRaw),
        ppid: Number(ppidRaw),
        rssBytes: Number(rssRaw) * 1024,
        cpuTimeSeconds: parsePsCpuTimeSeconds(timeRaw),
      };
    });
}

export function aggregateProcessTree(
  rows: readonly ProcessRow[],
  rootPid: number,
): { rssBytes: number; cpuTimeSeconds: number; processCount: number } {
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const branch = children.get(row.ppid) ?? [];
    branch.push(row.pid);
    children.set(row.ppid, branch);
  }

  const rowByPid = new Map(rows.map((row) => [row.pid, row]));
  const queue = [rootPid];
  const visited = new Set<number>();
  let rssBytes = 0;
  let cpuTimeSeconds = 0;

  while (queue.length > 0) {
    const pid = queue.shift()!;
    if (visited.has(pid)) {
      continue;
    }

    visited.add(pid);
    const row = rowByPid.get(pid);
    if (!row) {
      continue;
    }

    rssBytes += row.rssBytes;
    cpuTimeSeconds += row.cpuTimeSeconds;

    for (const childPid of children.get(pid) ?? []) {
      queue.push(childPid);
    }
  }

  return {
    rssBytes,
    cpuTimeSeconds,
    processCount: visited.size,
  };
}

export function windowsTicksToSeconds(raw: string | number | bigint): number {
  const ticks = typeof raw === "bigint" ? raw : BigInt(String(raw));
  return Number(ticks) / 10_000_000;
}

export function summarizeSamples(
  samples: readonly ResourceSample[],
  cpuCount: number,
): ResourceMetrics {
  if (samples.length === 0) {
    return {
      peakRssMb: 0,
      avgCpuPercent: 0,
    };
  }

  const peakRssBytes = samples.reduce((highest, sample) => Math.max(highest, sample.rssBytes), 0);
  const first = samples[0];
  const last = samples[samples.length - 1];
  const wallSeconds = Math.max((last.timestampMs - first.timestampMs) / 1000, 0.001);
  const cpuSeconds = Math.max(last.cpuTimeSeconds - first.cpuTimeSeconds, 0);

  return {
    peakRssMb: Number((peakRssBytes / (1024 * 1024)).toFixed(3)),
    avgCpuPercent: Number((((cpuSeconds / wallSeconds) / cpuCount) * 100).toFixed(3)),
  };
}
