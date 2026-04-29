import { describe, expect, test } from "bun:test";

import { parseOptions } from "../src/options";

describe("parseOptions", () => {
  test("default options use the full benchmark matrix", () => {
    const options = parseOptions([]);

    expect(options.frameworks).toEqual([
      "echonexus",
      "fastapi",
      "flask",
      "koa",
      "elysia",
      "axum",
      "gin",
      "springboot",
    ]);
    expect(options.workloads).toEqual([
      "plaintext",
      "json",
      "time_json",
      "param_json_middleware",
    ]);
    expect(options.workers).toEqual([1, 4]);
    expect(options.concurrency).toEqual([50, 200, 500, 1000, 2000, 5000]);
    expect(options.warmupSeconds).toBe(10);
    expect(options.measureSeconds).toBe(30);
    expect(options.cooldownSeconds).toBe(5);
    expect(options.buildProfile).toBe("release");
    expect(options.outputTag).toBeUndefined();
    expect(options.setupOnly).toBeFalse();
  });

  test("accepts arbitrary positive worker and concurrency lists", () => {
    const options = parseOptions([
      "--frameworks",
      "koa,gin",
      "--workloads",
      "json,time_json",
      "--workers",
      "3,7",
      "--concurrency",
      "4999,8001",
    ]);

    expect(options.frameworks).toEqual(["koa", "gin"]);
    expect(options.workloads).toEqual(["json", "time_json"]);
    expect(options.workers).toEqual([3, 7]);
    expect(options.concurrency).toEqual([4999, 8001]);
  });

  test("sets setupOnly when --setup is present", () => {
    const options = parseOptions(["--setup"]);

    expect(options.setupOnly).toBeTrue();
  });

  test("parses scalar duration flags and output tag", () => {
    const options = parseOptions([
      "--warmup",
      "12",
      "--measure",
      "34",
      "--cooldown",
      "0",
      "--output-tag",
      "nightly-run",
    ]);

    expect(options.warmupSeconds).toBe(12);
    expect(options.measureSeconds).toBe(34);
    expect(options.cooldownSeconds).toBe(0);
    expect(options.outputTag).toBe("nightly-run");
  });

  test("parses build profile flags", () => {
    expect(parseOptions(["--release"]).buildProfile).toBe("release");
    expect(parseOptions(["--debug"]).buildProfile).toBe("debug");
  });

  test("rejects values provided to --setup", () => {
    expect(() => parseOptions(["--setup", "true"])).toThrow(
      "Option --setup does not accept a value",
    );
    expect(() => parseOptions(["--setup=false"])).toThrow(
      "Option --setup does not accept a value",
    );
  });

  test("rejects malformed scalar duration values", () => {
    expect(() => parseOptions(["--warmup", "-1"])).toThrow("Invalid value for --warmup: -1");
    expect(() => parseOptions(["--measure", "-3"])).toThrow("Invalid value for --measure: -3");
    expect(() => parseOptions(["--measure", "0"])).toThrow("Invalid value for --measure: 0");
    expect(() => parseOptions(["--cooldown", "5,6"])).toThrow(
      "Expected a single value for --cooldown",
    );
  });

  test("rejects invalid output tag usage", () => {
    expect(() => parseOptions(["--output-tag"])).toThrow("Missing value for --output-tag");
    expect(() => parseOptions(["--output-tag="])).toThrow("Missing value for --output-tag");
  });

  test("rejects incompatible build profile flags", () => {
    expect(() => parseOptions(["--release", "--debug"])).toThrow(
      "Options --release and --debug are mutually exclusive",
    );
  });
});
