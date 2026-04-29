import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { FRAMEWORKS } from "../configs/frameworks";
import { resolveGoExecutable, resolveSpringBootJavaExecutable, resolveSpringBootJavaHome } from "../src/executables";

describe("framework support", () => {
  test("marks elysia workers=4 unsupported on darwin", () => {
    const support = FRAMEWORKS.elysia.supportsWorkers({ platform: "darwin", workers: 4 });

    expect(support.supported).toBe(false);
    expect(support.reason).toContain("shared-port");
  });

  test("allows elysia workers=4 on linux", () => {
    expect(FRAMEWORKS.elysia.supportsWorkers({ platform: "linux", workers: 4 })).toEqual({
      supported: true,
    });
  });

  test("exposes execution model metadata for every framework", () => {
    expect(FRAMEWORKS.echonexus.executionModel).toBe("runtime-threaded");
    expect(FRAMEWORKS.fastapi.executionModel).toBe("multi-process");
    expect(FRAMEWORKS.flask.executionModel).toBe("thread-pool");
    expect(FRAMEWORKS.koa.executionModel).toBe("multi-process");
    expect(FRAMEWORKS.elysia.executionModel).toBe("single-process-event-loop");
    expect(FRAMEWORKS.axum.executionModel).toBe("runtime-threaded");
    expect(FRAMEWORKS.gin.executionModel).toBe("runtime-threaded");
    expect(FRAMEWORKS.springboot.executionModel).toBe("servlet-thread-pool");
  });

  test("prefers BENCHMARK_JAVA_HOME for spring boot when provided", () => {
    expect(
      resolveSpringBootJavaHome("darwin", {
        env: {
          BENCHMARK_JAVA_HOME: "/custom/jdk-21",
        },
        exists: () => false,
      }),
    ).toBe("/custom/jdk-21");
  });

  test("detects Homebrew openjdk@21 on darwin for spring boot", () => {
    expect(
      resolveSpringBootJavaHome("darwin", {
        env: {},
        exists: (path) => path === "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
      }),
    ).toBe("/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home");
  });

  test("builds a Java executable path from the resolved Spring Boot Java home", () => {
    expect(
      resolveSpringBootJavaExecutable("darwin", {
        env: {
          BENCHMARK_JAVA_HOME: "/custom/jdk-21",
        },
        exists: () => false,
      }),
    ).toBe("/custom/jdk-21/bin/java");
  });

  test("prefers BENCHMARK_GO when provided", () => {
    expect(
      resolveGoExecutable("darwin", {
        env: {
          BENCHMARK_GO: "/custom/go/bin/go",
        },
        exists: () => false,
      }),
    ).toBe("/custom/go/bin/go");
  });

  test("detects Homebrew Go on darwin", () => {
    expect(
      resolveGoExecutable("darwin", {
        env: {},
        exists: (path) => path === "/opt/homebrew/opt/go/bin/go",
      }),
    ).toBe("/opt/homebrew/opt/go/bin/go");
  });

  test("writes spring boot gradle user home inside the benchmark workspace", () => {
    const steps = FRAMEWORKS.springboot.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "release",
    });

    expect(steps[0]?.env?.GRADLE_USER_HOME).toBe("/repo/benchmarks/apps/springboot/.gradle-home");
    expect(steps[0]?.env?.ORG_GRADLE_VFS_WATCH).toBe("false");
  });

  test("builds EchoNexus with the requested build profile", () => {
    const releaseSteps = FRAMEWORKS.echonexus.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "release",
    });
    const debugSteps = FRAMEWORKS.echonexus.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "debug",
    });
    const releaseConfigure = releaseSteps.find((step) => step.description === "Configure the EchoNexus benchmark target");
    const releaseBuild = releaseSteps.find((step) => step.description === "Build the EchoNexus benchmark target");
    const debugConfigure = debugSteps.find((step) => step.description === "Configure the EchoNexus benchmark target");
    const debugBuild = debugSteps.find((step) => step.description === "Build the EchoNexus benchmark target");

    expect(releaseConfigure?.cwd).toBe("/repo/benchmarks/apps/echonexus");
    expect(releaseConfigure?.cmd).toEqual(["cmake", "--preset", "release"]);
    expect(releaseBuild?.cwd).toBe("/repo/benchmarks/apps/echonexus");
    expect(releaseBuild?.cmd).toEqual([
      "cmake",
      "--build",
      "--preset",
      "build-release",
      "--target",
      "echonexus_benchmark",
    ]);
    expect(debugConfigure?.cwd).toBe("/repo/benchmarks/apps/echonexus");
    expect(debugConfigure?.cmd).toEqual(["cmake", "--preset", "debug"]);
    expect(debugBuild?.cwd).toBe("/repo/benchmarks/apps/echonexus");
    expect(debugBuild?.cmd).toEqual([
      "cmake",
      "--build",
      "--preset",
      "build-debug",
      "--target",
      "echonexus_benchmark",
    ]);
  });

  test("keeps EchoNexus preset binaryDir aligned with cleanup and launch paths", () => {
    const repoRoot = "/repo";
    const appDir = join(repoRoot, "benchmarks", "apps", "echonexus");
    const presetFile = resolve(import.meta.dir, "..", "apps", "echonexus", "CMakePresets.json");
    const releaseSteps = FRAMEWORKS.echonexus.setup({
      repoRoot,
      benchmarksRoot: join(repoRoot, "benchmarks"),
      platform: "darwin",
      buildProfile: "release",
    });
    const launch = FRAMEWORKS.echonexus.launch({
      repoRoot,
      benchmarksRoot: join(repoRoot, "benchmarks"),
      platform: "darwin",
      buildProfile: "release",
      port: 18080,
      workers: 1,
      mode: "single-worker",
    });
    const presets = JSON.parse(
      readFileSync(presetFile, "utf8"),
    ) as {
      configurePresets: Array<{
        name: string;
        generator?: string;
        binaryDir?: string;
        cacheVariables?: {
          VCPKG_MANIFEST_DIR?: string;
          VCPKG_MANIFEST_MODE?: string;
        };
      }>;
      buildPresets: Array<{ name: string; configurePreset?: string }>;
    };
    const basePreset = presets.configurePresets.find((preset) => preset.name === "base");
    const configurePresetNames = presets.configurePresets.map((preset) => preset.name).sort();
    const buildPresetNames = presets.buildPresets.map((preset) => preset.name).sort();
    const buildDebugPreset = presets.buildPresets.find((preset) => preset.name === "build-debug");
    const buildReleasePreset = presets.buildPresets.find((preset) => preset.name === "build-release");
    const cacheResetStep = releaseSteps.find((step) => step.description === "Reset the EchoNexus benchmark CMake cache");
    const filesResetStep = releaseSteps.find(
      (step) => step.description === "Reset the EchoNexus benchmark CMake files directory",
    );
    const expectedBuildDir = resolve(appDir, "../../../build/benchmark-echonexus");

    expect(configurePresetNames).toEqual(["base", "debug", "release"]);
    expect(buildPresetNames).toEqual(["build-debug", "build-release"]);
    expect(buildDebugPreset?.configurePreset).toBe("debug");
    expect(buildReleasePreset?.configurePreset).toBe("release");
    expect(basePreset?.generator).toBe("Ninja");
    expect(basePreset?.binaryDir).toBe("${sourceDir}/../../../build/benchmark-echonexus");
    expect(basePreset?.cacheVariables?.VCPKG_MANIFEST_DIR).toBe("${sourceDir}/../../..");
    expect(basePreset?.cacheVariables?.VCPKG_MANIFEST_MODE).toBe("ON");
    expect(cacheResetStep?.cmd.at(-1)).toBe(join(expectedBuildDir, "CMakeCache.txt"));
    expect(filesResetStep?.cmd.at(-1)).toBe(join(expectedBuildDir, "CMakeFiles"));
    expect(launch.cmd[0]).toBe(join(expectedBuildDir, "benchmarks", "apps", "echonexus", "echonexus_benchmark"));
  });

  test("builds Axum and Gin artifacts instead of running source directly", () => {
    const axumReleaseSteps = FRAMEWORKS.axum.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "release",
    });
    const axumDebugSteps = FRAMEWORKS.axum.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "debug",
    });
    const ginSteps = FRAMEWORKS.gin.setup({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "release",
    });
    const ginLaunch = FRAMEWORKS.gin.launch({
      repoRoot: "/repo",
      benchmarksRoot: "/repo/benchmarks",
      platform: "darwin",
      buildProfile: "release",
      port: 18080,
      workers: 1,
      mode: "single-worker",
    });

    expect(axumReleaseSteps[0]?.cmd).toEqual(["cargo", "build", "--release"]);
    expect(axumDebugSteps[0]?.cmd).toEqual(["cargo", "build"]);
    expect(ginSteps[2]?.cmd).toEqual([resolveGoExecutable("darwin"), "mod", "download"]);
    expect(ginSteps[2]?.env?.GOCACHE).toBe("/repo/benchmarks/.tmp/go-build");
    expect(ginSteps[2]?.env?.GOPATH).toBe("/repo/benchmarks/.tmp/go");
    expect(ginSteps[3]?.cmd.at(1)).toBe("build");
    expect(ginLaunch.cmd[0]).toContain("gin-benchmark");
  });
});
