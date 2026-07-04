import { describe, expect, it } from "vitest";
import { YnabApiError } from "../src/ynab/client.js";
import { ynabApiErrorPayload, ynabResult } from "../src/tools/result.js";

describe("tool result error shaping", () => {
  it.each([
    { status: 400, code: "ynab_bad_request", message: "invalid" },
    { status: 401, code: "ynab_unauthorized", message: "credential" },
    { status: 403, code: "ynab_forbidden", message: "denied" },
    { status: 404, code: "ynab_not_found", message: "could not find" },
    { status: 409, code: "ynab_conflict", message: "conflict" },
    { status: 429, code: "ynab_rate_limited", message: "rate limited" },
    { status: 500, code: "ynab_unavailable", message: "temporarily unavailable" },
    { status: 503, code: "ynab_unavailable", message: "temporarily unavailable" },
  ])("maps YNAB status $status to $code", ({ status, code, message }) => {
    const payload = ynabApiErrorPayload(
      new YnabApiError("upstream failure", status, {
        error: { id: String(status), name: "upstream_error", detail: "Upstream detail" },
      }),
    );

    expect(payload).toMatchObject({
      error: {
        source: "ynab",
        code,
        status,
        detail: "Upstream detail",
        upstream_error_id: String(status),
        upstream_error_name: "upstream_error",
      },
    });
    expect(payload.error.message.toLowerCase()).toContain(message);
  });

  it("includes retry guidance for YNAB rate limit responses", () => {
    const payload = ynabApiErrorPayload(new YnabApiError("rate limited", 429, { error: { detail: "Slow down" } }, 30));

    expect(payload.error).toMatchObject({
      code: "ynab_rate_limited",
      retry_after_seconds: 30,
    });
  });

  it("redacts secret-looking upstream text before returning it", () => {
    const payload = ynabApiErrorPayload(
      new YnabApiError("bad request", 400, {
        error: {
          detail:
            'Authorization: Bearer ynab-secret-token access_token=access-secret owner_passphrase=pass-secret code=oauth-code "refresh_token":"refresh-secret"',
        },
      }),
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("ynab-secret-token");
    expect(serialized).not.toContain("access-secret");
    expect(serialized).not.toContain("pass-secret");
    expect(serialized).not.toContain("oauth-code");
    expect(serialized).not.toContain("refresh-secret");
    expect(payload.error.detail).toContain("Bearer [REDACTED]");
  });

  it("returns YNAB failures as structured MCP tool errors", async () => {
    const result = await ynabResult(Promise.reject(new YnabApiError("missing", 404, { error: { detail: "No such category" } })));

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { source: "ynab", code: "ynab_not_found", status: 404, detail: "No such category" },
    });
    const first = result.content[0];
    expect(first?.type).toBe("text");
    expect(JSON.parse(first?.type === "text" ? first.text : "{}") as unknown).toEqual(result.structuredContent);
  });
});
