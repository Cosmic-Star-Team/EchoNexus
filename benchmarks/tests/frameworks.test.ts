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

    expect(releaseConfigure?.cmd).toContain("/repo/benchmarks/apps/echonexus");
    expect(releaseConfigure?.cmd).toContain("-DCMAKE_BUILD_TYPE=Release");
    expect(releaseConfigure?.cmd).toContain("-DVCPKG_MANIFEST_DIR=/repo");
    expect(releaseConfigure?.cmd).toContain("-DVCPKG_MANIFEST_MODE=ON");
    expect(releaseBuild?.cmd).toContain("Release");
    expect(debugConfigure?.cmd).toContain("-DCMAKE_BUILD_TYPE=Debug");
    expect(debugBuild?.cmd).toContain("Debug");
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
