import { expect, it } from "vitest";
import { sdkTerminalResponse, sdkThrownError } from "../turn-failure.js";
it("retains open native categories and retryability without replay instructions", () => {
  for (const kind of [
    "modelError",
    "configError",
    "projectionError",
    "launchError",
    "futureFailure",
  ]) {
    try {
      sdkTerminalResponse(
        {
          kind: "completed",
          params: {
            terminal: "failed",
            error: { kind, message: "Bearer private-token ?api_key=private-key", retryable: true },
          },
        } as never,
        {},
      );
      throw new Error("expected failure");
    } catch (e) {
      expect(e).toMatchObject({ data: { failure: { kind, retryable: true, outcome: "failed" } } });
      expect(JSON.stringify(e)).not.toMatch(/private-token|private-key/);
    }
  }
});
it("keeps ambiguous outcomes unknown and redacts supplied credentials", () => {
  const e = sdkThrownError(new Error("connection lost secret-value"), {
    META_API_KEY: "secret-value",
  });
  expect(e).toMatchObject({ data: { failure: { source: "transport", outcome: "unknown" } } });
  expect(e.message).not.toContain("secret-value");
  expect(e.message).toContain("Reload");
});
