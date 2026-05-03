import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveGoExecutable, resolveSpringBootJavaExecutable, resolveSpringBootJavaHome } from "./executables";
import type { CommandResult, CommandSpec, ToolchainMetadata } from "./types";

export function normalizeCommandVersionOutput(output: string): string | null {
  const firstLine = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/^-{3,}$/.test(line));

  return firstLine ?? null;
}

async function readVersionLine(
  runCommand: (spec: CommandSpec) => Promise<CommandResult>,
  description: string,
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<string | null> {
  try {
    const result = await runCommand({
      description,
      cmd,
      cwd,
      env,
      silent: true,
    });
    return normalizeCommandVersionOutput(`${result.stdout}\n${result.stderr}`);
  } catch {
    return null;
  }
}

async function readCMakeCompiler(cachePath: string, key: string): Promise<string | null> {
  try {
    const text = await readFile(cachePath, "utf8");
    const line = text.split("\n").find((entry) => entry.startsWith(`${key}:FILEPATH=`));

    return line ? line.split("=", 2)[1] : null;
  } catch {
    return null;
  }
}

async function firstAvailableCachePath(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      await readFile(path, "utf8");
      return path;
    } catch {
      continue;
    }
  }

  return null;
}

function versionCommandForPython(): string[] {
  if (process.env.BENCHMARK_PYTHON) {
    return [process.env.BENCHMARK_PYTHON, "--version"];
  }

  return process.platform === "win32" ? ["python", "--version"] : ["python3", "--version"];
}

function gradleCommand(benchmarksRoot: string): { cmd: string[]; cwd: string } {
  const appDir = join(benchmarksRoot, "apps", "springboot");

  if (process.platform === "win32") {
    if (existsSync(join(appDir, "gradlew.bat"))) {
      return {
        cmd: ["gradlew.bat", "--version"],
        cwd: appDir,
      };
    }

    return {
      cmd: ["gradle", "--version"],
      cwd: appDir,
    };
  }

  if (existsSync(join(appDir, "gradlew"))) {
    return {
      cmd: ["./gradlew", "--version"],
      cwd: appDir,
    };
  }

  return {
    cmd: ["gradle", "--version"],
    cwd: appDir,
  };
}

function detectPlatform() {
  if (process.platform === "win32") {
    return "windows" as const;
  }

  if (process.platform === "darwin") {
    return "darwin" as const;
  }

  return "linux" as const;
}

function gradleVersionEnv(benchmarksRoot: string): Record<string, string> {
  const appDir = join(benchmarksRoot, "apps", "springboot");
  const env: Record<string, string> = {
    GRADLE_USER_HOME: join(appDir, ".gradle-home"),
    ORG_GRADLE_VFS_WATCH: "false",
  };
  const javaHome = resolveSpringBootJavaHome(detectPlatform());

  if (javaHome !== null) {
    env.JAVA_HOME = javaHome;
  }

  return env;
}

export async function collectToolchainMetadata(
  runCommand: (spec: CommandSpec) => Promise<CommandResult>,
  benchmarksRoot: string,
  repoRoot: string,
): Promise<ToolchainMetadata> {
  const read = (description: string, cmd: string[], cwd = benchmarksRoot) =>
    readVersionLine(runCommand, description, cmd, cwd);
  const readWithEnv = (description: string, cmd: string[], cwd: string, env: Record<string, string>) =>
    readVersionLine(runCommand, description, cmd, cwd, env);
  const cachePath =
    (await firstAvailableCachePath([
      join(repoRoot, "build", "benchmark-echonexus", "CMakeCache.txt"),
      join(repoRoot, "build", "benchmark-native", "CMakeCache.txt"),
    ])) ?? "";
  const [cCompiler, cxxCompiler] = await Promise.all([
    readCMakeCompiler(cachePath, "CMAKE_C_COMPILER"),
    readCMakeCompiler(cachePath, "CMAKE_CXX_COMPILER"),
  ]);
  const gradleSpec = gradleCommand(benchmarksRoot);
  const platform = detectPlatform();
  const [bun, node, python, go, java, gradle, cargo, rustc, cmake, oha, cCompilerVersion, cxxCompilerVersion] =
    await Promise.all([
      read("Read Bun version", ["bun", "--version"]),
      read("Read Node version", ["node", "--version"]),
      read("Read Python version", versionCommandForPython()),
      read("Read Go version", [resolveGoExecutable(platform), "version"]),
      read("Read Java version", [resolveSpringBootJavaExecutable(platform), "-version"]),
      readWithEnv("Read Gradle version", gradleSpec.cmd, gradleSpec.cwd, gradleVersionEnv(benchmarksRoot)),
      read("Read Cargo version", ["cargo", "--version"]),
      read("Read Rustc version", ["rustc", "--version"]),
      read("Read CMake version", ["cmake", "--version"]),
      read("Read oha version", ["oha", "--version"]),
      cCompiler ? read("Read C compiler version", [cCompiler, "--version"], repoRoot) : null,
      cxxCompiler ? read("Read CXX compiler version", [cxxCompiler, "--version"], repoRoot) : null,
    ]);

  return {
    bun,
    node,
    python,
    go,
    java,
    gradle,
    cargo,
    rustc,
    cmake,
    oha,
    cCompiler,
    cCompilerVersion: await cCompilerVersion,
    cxxCompiler,
    cxxCompilerVersion: await cxxCompilerVersion,
  };
}
