import { describe, expect, test } from "bun:test";

import { summarizeFailureNotes } from "../src/failures";

describe("summarizeFailureNotes", () => {
  test("keeps the main failure message and appends stderr output", () => {
    expect(
      summarizeFailureNotes({
        message: "Timed out waiting for http://127.0.0.1:18080/healthz: connection refused",
        stderr: "compile error\nsecond line",
      }),
    ).toEqual([
      "Timed out waiting for http://127.0.0.1:18080/healthz: connection refused",
      "stderr: compile error second line",
    ]);
  });

  test("includes exit code and trims long output", () => {
    const notes = summarizeFailureNotes({
      message: "process exited before health check",
      exitCode: 1,
      stdout: "",
      stderr: "x".repeat(500),
    });

    expect(notes[0]).toBe("process exited before health check");
    expect(notes).toContain("exit code: 1");
    expect(notes.at(-1)?.startsWith("stderr: ")).toBeTrue();
    expect(notes.at(-1)?.length).toBeLessThanOrEqual(220);
  });
});
