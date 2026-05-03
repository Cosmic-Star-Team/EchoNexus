interface FailureSummaryInput {
  message: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

function normalizeStream(label: "stdout" | "stderr", value: string | undefined, maxLength = 200): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value
    .replaceAll(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) {
    return null;
  }

  const clipped = normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
  return `${label}: ${clipped}`;
}

export function summarizeFailureNotes(input: FailureSummaryInput): string[] {
  const notes = [input.message];

  if (input.exitCode !== undefined) {
    notes.push(`exit code: ${input.exitCode}`);
  }

  const stdout = normalizeStream("stdout", input.stdout);
  const stderr = normalizeStream("stderr", input.stderr);

  if (stdout !== null) {
    notes.push(stdout);
  }

  if (stderr !== null) {
    notes.push(stderr);
  }

  return notes;
}
