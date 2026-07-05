import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { YnabApiError } from "../ynab/client.js";
import { YnabResponseShapeError } from "./ynabResponseSchemas.js";

type YnabToolErrorPayload = {
  error: {
    source: "ynab";
    code: YnabApiErrorCode;
    status: number;
    message: string;
    detail?: string;
    upstream_error_id?: string;
    upstream_error_name?: string;
    retry_after_seconds?: number;
  };
};

type YnabResponseShapeErrorPayload = {
  error: {
    source: "ynab";
    code: "ynab_unexpected_response";
    message: string;
    response_label: string;
    issue_paths: string[];
  };
};

type YnabStructuredErrorPayload = YnabToolErrorPayload | YnabResponseShapeErrorPayload;

type YnabApiErrorCode =
  | "ynab_bad_request"
  | "ynab_unauthorized"
  | "ynab_forbidden"
  | "ynab_not_found"
  | "ynab_conflict"
  | "ynab_rate_limited"
  | "ynab_unavailable"
  | "ynab_api_error";

type YnabErrorBody = {
  id?: string;
  name?: string;
  detail?: string;
};

type Compact<T extends Record<string, unknown>> = Partial<{
  [Key in keyof T]: Exclude<T[Key], undefined>;
}>;

export function jsonResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function ynabResult(
  request: Promise<unknown>,
  shape: (value: unknown) => unknown = (value) => value,
): Promise<CallToolResult> {
  try {
    return jsonResult(shape(await request));
  } catch (error) {
    if (error instanceof YnabApiError) {
      return jsonErrorResult(ynabApiErrorPayload(error));
    }
    if (error instanceof YnabResponseShapeError) {
      return jsonErrorResult(ynabResponseShapeErrorPayload(error));
    }
    throw error;
  }
}

function ynabResponseShapeErrorPayload(
  error: YnabResponseShapeError,
): YnabResponseShapeErrorPayload {
  return {
    error: {
      source: "ynab",
      code: "ynab_unexpected_response",
      message:
        "YNAB returned an unexpected response shape. The server owner should update this connector before retrying.",
      response_label: error.label,
      issue_paths: error.issuePaths,
    },
  };
}

export function ynabApiErrorPayload(error: YnabApiError): YnabToolErrorPayload {
  const classification = classifyYnabStatus(error.status);
  const upstreamError = extractYnabErrorBody(error.body);
  return {
    error: {
      source: "ynab",
      code: classification.code,
      status: error.status,
      message: classification.message,
      ...compact({
        detail: upstreamError.detail,
        upstream_error_id: upstreamError.id,
        upstream_error_name: upstreamError.name,
        retry_after_seconds: error.retryAfterSeconds,
      }),
    },
  };
}

function jsonErrorResult(value: YnabStructuredErrorPayload): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
    isError: true,
  };
}

function classifyYnabStatus(status: number): { code: YnabApiErrorCode; message: string } {
  if (status === 400) {
    return {
      code: "ynab_bad_request",
      message:
        "YNAB rejected the request as invalid. Check the tool input values and required fields before retrying.",
    };
  }
  if (status === 401) {
    return {
      code: "ynab_unauthorized",
      message:
        "YNAB rejected the server-side credential. The server owner must update the configured YNAB access token before this can succeed.",
    };
  }
  if (status === 403) {
    return {
      code: "ynab_forbidden",
      message:
        "YNAB denied access to the requested resource for the configured account. Confirm the plan and resource IDs are available to this YNAB account.",
    };
  }
  if (status === 404) {
    return {
      code: "ynab_not_found",
      message:
        "YNAB could not find the requested resource. Re-list plans, accounts, categories, payees, or transactions and retry with a current ID.",
    };
  }
  if (status === 409) {
    return {
      code: "ynab_conflict",
      message:
        "YNAB reported a conflict. Refresh the resource, then retry only if the change is still appropriate.",
    };
  }
  if (status === 429) {
    return {
      code: "ynab_rate_limited",
      message: "YNAB rate limited this server. Wait before retrying.",
    };
  }
  if (status >= 500 && status <= 599) {
    return {
      code: "ynab_unavailable",
      message: "YNAB is temporarily unavailable. Retry later.",
    };
  }
  return {
    code: "ynab_api_error",
    message: "YNAB returned an unexpected error. Review the status and retry if appropriate.",
  };
}

function extractYnabErrorBody(body: unknown): YnabErrorBody {
  const error = isRecord(body) ? body["error"] : undefined;
  if (isRecord(error)) {
    return compact({
      id: safeText(error["id"]),
      name: safeText(error["name"]),
      detail: safeText(error["detail"]),
    });
  }
  if (typeof error === "string") {
    return compact({ detail: safeText(error) });
  }
  if (isRecord(body)) {
    return compact({ detail: safeText(body["detail"]) });
  }
  return compact({ detail: safeText(body) });
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? redactSecrets(trimmed).slice(0, 1_000) : undefined;
}

function redactSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b([A-Za-z_]*(?:token|passphrase)|authorization|code)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(
      /"([^"]*(?:token|passphrase)|authorization|code)"\s*:\s*"[^"]*"/gi,
      '"$1":"[REDACTED]"',
    );
}

function compact<T extends Record<string, unknown>>(value: T): Compact<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Compact<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
