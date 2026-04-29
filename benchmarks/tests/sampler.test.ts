import { describe, expect, test } from "bun:test";

import {
  aggregateProcessTree,
  parsePsCpuTimeSeconds,
  windowsTicksToSeconds,
} from "../src/sampler/common";

describe("parsePsCpuTimeSeconds", () => {
  test("supports the short BSD ps format used on macOS", () => {
    expect(parsePsCpuTimeSeconds("0:00.02")).toBe(0.02);
  });

  test("supports hour and day prefixes", () => {
    expect(parsePsCpuTimeSeconds("01:02:03")).toBe(3723);
    expect(parsePsCpuTimeSeconds("2-03:04:05")).toBe(183845);
  });
});

describe("aggregateProcessTree", () => {
  test("sums rss and cpu time across the root pid and its descendants", () => {
    const totals = aggregateProcessTree(
      [
        { pid: 100, ppid: 1, rssBytes: 256, cpuTimeSeconds: 1.5 },
        { pid: 101, ppid: 100, rssBytes: 512, cpuTimeSeconds: 2.5 },
        { pid: 102, ppid: 101, rssBytes: 128, cpuTimeSeconds: 0.5 },
        { pid: 999, ppid: 1, rssBytes: 4096, cpuTimeSeconds: 9.9 },
      ],
      100,
    );

    expect(totals).toEqual({
      rssBytes: 896,
      cpuTimeSeconds: 4.5,
      processCount: 3,
    });
  });
});

describe("windowsTicksToSeconds", () => {
  test("converts 100ns ticks to seconds", () => {
    expect(windowsTicksToSeconds("12500000")).toBe(1.25);
    expect(windowsTicksToSeconds(37500000n)).toBe(3.75);
  });
});
