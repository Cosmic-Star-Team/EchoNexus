import { existsSync } from "node:fs";
import { join } from "node:path";

import type { PlatformKind } from "./types";

interface ExecutableResolverOptions {
  env?: Record<string, string | undefined>;
  exists?: (path: string) => boolean;
}

function firstExisting(paths: string[], exists: (path: string) => boolean): string | null {
  for (const candidate of paths) {
    if (exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveGoExecutable(
  platform: PlatformKind,
  options: ExecutableResolverOptions = {},
): string {
  const env = options.env ?? process.env;
  const pathExists = options.exists ?? existsSync;
  const explicitGo = env.BENCHMARK_GO?.trim();

  if (explicitGo) {
    return explicitGo;
  }

  const goRoot = env.GOROOT?.trim();
  if (goRoot) {
    const goFromRoot = join(goRoot, "bin", platform === "windows" ? "go.exe" : "go");
    if (pathExists(goFromRoot)) {
      return goFromRoot;
    }
  }

  if (platform === "darwin") {
    return (
      firstExisting(
        [
          "/opt/homebrew/opt/go/bin/go",
          "/opt/homebrew/bin/go",
          "/usr/local/opt/go/bin/go",
          "/usr/local/bin/go",
        ],
        pathExists,
      ) ?? "go"
    );
  }

  if (platform === "windows") {
    const programFiles = env.ProgramFiles?.trim();
    if (programFiles) {
      const goInProgramFiles = join(programFiles, "Go", "bin", "go.exe");
      if (pathExists(goInProgramFiles)) {
        return goInProgramFiles;
      }
    }
  }

  return "go";
}

export function resolveSpringBootJavaHome(
  platform: PlatformKind,
  options: ExecutableResolverOptions = {},
): string | null {
  const env = options.env ?? process.env;
  const pathExists = options.exists ?? existsSync;
  const explicitJavaHome = env.BENCHMARK_JAVA_HOME?.trim() || env.JAVA_HOME?.trim();

  if (explicitJavaHome) {
    return explicitJavaHome;
  }

  if (platform === "darwin") {
    const homebrewJava21 = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
    if (pathExists(homebrewJava21)) {
      return homebrewJava21;
    }
  }

  return null;
}

export function resolveSpringBootJavaExecutable(
  platform: PlatformKind,
  options: ExecutableResolverOptions = {},
): string {
  const javaHome = resolveSpringBootJavaHome(platform, options);

  if (javaHome === null) {
    return "java";
  }

  return join(javaHome, "bin", platform === "windows" ? "java.exe" : "java");
}
