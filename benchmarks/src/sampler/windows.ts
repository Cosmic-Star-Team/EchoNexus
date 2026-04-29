import type { ProcessRow, ResourceSample } from "../types";
import { aggregateProcessTree, windowsTicksToSeconds } from "./common";

interface WindowsProcessRecord {
  ProcessId: number;
  ParentProcessId: number;
  WorkingSetSize: string | number;
  KernelModeTime: string | number;
  UserModeTime: string | number;
}

function toRows(payload: WindowsProcessRecord | WindowsProcessRecord[]): ProcessRow[] {
  const items = Array.isArray(payload) ? payload : [payload];

  return items.map((item) => ({
    pid: Number(item.ProcessId),
    ppid: Number(item.ParentProcessId),
    rssBytes: Number(item.WorkingSetSize),
    cpuTimeSeconds:
      windowsTicksToSeconds(item.KernelModeTime) + windowsTicksToSeconds(item.UserModeTime),
  }));
}

export async function sampleWindowsProcessTree(rootPid: number): Promise<ResourceSample> {
  const script = [
    "$items = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, WorkingSetSize, KernelModeTime, UserModeTime",
    "$items | ConvertTo-Json -Compress",
  ].join("; ");
  const process = Bun.spawn({
    cmd: ["powershell.exe", "-NoProfile", "-Command", script],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  const exitCode = await process.exited;

  if (exitCode !== 0) {
    throw new Error(`PowerShell sampler failed: ${stderr.trim()}`);
  }

  const rows = toRows(JSON.parse(stdout) as WindowsProcessRecord | WindowsProcessRecord[]);
  const totals = aggregateProcessTree(rows, rootPid);
  return {
    timestampMs: Date.now(),
    ...totals,
  };
}
