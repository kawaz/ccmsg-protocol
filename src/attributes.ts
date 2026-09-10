import type { ErrorCode } from "./errors.ts";
import type { Capability, Role } from "./identifiers.ts";

/** Which face of the contract an op belongs to. `common` is the transport
 * level (connect, declare the end of a connection, subscribe), which every
 * face uses. `mesh` holds no ops: an
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
  /** Set on an op a client reaches over HTTP rather than as a frame on its
   * WebSocket. Such an op is in this table like any other because the table is
   * the one place authorization is decided — an op reachable without appearing
   * here would be a second, unwritten rule about who may call what.
   *
   * What the carrier decides is not authorization but what the op can do: these
   * are the ops that set or read a cookie, which a frame on an open connection
   * cannot, and they answer before any identity is settled. The route each is
   * published at belongs to the instance, not here. */
  readonly carrier?: "http";
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
const INSTANCE_ONLY = ["instance"] as const;

/** The whole op vocabulary, with the attributes that decide who may call each
 * op, what it needs, and where it runs. This table is the single place those
 * facts live: authorization, capability gating and forwarding all read it
 * rather than each carrying their own copy. */
export const OP_ATTRIBUTES = {
  // --- common: connect, declare the end, and subscribe (13) ---
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
  session_stopping: {
    plane: "common",
    roles: SESSION_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
  // Open to every role, with which role may have which topic left to the topic
  // table: an instance subscribes as itself to what only instances may hold,
  // and a person is refused there by that table rather than here.
  topic_subscribe: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: true,
    locality: "cluster",
    errors: ["topic_unknown"],
  },
  topic_unsubscribe: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: true,
    locality: "cluster",
    errors: ["topic_unknown"],
  },

  // The four ops that authenticate a person are open to every role for the
  // same reason `hello` is: they run before there is an identity to check, and
  // what they answer is what settles one. They are `cluster` because whichever
  // instance is reached answers — behind a load balancer that is not a choice
  // the caller makes — and each asks the issuing instance itself for the parts
  // only it holds.
  auth_challenge: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    carrier: "http",
    errors: [],
  },
  auth_register: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  auth_assert: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  auth_refresh_token: {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "cluster",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  // Addresses the connection it arrives on, which is on the instance that
  // received it: nothing to forward, as with `hello`.
  auth_refresh: {
    plane: "common",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "cluster",
    errors: ["auth_invalid", "auth_expired"],
  },
  // Between instances: what an issuer alone can answer. Instance-local by the
  // usual rule — the subject belongs to one instance, and it is reached by
  // `to_instance` being that instance's id.
  auth_resolve: {
    plane: "common",
    roles: INSTANCE_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["auth_invalid", "auth_expired"],
  },
  auth_rotate: {
    plane: "common",
    roles: INSTANCE_ONLY,
    needs_hello: true,
    locality: "instance-local",
    errors: ["auth_invalid", "auth_expired"],
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
    errors: ["rate_limited"],
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
    errors: ["rate_limited"],
  },

  // --- control: session observation and operation (10) ---
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
  dump_presets_read: {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "instance-local",
    errors: [],
  },
  transcript_read: {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "instance-local",
    scope: "role",
    errors: ["not_found"],
  },
  transcript_items_read: {
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

  // --- control: launcher / sandbox / translate / llm (7) ---
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

  // --- control: the shared key-value store (3) ---
  // The only control ops that are not instance-local: a value is held by every
  // instance rather than by one, so whichever is asked can answer.
  kv_read: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "cluster",
    errors: ["not_found"],
  },
  kv_write: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "cluster",
    errors: [],
  },
  kv_delete: {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "cluster",
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
