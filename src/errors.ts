import { type Static, Type } from "@sinclair/typebox";

/** Every code an error response may carry. The union is closed: a code outside
 * this list is a contract violation, not an extension point. */
export const ERROR_CODES = [
  // --- connection level (no single op owns these) ---
  /** The request could not be dispatched at all: unparseable JSON, no `op`, no
   * `request_id`, or a greeting announcing another protocol generation. */
  "bad_request",
  /** The op name is not in the op attribute table. */
  "unknown_op",
  /** An op with `needs_hello` arrived before `hello` settled the identity. */
  "hello_required",
  /** The op's implementation failed for a reason that is not the caller's: the
   * arguments were right and the call was allowed. It belongs beside the other
   * connection-level codes because no op owns it — any op can fail this way, and
   * naming it apart from `bad_request` is what keeps a caller from re-reading
   * arguments that were never the problem. Whether retrying helps is not stated;
   * `msg` is the only thing that says more. */
  "internal_error",
  // --- backpressure ---
  /** The call was well-formed and allowed, and the instance is not taking it
   * just now: what it would be queued behind has reached the limit the sender
   * keeps to. Apart from `internal_error` because nothing failed and the
   * arguments are not what to re-read — the same call sent again once the
   * reader has caught up is the one that goes through. Which ops answer it is
   * in their `errors`, since only an op that queues for a reader has a queue to
   * fill. */
  "rate_limited",
  // --- rule-derived (op attribute table §0) ---
  /** The connection's role is outside the op's `roles`. Argument problems stay
   * on `invalid_args` / `bad_request`. */
  "forbidden",
  /** The op's arguments failed the op's schema. */
  "invalid_args",
  /** The op declares a `capability` this instance does not have. */
  "capability_unavailable",
  /** An `instance-local` op could not be forwarded to the instance that owns
   * the subject. */
  "instance_unreachable",
  // --- subscription ---
  /** The topic name is not one this protocol generation defines. */
  "topic_unknown",
  // --- subject lookup ---
  /** The `sid` names no session anywhere in the cluster. */
  "session_not_found",
  /** The path, transcript, or record named by the arguments does not exist. */
  "not_found",
  // --- file access ---
  "path_forbidden",
  "path_not_writable",
  "file_exists",
  /** The file changed between the read the edit was based on and the write. */
  "file_conflict",
  /** The on-disk content sniffed as binary, so a text edit would not be
   * faithful to what the caller saw. */
  "not_a_text_file",
  // --- authenticating a person ---
  /** A challenge, registration or token was good once and its window has
   * passed. Apart from `auth_invalid` because it is the one authentication
   * failure a client answers by itself: it repeats the step that issues a fresh
   * one, where anything invalid means asking the person again. */
  "auth_expired",
  /** The credential, signature, challenge or token did not check out. What
   * failed is not stated: a caller learns only that this attempt is not one,
   * and `msg` says no more than the instance's own log would want. */
  "auth_invalid",
  /** The instance that issued the challenge or registration, and alone can
   * spend it, is not one this cluster knows or could reach just now. The client
   * asks for a fresh one, which the instance it is talking to can issue. */
  "auth_unknown_issuer",
  // --- translate ---
  /** The helper process is present but failed on this call. (Its absence is
   * `capability_unavailable` instead.) */
  "translate_helper_failed",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorCodeSchema = Type.Union(
  ERROR_CODES.map((code) => Type.Literal(code)),
  { $id: "ErrorCode" },
);

export const ErrorBody = Type.Object(
  {
    code: ErrorCodeSchema,
    /** Human-readable detail. Clients branch on `code`, never on this. */
    msg: Type.String(),
  },
  { $id: "ErrorBody" },
);
export type ErrorBody = Static<typeof ErrorBody>;
