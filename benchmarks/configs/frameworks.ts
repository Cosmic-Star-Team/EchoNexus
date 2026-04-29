import { existsSync } from "node:fs";
import { join } from "node:path";

import { resolveGoExecutable, resolveSpringBootJavaExecutable, resolveSpringBootJavaHome } from "../src/executables";
import type {
  CommandSpec,
  FrameworkConfig,
  FrameworkId,
  LaunchContext,
  LaunchPlan,
  SetupContext,
  WorkerSupport,
} from "../src/types";

function supportsAnyWorkers(): WorkerSupport {
  return { supported: true };
}

function supportsElysiaWorkers(context: { platform: SetupContext["platform"]; workers: number }): WorkerSupport {
  if (context.workers > 1 && context.platform !== "linux") {
    return {
      supported: false,
      reason: "Bun shared-port multi-worker is only supported on Linux in this suite.",
    };
  }

  return { supported: true };
}

function pythonCommand(platform: SetupContext["platform"]): string {
  if (process.env.BENCHMARK_PYTHON) {
    return process.env.BENCHMARK_PYTHON;
  }

  return platform === "windows" ? "python" : "python3";
}

function pythonExecutable(appDir: string, platform: SetupContext["platform"]): string {
  return platform === "windows"
    ? join(appDir, ".venv", "Scripts", "python.exe")
    : join(appDir, ".venv", "bin", "python");
}

function goToolchainEnv(context: SetupContext): Record<string, string> {
  return {
    GOCACHE: join(context.benchmarksRoot, ".tmp", "go-build"),
    GOPATH: join(context.benchmarksRoot, ".tmp", "go"),
  };
}

function cmakeBuildType(buildProfile: SetupContext["buildProfile"]): "Debug" | "Release" {
  return buildProfile === "debug" ? "Debug" : "Release";
}

function echonexusBuildDir(repoRoot: string): string {
  return join(repoRoot, "build", "benchmark-echonexus");
}

function echonexusBinary(context: SetupContext): string {
  const suffix = context.platform === "windows" ? ".exe" : "";

  return join(
    echonexusBuildDir(context.repoRoot),
    "benchmarks",
    "apps",
    "echonexus",
    `echonexus_benchmark${suffix}`,
  );
}

function axumBinary(context: SetupContext): string {
  const suffix = context.platform === "windows" ? ".exe" : "";
  const profileDir = context.buildProfile === "debug" ? "debug" : "release";

  return join(
    context.benchmarksRoot,
    "apps",
    "axum",
    "target",
    profileDir,
    `axum-benchmark${suffix}`,
  );
}

function ginBinary(context: SetupContext): string {
  const suffix = context.platform === "windows" ? ".exe" : "";

  return join(context.benchmarksRoot, "apps", "gin", "build", `gin-benchmark${suffix}`);
}

function springBootJarPath(context: SetupContext): string {
  return join(context.benchmarksRoot, "apps", "springboot", "build", "libs", "springboot-benchmark-0.0.1.jar");
}

function springBootJavaEnv(platform: SetupContext["platform"]): Record<string, string> | undefined {
  const javaHome = resolveSpringBootJavaHome(platform);
  if (javaHome === null) {
    return undefined;
  }

  return {
    JAVA_HOME: javaHome,
  };
}

function springBootJavaExecutable(platform: SetupContext["platform"]): string {
  return resolveSpringBootJavaExecutable(platform);
}

function springBootGradleCommand(context: SetupContext, task: string): string[] {
  const appDir = join(context.benchmarksRoot, "apps", "springboot");

  if (context.platform === "windows") {
    if (existsSync(join(appDir, "gradlew.bat"))) {
      return ["gradlew.bat", task, "--no-daemon"];
    }

    return ["gradle", task, "--no-daemon"];
  }

  if (existsSync(join(appDir, "gradlew"))) {
    return ["./gradlew", task, "--no-daemon"];
  }

  return ["gradle", task, "--no-daemon"];
}

function echonexusSetup(context: SetupContext): CommandSpec[] {
  const buildType = cmakeBuildType(context.buildProfile);
  const buildDir = echonexusBuildDir(context.repoRoot);

  return [
    {
      description: "Reset the EchoNexus benchmark CMake cache",
      cmd: [
        "cmake",
        "-E",
        "rm",
        "-f",
        join(buildDir, "CMakeCache.txt"),
      ],
      cwd: context.repoRoot,
    },
    {
      description: "Reset the EchoNexus benchmark CMake files directory",
      cmd: [
        "cmake",
        "-E",
        "rm",
        "-rf",
        join(buildDir, "CMakeFiles"),
      ],
      cwd: context.repoRoot,
    },
    {
      description: "Configure the EchoNexus benchmark target",
      cmd: [
        "cmake",
        "-S",
        join(context.benchmarksRoot, "apps", "echonexus"),
        "-B",
        buildDir,
        `-DCMAKE_BUILD_TYPE=${buildType}`,
        `-DVCPKG_MANIFEST_DIR=${context.repoRoot}`,
        "-DVCPKG_MANIFEST_MODE=ON",
      ],
      cwd: join(context.benchmarksRoot, "apps", "echonexus"),
    },
    {
      description: "Build the EchoNexus benchmark target",
      cmd: [
        "cmake",
        "--build",
        buildDir,
        "--config",
        buildType,
        "--target",
        "echonexus_benchmark",
      ],
      cwd: context.repoRoot,
    },
  ];
}

function echonexusLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: [echonexusBinary(context)],
    cwd: context.repoRoot,
    env: {
      BENCHMARK_PORT: String(context.port),
      BENCHMARK_WORKERS: String(context.workers),
    },
    notes: [],
  };
}

function pythonSetup(appName: string, requirementsFile: string) {
  return (context: SetupContext): CommandSpec[] => {
    const appDir = join(context.benchmarksRoot, "apps", appName);
    const basePython = pythonCommand(context.platform);
    const venvPython = pythonExecutable(appDir, context.platform);

    return [
      {
        description: `Create a virtual environment for ${appName}`,
        cmd: [basePython, "-m", "venv", ".venv"],
        cwd: appDir,
      },
      {
        description: `Install Python dependencies for ${appName}`,
        cmd: [venvPython, "-m", "pip", "install", "-r", requirementsFile],
        cwd: appDir,
      },
    ];
  };
}

function fastapiLaunch(context: LaunchContext): LaunchPlan {
  const appDir = join(context.benchmarksRoot, "apps", "fastapi");

  return {
    cmd: [
      pythonExecutable(appDir, context.platform),
      "-m",
      "uvicorn",
      "app:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(context.port),
      "--workers",
      String(context.workers),
      "--log-level",
      "warning",
    ],
    cwd: appDir,
    notes: [],
  };
}

function flaskLaunch(context: LaunchContext): LaunchPlan {
  const appDir = join(context.benchmarksRoot, "apps", "flask");

  return {
    cmd: [
      pythonExecutable(appDir, context.platform),
      "-m",
      "waitress",
      "--host=127.0.0.1",
      `--port=${context.port}`,
      `--threads=${context.workers}`,
      "app:app",
    ],
    cwd: appDir,
    notes: [],
  };
}

function npmInstallSetup(appName: string) {
  return (context: SetupContext): CommandSpec[] => {
    const cacheDir = join(context.benchmarksRoot, ".npm-cache");

    return [
      {
        description: `Create a writable npm cache for ${appName}`,
        cmd: ["cmake", "-E", "make_directory", cacheDir],
        cwd: context.benchmarksRoot,
      },
      {
        description: `Install JavaScript dependencies for ${appName}`,
        cmd: ["npm", "install", "--cache", cacheDir, "--no-audit", "--no-fund"],
        cwd: join(context.benchmarksRoot, "apps", appName),
      },
    ];
  };
}

function koaLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: ["node", "app.js"],
    cwd: join(context.benchmarksRoot, "apps", "koa"),
    env: {
      BENCHMARK_PORT: String(context.port),
      BENCHMARK_WORKERS: String(context.workers),
    },
    notes: [],
  };
}

function elysiaLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: ["bun", "run", "src/index.ts"],
    cwd: join(context.benchmarksRoot, "apps", "elysia"),
    env: {
      BENCHMARK_PORT: String(context.port),
      BENCHMARK_WORKERS: String(context.workers),
      BENCHMARK_REUSE_PORT: context.platform === "linux" && context.workers > 1 ? "1" : "0",
    },
    notes: [],
  };
}

function axumSetup(context: SetupContext): CommandSpec[] {
  return [
    {
      description: "Build the Axum benchmark binary",
      cmd: context.buildProfile === "debug" ? ["cargo", "build"] : ["cargo", "build", "--release"],
      cwd: join(context.benchmarksRoot, "apps", "axum"),
    },
  ];
}

function axumLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: [axumBinary(context)],
    cwd: join(context.benchmarksRoot, "apps", "axum"),
    env: {
      BENCHMARK_PORT: String(context.port),
      BENCHMARK_WORKERS: String(context.workers),
    },
    notes: [],
  };
}

