import { describe, expect, test } from "bun:test";

import { normalizeCommandVersionOutput } from "../src/toolchains";

describe("normalizeCommandVersionOutput", () => {
  test("keeps the first non-empty line from version commands", () => {
    expect(normalizeCommandVersionOutput("\nPython 3.13.3\n")).toBe("Python 3.13.3");
    expect(normalizeCommandVersionOutput("openjdk 21.0.7\nOpenJDK Runtime Environment")).toBe(
      "openjdk 21.0.7",
    );
  });

  test("skips divider lines such as Gradle's banner", () => {
    expect(normalizeCommandVersionOutput("\n------------------------------------------------------------\nGradle 8.14.3\n")).toBe(
      "Gradle 8.14.3",
    );
  });
});
