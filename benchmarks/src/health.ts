function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHealth(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "health check did not run";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }

      lastFailure = `health check returned HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastFailure}`);
}
