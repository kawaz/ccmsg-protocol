import type { ErrorCode } from "./errors.ts";
import type { Capability, Role } from "./identifiers.ts";

/** Which face of the contract an op belongs to. `common` is the transport
 * level (connect, declare the end of a connection, subscribe), which every
 * face uses. `mesh` holds no ops: an
 * op crosses instances by carrying the envelope's mesh fields, not by being a
 * different op. */
export type Plane = "common" | "messaging" | "control" | "mesh";

/** `owner_instance` ops answer for one instance's processes, paths and
 * handles, so they are forwarded to the instance that owns the subject.
 * `any_instance` ops are answerable by whichever instance is asked. */
export type Locality = "owner_instance" | "any_instance";

export interface OpAttributes {
  readonly plane: Plane;
  /** Roles allowed to call the op. A role outside this set gets `forbidden`. */
  readonly roles: readonly Role[];
  /** Whether the op requires an identity settled by a greeting.
   *
   * On a WebSocket connection the only ops that may arrive before one are the
   * three greetings: a caller that will not say who it is has nothing to be
   * answered, and whether the instance is there is already known once the
   * connection was made. The ops carried over HTTP answer before any connection exists, which is
   * what `carrier` says; `needs_hello` is false on them because there is no
   * greeting to have sent, not because they are open on a settled one. */
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
   * published at belongs to the instance, not here.
   *
   * Being reachable from a page is also what gives the three that settle an
   * identity the only headers this contract reads over HTTP: the `Origin` a
   * browser states, held to the origin of the web UI the credential or the
   * registration names, and `Sec-Fetch-Site`, which has to say the call came from a page at
   * all — a navigation typed into the address bar is not how anyone
   * authenticates. A missing header is a failure like a wrong one, and either
   * answers `auth_invalid` without saying which. `auth.challenge` is checked
   * against neither, having nothing yet to be checked against; what it hands
   * out is spendable only at its issuer. */
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
  // --- common: connect, declare the end, and subscribe (15) ---
  // A greeting settles what the connection is, and there is one per role: what
  // each must carry is then the op's own schema rather than a rule read off a
  // field, and a connection cannot be settled as something neither side meant.
  //
  // The greetings and `instance.ping` address the instance the caller reached, so
  // there is nothing to forward and no unreachable instance to report — which
  // is why they are `any_instance` despite answering about one instance.
  "hello.session": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    errors: [],
  },
  "hello.user": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    errors: [],
  },
  "hello.instance": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    errors: [],
  },
  "instance.ping": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: true,
    locality: "any_instance",
    errors: [],
  },
  "instance.shutdown": {
    plane: "common",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: [],
  },
  "session.stopping": {
    plane: "common",
    roles: SESSION_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: [],
  },
  // Open to every role, with which role may have which topic left to the topic
  // table: an instance subscribes as itself to what only instances may hold,
  // and a person is refused there by that table rather than here.
  "topic.subscribe": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: true,
    locality: "any_instance",
    errors: ["topic_unknown"],
  },
  "topic.unsubscribe": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: true,
    locality: "any_instance",
    errors: ["topic_unknown"],
  },

  // The four ops that authenticate a person are open to every role for the
  // same reason the greetings are: they run before there is an identity to
  // check, and what they answer is what settles one. They are `any_instance` because whichever
  // instance is reached answers — behind a load balancer that is not a choice
  // the caller makes — and each asks the issuing instance itself for the parts
  // only it holds.
  "auth.challenge": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    carrier: "http",
    errors: [],
  },
  "auth.register": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  "auth.assert": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  "auth.token.refresh": {
    plane: "common",
    roles: ALL_ROLES,
    needs_hello: false,
    locality: "any_instance",
    carrier: "http",
    errors: ["auth_invalid", "auth_expired", "auth_unknown_issuer"],
  },
  // Addresses the connection it arrives on, which is on the instance that
  // received it: nothing to forward, as with a greeting.
  "auth.extend": {
    plane: "common",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "any_instance",
    errors: ["auth_invalid", "auth_expired"],
  },
  // Between instances: what an issuer alone can answer. `owner_instance` by the
  // usual rule — the subject belongs to one instance, and it is reached by
  // `to_instance` being that instance's id.
  "auth.resolve": {
    plane: "common",
    roles: INSTANCE_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["auth_invalid", "auth_expired"],
  },
  "auth.rotate": {
    plane: "common",
    roles: INSTANCE_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["auth_invalid", "auth_expired"],
  },

  // --- messaging: one-to-one delivery (4) ---
  "message.send": {
    plane: "messaging",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "any_instance",
    errors: ["session_not_found", "session_duplicated"],
  },
  "say.post": {
    plane: "messaging",
    roles: SESSION_ONLY,
    needs_hello: true,
    locality: "any_instance",
    errors: ["rate_limited"],
  },
  "say.unread.clear": {
    plane: "messaging",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "any_instance",
    errors: [],
  },
  "notify.send": {
    plane: "messaging",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "any_instance",
    errors: ["rate_limited", "session_duplicated"],
  },

  // --- control: session observation and operation (10) ---
  "session.kill": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["session_not_found", "ambiguous_run"],
  },
  "session.rename": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "terminal",
    locality: "owner_instance",
    errors: ["session_not_found"],
  },
  "session.env.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["session_not_found"],
  },
  "session.search": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: [],
  },
  "session.dump.write": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["not_found", "session_duplicated"],
  },
  "dump.presets.read": {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "owner_instance",
    errors: [],
  },
  "transcript.read": {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "owner_instance",
    scope: "role",
    errors: ["not_found"],
  },
  "transcript.items.read": {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "owner_instance",
    scope: "role",
    errors: ["not_found"],
  },
  "session.fork.origin.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "fork",
    locality: "owner_instance",
    errors: ["not_found"],
  },
  "session.forget": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: [],
  },

  // --- control: file access (9) ---
  "dir.list": {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "owner_instance",
    scope: "role",
    errors: ["path_forbidden", "not_found", "session_duplicated"],
  },
  "file.read": {
    plane: "control",
    roles: AGENT_AND_USER,
    needs_hello: true,
    locality: "owner_instance",
    scope: "role",
    errors: ["path_forbidden", "not_found", "session_duplicated"],
  },
  "file.write": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["path_not_writable", "file_exists", "session_duplicated"],
  },
  "file.create": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["file_exists", "path_forbidden", "session_duplicated"],
  },
  "file.edit": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["file_conflict", "not_a_text_file", "session_duplicated"],
  },
  "file.delete": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["path_forbidden", "not_found", "session_duplicated"],
  },
  "file.find": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["path_forbidden", "session_duplicated"],
  },
  "file.stat": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "owner_instance",
    errors: ["session_duplicated"],
  },
  "dir.tree": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "owner_instance",
    errors: [],
  },

  // --- control: launcher / sandbox / translate / llm (7) ---
  "launcher.config.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "owner_instance",
    errors: [],
  },
  "launcher.run": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "launcher",
    locality: "owner_instance",
    errors: [],
  },
  "sandbox.grant": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "sandbox",
    locality: "owner_instance",
    errors: ["path_forbidden"],
  },
  "sandbox.revoke": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "sandbox",
    locality: "owner_instance",
    errors: [],
  },
  "translate.run": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "translate",
    locality: "owner_instance",
    errors: ["translate_helper_failed"],
  },
  "llm.usage.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "llm_usage",
    locality: "owner_instance",
    errors: [],
  },
  "llm.stats.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    capability: "llm_stats",
    locality: "owner_instance",
    errors: [],
  },

  // --- control: the shared key-value store (3) ---
  // The only control ops not answered by an owning instance: a value is held by every
  // instance rather than by one, so whichever is asked can answer.
  "kv.read": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "any_instance",
    errors: ["not_found"],
  },
  "kv.write": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "any_instance",
    errors: [],
  },
  "kv.delete": {
    plane: "control",
    roles: USER_ONLY,
    needs_hello: true,
    locality: "any_instance",
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
  if (attrs.locality === "owner_instance") codes.add("instance_unreachable");
  return [...codes];
}

/** Whether a connection speaking `role` may call `op`. */
export function isRoleAllowed(op: OpName, role: Role): boolean {
  return (OP_ATTRIBUTES[op].roles as readonly Role[]).includes(role);
}

export function opsOfPlane(plane: Plane): OpName[] {
  return OP_NAMES.filter((op) => OP_ATTRIBUTES[op].plane === plane);
}
