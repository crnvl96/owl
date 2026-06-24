import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join as joinPath } from "node:path";
import { tmpdir } from "node:os";

import { type NextRequest } from "next/server";

const CACHE_CONTROL = "no-store";
// 1 MiB cap to avoid runaway writes
const MAX_CONTENT_BYTES = 1_048_576;
const SNAPSHOT_EXTENSION = ".md";
const CONTENT_TYPE_JSON = "application/json; charset=utf-8";
const ERROR_CONTENT_TYPE = "text/plain; charset=utf-8";

interface ClipboardSnapshotSuccessResponse {
  path: string;
}

interface ClipboardSnapshotRequestBody {
  content?: unknown;
  fileName?: unknown;
}

// Writes the user-imported clipboard content to a fresh file in the
// system temp directory and returns the absolute path. Used by the
// "Generate report" flow on the clipboard source so the resulting
// markdown report can point the agent back at the file the user was
// reviewing (see lib/generateReviewReport.ts).
//
// The file name is generated server-side (`<uuid>.md`) so concurrent
// generations don't collide and the user doesn't have to think about
// naming. `fileName` is accepted in the body for future use (e.g. a
// custom suffix) but is currently ignored — the on-disk name is fixed.
export async function POST(request: NextRequest) {
  let body: ClipboardSnapshotRequestBody;
  try {
    body = (await request.json()) as ClipboardSnapshotRequestBody;
  } catch {
    return createErrorResponse("Invalid JSON body.", 400);
  }

  if (typeof body.content !== "string") {
    return createErrorResponse("`content` must be a string.", 400);
  }

  // Reject string lengths we know will balloon disk usage. The cap is
  // intentionally generous (1 MiB) — far above any reasonable paste —
  // but stops a runaway client (or a future regression that ships the
  // whole document by accident) from filling the temp partition.
  if (Buffer.byteLength(body.content, "utf8") > MAX_CONTENT_BYTES) {
    return createErrorResponse(
      `Clipboard content exceeds ${MAX_CONTENT_BYTES} bytes.`,
      413,
    );
  }

  try {
    const path = joinPath(tmpdir(), `${randomUUID()}${SNAPSHOT_EXTENSION}`);
    await writeFile(path, body.content, "utf8");
    return createJsonResponse({ path });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
}

function createJsonResponse(body: ClipboardSnapshotSuccessResponse): Response {
  const headers = new Headers({
    "Content-Type": CONTENT_TYPE_JSON,
    "Cache-Control": CACHE_CONTROL,
  });
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function createErrorResponse(message: string, status: number): Response {
  const headers = new Headers({
    "Content-Type": ERROR_CONTENT_TYPE,
    "Cache-Control": CACHE_CONTROL,
  });
  return new Response(message, { status, headers });
}
