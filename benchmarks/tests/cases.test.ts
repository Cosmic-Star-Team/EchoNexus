import { describe, expect, test } from "bun:test";

import { buildCases } from "../src/cases";

describe("buildCases", () => {
  test("supports the legacy smoke preset contract for the current runner", () => {
    const cases = buildCases("smoke");

    expect(cases).toHaveLength(8);
    expect(cases[0]).toEqual({
      framework: "echonexus",
      workload: "plaintext",
      workers: 1,
      mode: "single-worker",
      concurrency: 50,
    });
    expect(new Set(cases.map((item) => item.mode))).toEqual(new Set(["single-worker"]));
  });

  test("expands explicit option lists into the full benchmark matrix", () => {
    const cases = buildCases({
      frameworks: ["echonexus", "gin"],
      workloads: ["plaintext", "json"],
      workers: [1, 4],
      concurrency: [50, 200],
    });

    expect(cases).toHaveLength(16);
    expect(cases).toContainEqual({
      framework: "echonexus",
      workload: "plaintext",
      workers: 1,
      mode: "single-worker",
      concurrency: 50,
    });
    expect(cases).toContainEqual({
      framework: "gin",
      workload: "json",
      workers: 4,
      mode: "multi-worker",
      concurrency: 200,
    });
  });

  test("supports time_json and arbitrary concurrency values", () => {
    const cases = buildCases({
      frameworks: ["springboot"],
      workloads: ["time_json"],
      workers: [3],
      concurrency: [4999],
    });

    expect(cases).toEqual([
      {
        framework: "springboot",
        workload: "time_json",
        workers: 3,
        mode: "multi-worker",
        concurrency: 4999,
      },
    ]);
  });

  test("rejects invalid frameworks and workloads in explicit input", () => {
    expect(() =>
      buildCases({
        frameworks: ["echonexus", "not-a-framework"] as ("echonexus" | "not-a-framework")[],
        workloads: ["plaintext"],
        workers: [1],
        concurrency: [50],
      }),
    ).toThrow("Invalid framework: not-a-framework");

    expect(() =>
      buildCases({
        frameworks: ["echonexus"],
        workloads: ["not-a-workload"] as "not-a-workload"[],
        workers: [1],
        concurrency: [50],
      }),
    ).toThrow("Invalid workload: not-a-workload");
  });

  test("rejects empty lists and non-positive numeric values in explicit input", () => {
    expect(() =>
      buildCases({
        frameworks: [],
        workloads: ["plaintext"],
        workers: [1],
        concurrency: [50],
      }),
    ).toThrow("Expected at least one framework");

    expect(() =>
      buildCases({
        frameworks: ["echonexus"],
        workloads: [],
        workers: [1],
        concurrency: [50],
      }),
    ).toThrow("Expected at least one workload");

    expect(() =>
      buildCases({
        frameworks: ["echonexus"],
        workloads: ["plaintext"],
        workers: [0],
        concurrency: [50],
      }),
    ).toThrow("Invalid workers value: 0");

    expect(() =>
      buildCases({
        frameworks: ["echonexus"],
        workloads: ["plaintext"],
        workers: [1],
        concurrency: [-1],
      }),
    ).toThrow("Invalid concurrency value: -1");
  });
});
