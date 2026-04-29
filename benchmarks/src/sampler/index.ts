import os from "node:os";

import type { PlatformKind, ResourceMetrics, ResourceSample } from "../types";
import { summarizeSamples } from "./common";
import { sampleDarwinProcessTree } from "./darwin";
import { sampleLinuxProcessTree } from "./linux";
import { sampleWindowsProcessTree } from "./windows";

function detectPlatform(): PlatformKind {
  if (process.platform === "darwin") {
    return "darwin";
  }

  if (process.platform === "linux") {
    return "linux";
  }

  if (process.platform === "win32") {
    return "windows";
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

async function sampleOnce(rootPid: number): Promise<ResourceSample> {
  const platform = detectPlatform();
  if (platform === "darwin") {
    return sampleDarwinProcessTree(rootPid);
  }

  if (platform === "linux") {
    return sampleLinuxProcessTree(rootPid);
  }

  return sampleWindowsProcessTree(rootPid);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startSampler(rootPid: number, intervalMs = 250): Promise<{
  stop: () => Promise<ResourceSample[]>;
}> {
  const samples: ResourceSample[] = [await sampleOnce(rootPid)];
  let stopped = false;
  let loopError: unknown = null;

  const loop = (async () => {
    while (!stopped) {
      await sleep(intervalMs);
      if (stopped) {
        break;
      }

      try {
        samples.push(await sampleOnce(rootPid));
      } catch (error) {
        loopError = error;
        break;
      }
    }
  })();

  return {
    async stop() {
      stopped = true;
      await loop;

      try {
        samples.push(await sampleOnce(rootPid));
      } catch (error) {
        if (loopError === null) {
          loopError = error;
        }
      }

      if (loopError !== null) {
        throw loopError;
      }

      return samples;
    },
  };
}

export function summarizeResourceSamples(samples: readonly ResourceSample[]): ResourceMetrics {
  const cpuCount = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length;
  return summarizeSamples(samples, cpuCount);
}
