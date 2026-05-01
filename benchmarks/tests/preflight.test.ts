import { describe, expect, test } from "bun:test";

import { frameworkRequiredCommands, preflightFrameworks } from "../src/preflight";

describe("preflightFrameworks", () => {
  test("requires bun for JavaScript benchmarks", () => {
    expect(frameworkRequiredCommands("windows", "koa")).toEqual(["node", "bun"]);
    expect(frameworkRequiredCommands("windows", "elysia")).toEqual(["node", "bun"]);
  });

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

  test("skips koa when bun is unavailable even if node exists", async () => {
    const result = await preflightFrameworks({
      platform: "windows",
      frameworks: ["koa"],
      commandExists: async (command) => command === "node",
    });

    expect(result.availableFrameworks).toEqual([]);
    expect(result.skippedFrameworks).toEqual([
      {
        framework: "koa",
        missingCommands: ["bun"],
        notes: ["missing required framework SDK/command: bun"],
      },
    ]);
  });
});