function ginSetup(context: SetupContext): CommandSpec[] {
  const cmd =
    context.buildProfile === "debug"
      ? [
          resolveGoExecutable(context.platform),
          "build",
          "-gcflags=all=-N -l",
          "-o",
          ginBinary(context),
          ".",
        ]
      : [resolveGoExecutable(context.platform), "build", "-o", ginBinary(context), "."];

  return [
    {
      description: "Create the Gin benchmark build directory",
      cmd: ["cmake", "-E", "make_directory", join(context.benchmarksRoot, "apps", "gin", "build")],
      cwd: join(context.benchmarksRoot, "apps", "gin"),
    },
    {
      description: "Create local Go cache directories for Gin",
      cmd: [
        "cmake",
        "-E",
        "make_directory",
        join(context.benchmarksRoot, ".tmp", "go-build"),
        join(context.benchmarksRoot, ".tmp", "go"),
      ],
      cwd: join(context.benchmarksRoot, "apps", "gin"),
    },
    {
      description: "Download Gin dependencies",
      cmd: [resolveGoExecutable(context.platform), "mod", "download"],
      cwd: join(context.benchmarksRoot, "apps", "gin"),
      env: goToolchainEnv(context),
    },
    {
      description: "Build the Gin benchmark binary",
      cmd,
      cwd: join(context.benchmarksRoot, "apps", "gin"),
      env: goToolchainEnv(context),
    },
  ];
}

function ginLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: [ginBinary(context)],
    cwd: join(context.benchmarksRoot, "apps", "gin"),
    env: {
      BENCHMARK_PORT: String(context.port),
      BENCHMARK_WORKERS: String(context.workers),
    },
    notes: [],
  };
}

function springBootSetup(context: SetupContext): CommandSpec[] {
  const appDir = join(context.benchmarksRoot, "apps", "springboot");
  const javaEnv = springBootJavaEnv(context.platform);

  return [
    {
      description: "Build the Spring Boot benchmark app",
      cmd: springBootGradleCommand(context, "bootJar"),
      cwd: appDir,
      env: {
        ...javaEnv,
        GRADLE_USER_HOME: join(appDir, ".gradle-home"),
        ORG_GRADLE_VFS_WATCH: "false",
      },
    },
  ];
}

function springBootLaunch(context: LaunchContext): LaunchPlan {
  return {
    cmd: [
      springBootJavaExecutable(context.platform),
      `-DBENCHMARK_PORT=${context.port}`,
      `-DBENCHMARK_WORKERS=${context.workers}`,
      "-jar",
      springBootJarPath(context),
    ],
    cwd: join(context.benchmarksRoot, "apps", "springboot"),
    env: springBootJavaEnv(context.platform),
    notes: [],
  };
}

export const FRAMEWORKS: Record<FrameworkId, FrameworkConfig> = {
  echonexus: {
    id: "echonexus",
    displayName: "EchoNexus",
    executionModel: "runtime-threaded",
    appDir: "benchmarks/apps/echonexus",
    setup: echonexusSetup,
    supportsWorkers: supportsAnyWorkers,
    launch: echonexusLaunch,
  },
  fastapi: {
    id: "fastapi",
    displayName: "FastAPI",
    executionModel: "multi-process",
    appDir: "benchmarks/apps/fastapi",
    setup: pythonSetup("fastapi", "requirements.txt"),
    supportsWorkers: supportsAnyWorkers,
    launch: fastapiLaunch,
  },
  flask: {
    id: "flask",
    displayName: "Flask",
    executionModel: "thread-pool",
    appDir: "benchmarks/apps/flask",
    setup: pythonSetup("flask", "requirements.txt"),
    supportsWorkers: supportsAnyWorkers,
    launch: flaskLaunch,
  },
  koa: {
    id: "koa",
    displayName: "Koa",
    executionModel: "multi-process",
    appDir: "benchmarks/apps/koa",
    setup: npmInstallSetup("koa"),
    supportsWorkers: supportsAnyWorkers,
    launch: koaLaunch,
  },
  elysia: {
    id: "elysia",
    displayName: "Elysia",
    executionModel: "single-process-event-loop",
    appDir: "benchmarks/apps/elysia",
    setup: npmInstallSetup("elysia"),
    supportsWorkers: supportsElysiaWorkers,
    launch: elysiaLaunch,
  },
  axum: {
    id: "axum",
    displayName: "Axum",
    executionModel: "runtime-threaded",
    appDir: "benchmarks/apps/axum",
    setup: axumSetup,
    supportsWorkers: supportsAnyWorkers,
    launch: axumLaunch,
  },
  gin: {
    id: "gin",
    displayName: "Gin",
    executionModel: "runtime-threaded",
    appDir: "benchmarks/apps/gin",
    setup: ginSetup,
    supportsWorkers: supportsAnyWorkers,
    launch: ginLaunch,
  },
  springboot: {
    id: "springboot",
    displayName: "Spring Boot",
    executionModel: "servlet-thread-pool",
    appDir: "benchmarks/apps/springboot",
    setup: springBootSetup,
    supportsWorkers: supportsAnyWorkers,
    launch: springBootLaunch,
  },
};
