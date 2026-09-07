import type { ErrorCode } from "./errors.ts";
import type { Capability, Role } from "./identifiers.ts";

/** Which face of the contract an op belongs to. `common` is the transport
 * level (connect / subscribe), which every face uses. `mesh` holds no ops: an
 * op crosses instances by carrying the envelope's mesh fields, not by being a
 * different op. */
export type Plane = "common" | "messaging" | "control" | "mesh";

/** `instance-local` ops answer for one instance's processes, paths and
 * handles, so they are forwarded to the instance that owns the subject.
 * `cluster` ops are answerable by whichever instance is asked. */
export type Locality = "instance-local" | "cluster";

export interface OpAttributes {
  readonly plane: Plane;
  /** Roles allowed to call the op. A role outside this set gets `forbidden`. */
  readonly roles: readonly Role[];
  /** Whether the op requires an identity settled by `hello`. */
  readonly needs_hello: boolean;
  /** The capability the op needs, when it needs one. */
  readonly capability?: Capability;
  readonly locality: Locality;
  /** Present when the role changes what the reply may contain rather than
   * whether the call is allowed. */
  readonly scope?: "role";
  /** Codes specific to this op. The codes that follow from the attributes
   * above are added by `opErrors` instead of being repeated here. */
  readonly errors: readonly ErrorCode[];
}

const ALL_ROLES = ["session", "user", "instance"] as const;
const AGENT_AND_USER = ["session", "user"] as const;
const USER_ONLY = ["user"] as const;
const SESSION_ONLY = ["session"] as const;

/** The whole op vocabulary, with the attributes that decide who may call each
 * op, what it needs, and where it runs. This table is the single place those
 * facts live: authorization, capability gating and forwarding all read it
 * rather than each carrying their own copy. */
export const OP_ATTRIBUTES = {
  // --- common: connect and subscribe (5) ---
  // `hello` and `instance_ping` address the instance the caller reached, so
  // there is nothing to forward and no unreachable instance to report — which
  // is why they are `cluster` despite answering about one instance.
  hello: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    errors: [],
  },
  instance_ping: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    errors: [],
  },
  instance_shutdown: {
    plane: "common",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
  topic_subscribe: {
    plane: "common",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "cluster",
    errors: ["topic_unknown"],
  },
  topic_unsubscribe: {
    plane: "common",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "cluster",
    errors: ["topic_unknown"],
  },

  // --- messaging: one-to-one delivery (4) ---
  message_send: {
    plane: "messaging",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "cluster",
    errors: ["session_not_found"],
  },
  say_post: {
    plane: "messaging",
    roles: SESSION_ONLY,
    needs_hello: true,
    locality: "cluster",
    errors: [],
  },
  say_mark_read: {
    plane: "messaging",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "cluster",
    errors: [],
  },
  notify_send: {
    plane: "messaging",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "cluster",
    errors: [],
  },

  // --- control: session observation and operation (8) ---
  session_kill: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["session_not_found"],
  },
  session_rename: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "terminal",
    locality: "instance-local",
    errors: ["session_not_found"],
  },
  session_env_read: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["session_not_found"],
  },
  session_search: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
  session_dump_write: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["not_found"],
  },
  transcript_read: {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "instance-local",
    scope: "role",
    errors: ["not_found"],
  },
  session_fork_origin: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "fork",
    locality: "instance-local",
    errors: ["not_found"],
  },
  session_last_live_remove: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },

  // --- control: file access (9) ---
  dir_list: {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "instance-local",
    scope: "role",
    errors: ["path_forbidden", "not_found"],
  },
  file_read: {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "instance-local",
    scope: "role",
    errors: ["path_forbidden", "not_found"],
  },
  file_write: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["path_not_writable", "file_exists"],
  },
  file_create: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["file_exists", "path_forbidden"],
  },
  file_edit: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["file_conflict", "not_a_text_file"],
  },
  file_delete: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["path_forbidden", "not_found"],
  },
  file_find: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["path_forbidden"],
  },
  file_stat_batch: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
  dir_tree: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "instance-local",
    errors: [],
  },

  // --- control: launcher / sandbox / translate / llm / diagnostics (8) ---
  launcher_config_read: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "instance-local",
    errors: [],
  },
  launcher_run: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "instance-local",
    errors: [],
  },
  sandbox_grant: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "sandbox",
    locality: "instance-local",
    errors: ["path_forbidden"],
  },
  sandbox_revoke: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "sandbox",
    locality: "instance-local",
    errors: [],
  },
  translate_run: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "translate",
    locality: "instance-local",
    errors: ["translate_helper_failed"],
  },
  llm_usage_read: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "llm_usage",
    locality: "instance-local",
    errors: [],
  },
  llm_stats_read: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "llm_stats",
    locality: "instance-local",
    errors: [],
  },
  trace_write: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
} as const satisfies Record<string, OpAttributes>;

export type OpName = keyof typeof OP_ATTRIBUTES;

export const OP_NAMES = Object.keys(OP_ATTRIBUTES) as OpName[];

export function opAttributes(op: OpName): OpAttributes {
  return OP_ATTRIBUTES[op];
}

/** Every code the op may answer with: the ones it declares, plus the ones its
 * attributes imply. Keeping the implied codes out of the table means adding a
 * capability to an op cannot leave its error list stale. */
export function opErrors(op: OpName): ErrorCode[] {
  const attrs: OpAttributes = OP_ATTRIBUTES[op];
  const codes = new Set<ErrorCode>(["invalid_args", ...attrs.errors]);
  if (attrs.needs_hello) codes.add("hello_required");
  if (attrs.roles.length < ALL_ROLES.length) codes.add("forbidden");
  if (attrs.capability !== undefined) codes.add("capability_unavailable");
  if (attrs.locality === "instance-local") codes.add("instance_unreachable");
  return [...codes];
}

/** Whether a connection speaking `role` may call `op`. */
export function isRoleAllowed(op: OpName, role: Role): boolean {
  return (OP_ATTRIBUTES[op].roles as readonly Role[]).includes(role);
}

export function opsOfPlane(plane: Plane): OpName[] {
  return OP_NAMES.filter((op) => OP_ATTRIBUTES[op].plane === plane);
}
