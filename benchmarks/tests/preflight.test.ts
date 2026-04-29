import { describe, expect, test } from "bun:test";

import { buildFrameworkSkipResults, preflightFrameworks } from "../src/preflight";
import type { BenchmarkOptions } from "../src/types";

describe("preflightFrameworks", () => {
  test("skips frameworks with missing SDK commands before setup starts", async () => {
    const result = await preflightFrameworks({
      platform: "linux",
      frameworks: ["fastapi", "gin", "springboot"],
      commandExists: async (command) => command === "python3",
    });

    expect(result.availableFrameworks).toEqual(["fastapi"]);
    expect(result.skippedFrameworks).toHaveLength(2);
    expect(result.skippedFrameworks[0]?.framework).toBe("gin");
    expect(result.skippedFrameworks[0]?.missingCommands).toHaveLength(1);
    expect(result.skippedFrameworks[0]?.notes[0]).toContain("missing required framework SDK/command:");
    expect(result.skippedFrameworks[1]).toEqual({
      framework: "springboot",
      missingCommands: ["java"],
      notes: ["missing required framework SDK/command: java"],
    });
  });
});

describe("buildFrameworkSkipResults", () => {
  test("expands early framework skips into skipped case results", () => {
    const options: BenchmarkOptions = {
      frameworks: ["gin"],
      workloads: ["plaintext", "json"],
      workers: [1, 4],
      concurrency: [50],
      buildProfile: "release",
      warmupSeconds: 5,
      measureSeconds: 10,
      cooldownSeconds: 1,
      setupOnly: false,
    };

    const results = buildFrameworkSkipResults({
      options,
      skippedFrameworks: [
        {
          framework: "gin",
          missingCommands: ["go"],
          notes: ["missing required framework SDK/command: go"],
        },
      ],
    });

    expect(results).toHaveLength(4);
    expect(results.every((result) => result.framework === "gin")).toBe(true);
    expect(results.every((result) => result.status === "skipped")).toBe(true);
    expect(results.every((result) => result.notes[0] === "missing required framework SDK/command: go")).toBe(true);
    expect(results.map((result) => result.workers)).toEqual([1, 4, 1, 4]);
    expect(results.map((result) => result.workload)).toEqual(["plaintext", "plaintext", "json", "json"]);
  });
});
