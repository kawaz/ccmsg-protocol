import { type Static, Type } from "@sinclair/typebox";

/** Every code an error response may carry. The union is closed: a code outside
 * this list is a contract violation, not an extension point. */
export const ERROR_CODES = [
  // --- connection level (no single op owns these) ---
  /** The request could not be dispatched at all: unparseable JSON, no `op`, no
   * `request_id`, or a `hello` announcing another protocol generation. */
  "bad_request",
  /** The op name is not in the op attribute table. */
  "unknown_op",
  /** An op with `needs_hello` arrived before `hello` settled the identity. */
  "hello_required",
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
