import os from "node:os";
import { readFile } from "node:fs/promises";

import type { PlatformKind, SystemMetadata } from "./types";

function firstNonEmptyLine(text: string): string | null {
  const line = text
    .split("\n")
    .map((entry) => entry.trim())
    .find(Boolean);

  return line ?? null;
}

async function runCommand(cmd: string[]): Promise<string | null> {
  try {
    const child = Bun.spawn({
      cmd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutPromise = new Response(child.stdout).text();
    const stderrPromise = new Response(child.stderr).text();
    const exitCode = await child.exited;
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

    if (exitCode !== 0) {
      return null;
    }

    return firstNonEmptyLine(`${stdout}\n${stderr}`);
  } catch {
    return null;
  }
}

async function readLinuxOsRelease(): Promise<{
  prettyName: string | null;
  versionId: string | null;
}> {
  try {
    const text = await readFile("/etc/os-release", "utf8");
    const lines = text.split("\n");
    const readField = (name: string) => {
      const raw = lines.find((line) => line.startsWith(`${name}=`));
      if (!raw) {
        return null;
      }

      return raw.slice(name.length + 1).replace(/^"/, "").replace(/"$/, "");
    };

    return {
      prettyName: readField("PRETTY_NAME"),
      versionId: readField("VERSION_ID"),
    };
  } catch {
    return {
      prettyName: null,
      versionId: null,
    };
  }
}

function toInteger(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function readLinuxPhysicalCpuCount(): Promise<number | null> {
  const child = Bun.spawn({
    cmd: ["lscpu"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

  if (exitCode !== 0) {
    return null;
  }

  const text = `${stdout}\n${stderr}`;
  const coresPerSocket = text
    .split("\n")
    .find((line) => line.startsWith("Core(s) per socket:"))
    ?.split(":")[1]
    ?.trim();
  const sockets = text
    .split("\n")
    .find((line) => line.startsWith("Socket(s):"))
    ?.split(":")[1]
    ?.trim();

  const coreCount = Number(coresPerSocket);
  const socketCount = Number(sockets);
  if (!Number.isFinite(coreCount) || !Number.isFinite(socketCount)) {
    return null;
  }

  return coreCount * socketCount;
}

export async function collectSystemMetadata(platform: PlatformKind): Promise<SystemMetadata> {
  const logicalCpuCount =
    typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  const hostname = os.hostname();
  const fallbackCpuModel = os.cpus()[0]?.model ?? "unknown";

  if (platform === "darwin") {
    const [productName, productVersion, cpuModel, physicalCpuCountRaw, memoryBytesRaw] =
      await Promise.all([
        runCommand(["sw_vers", "-productName"]),
        runCommand(["sw_vers", "-productVersion"]),
        runCommand(["sysctl", "-n", "machdep.cpu.brand_string"]),
        runCommand(["sysctl", "-n", "hw.physicalcpu"]),
        runCommand(["sysctl", "-n", "hw.memsize"]),
      ]);

    return {
      osName: productName ?? "macOS",
      osVersion: productVersion ?? os.release(),
      kernelVersion: os.release(),
      architecture: os.arch(),
      cpuModel: cpuModel ?? fallbackCpuModel,
      logicalCpuCount,
      physicalCpuCount: toInteger(physicalCpuCountRaw),
      totalMemoryBytes: Number(memoryBytesRaw ?? os.totalmem()),
      hostname: hostname || null,
    };
  }

  if (platform === "linux") {
    const [{ prettyName, versionId }, cpuModel] = await Promise.all([
      readLinuxOsRelease(),
      runCommand(["sh", "-lc", "grep -m1 '^model name' /proc/cpuinfo | cut -d: -f2-"]),
    ]);

    return {
      osName: prettyName ?? os.type(),
      osVersion: versionId ?? os.version(),
      kernelVersion: os.release(),
      architecture: os.arch(),
      cpuModel: cpuModel ?? fallbackCpuModel,
      logicalCpuCount,
      physicalCpuCount: await readLinuxPhysicalCpuCount(),
      totalMemoryBytes: os.totalmem(),
      hostname: hostname || null,
    };
  }

  return {
    osName: os.type(),
    osVersion: os.release(),
    kernelVersion: os.version(),
    architecture: os.arch(),
    cpuModel: fallbackCpuModel,
    logicalCpuCount,
    physicalCpuCount: null,
    totalMemoryBytes: os.totalmem(),
    hostname: hostname || null,
  };
}
