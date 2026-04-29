import type { ResourceSample } from "../types";
import { aggregateProcessTree, parsePsProcessTable } from "./common";

export async function sampleLinuxProcessTree(rootPid: number): Promise<ResourceSample> {
  const process = Bun.spawn({
    cmd: ["ps", "-axo", "pid=,ppid=,rss=,time="],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  const exitCode = await process.exited;

  if (exitCode !== 0) {
    throw new Error(`ps failed on Linux: ${stderr.trim()}`);
  }

  const totals = aggregateProcessTree(parsePsProcessTable(stdout), rootPid);
  return {
    timestampMs: Date.now(),
    ...totals,
  };
}
