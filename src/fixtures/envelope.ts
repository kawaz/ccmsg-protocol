import type { ErrorResponse } from "../envelope.ts";
import { FIXTURE_IDS } from "./ids.ts";

export const ERROR_RESPONSE: ErrorResponse = {
  ok: false,
  request_id: FIXTURE_IDS.request_id,
  error: { code: "capability_unavailable", msg: "launcher is not configured" },
};

/** The one reply that names no request: the frame could not be read far enough
 * to find its correlation id. */
export const ERROR_RESPONSE_UNIDENTIFIED: ErrorResponse = {
  ok: false,
  error: { code: "bad_request", msg: "no request_id" },
};
