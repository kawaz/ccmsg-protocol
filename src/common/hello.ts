import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Capability, Endpoint, InstanceId, Role, Sid, Timestamp } from "../identifiers.ts";
import { SessionMetaFields } from "../session-meta.ts";

/** The mesh handshake's opening claim, carried by a `role: "instance"` hello.
 *
 * It is not signed and proves nothing on its own: it names the peer and says
 * where its one-off key can be fetched. The proof that binds this connection to
 * `iss` follows on a separate exchange (mesh-peer-auth §5). */
export const MeshHello = Type.Object(
  {
    /** Generation of the mesh handshake format, apart from the protocol
     * generation so the handshake can change without the wire changing. */
    ver: Type.Integer({ minimum: 1 }),
    /** The base URL the connecting instance claims to be published at — the
     * endpoint itself, not the `<endpoint>ws` it dialed to get here. */
    iss: Endpoint,
    /** The base URL it believes it is connecting to. Compared whole
     * against the receiver's own URL, which is what stops a signature made for
     * one instance from being replayed at another on the same host. */
    aud: Endpoint,
    /** Which instance is answering at `iss`. The claim is worth nothing until
     * the proof lands, after which everything this hello said is trusted, so
     * the receiver keeps the pair as its authenticated endpoint-to-id mapping —
     * the table every later `to_instance` is dialed through.
     *
     * One id binds to one authenticated link: a hello naming an id already
     * bound to another endpoint is the one closed, the standing binding being
     * the one an operator's endpoint list has already vouched for. */
    id: InstanceId,
    /** Names the ephemeral key the receiver is to fetch for this connection. */
    kid: Type.String({ minLength: 16 }),
  },
  { $id: "MeshHello" },
);
export type MeshHello = Static<typeof MeshHello>;

/** The greeting that settles what a connection is.
 *
 * Which of the fields below are required is decided by `role`, which no single
 * object schema can state — so the instance checks it, and a greeting that
 * breaks one of these is refused with `invalid_args`:
 *
 * - `role: "session"` carries `sid`.
 * - `role: "user"` carries no `sid`: a person speaks for no one session, and a
 *   greeting that names one is refused rather than quietly ignored.
 * - `role: "instance"` carries `mesh`.
 *
 * A field that belongs to another role is as much a refusal as a missing one:
 * `mesh` on a session greeting says the caller has confused which handshake it
 * is in, and accepting it would leave the connection settled as something
 * neither side meant.
 *
 * A session's meta (`cwd`, `repo_root`, `transcript_path`, `title`, ...) is
 * taken field by field: a greeting that leaves a field out does not withdraw
 * it, and the instance keeps what it already knows for that `sid`. One session
 * reaches an instance as a run of short-lived processes (a session-start hook,
 * a `post`, a session-end hook), none of which knows every field. */
export const HelloArgs = Type.Object({
  role: Role,
  /** The generation the caller speaks. A hello announcing another generation
   * is refused with `bad_request`; there is no path that serves it anyway. */
  protocol_version: Type.Integer({ minimum: 1 }),
  /** Required for `role: "session"`: the session the connection speaks for. */
  sid: Type.Optional(Sid),
  /** Required for `role: "instance"`: the mesh handshake claim. */
  mesh: Type.Optional(MeshHello),
  /** The client build, for display in diagnostics. Nothing gates on it. */
  client_version: Type.Optional(Type.String()),
  /** What a `role: "session"` connection says about itself. All optional: a
   * session states what it knows, and the instance derives or leaves unknown
   * what it is not told. The instance repeats these on the `peers` topic, so
   * they are the same fields under the same names there. */
  repo: Type.Optional(SessionMetaFields.repo),
  ws: Type.Optional(SessionMetaFields.ws),
  cwd: Type.Optional(SessionMetaFields.cwd),
  transcript_path: Type.Optional(SessionMetaFields.transcript_path),
  repo_root: Type.Optional(SessionMetaFields.repo_root),
  branch: Type.Optional(SessionMetaFields.branch),
  title: Type.Optional(SessionMetaFields.title),
  model: Type.Optional(SessionMetaFields.model),
  effort: Type.Optional(SessionMetaFields.effort),
});
export type HelloArgs = Static<typeof HelloArgs>;

/** One instance as seen from the instance answering `hello`. */
export const InstanceInfo = Type.Object(
  {
    /** Absent until the handshake with it has settled: an endpoint an operator
     * configured is known before anything answers there, and leaving such a
     * peer out of the list would hide the very entry whose link is down. */
    id: Type.Optional(InstanceId),
    /** The base URL it is published at, which a peer dials as `<endpoint>ws`,
     * that scheme included — the WebSocket upgrades from an HTTP request.
     * An attribute of the instance like the host below: it is what a peer
     * connects to and authenticates against, and it may change under a fixed
     * `id` when the instance moves. Absent for the same
     * reason it is absent from the reply's own `endpoint`: an instance in no
     * mesh has no URL to be dialed at, including on its own line. */
    endpoint: Type.Optional(Endpoint),
    /** The host it runs on. An attribute of the instance, not its identity —
     * one host may run several instances. */
    host: Type.String({ minLength: 1 }),
    /** Whether the answering instance can currently reach it. */
    reachable: Type.Boolean(),
  },
  { $id: "InstanceInfo" },
);
export type InstanceInfo = Static<typeof InstanceInfo>;

export const HelloResult = Type.Object({
  protocol_version: Type.Integer({ minimum: 1 }),
  /** The instance answering. Every other id in the reply is relative to it. */
  instance: InstanceId,
  /** The base URL the answering instance is published at, under which its own
   * routes (`ws`, `mesh/…`, `auth/…`) sit. Stated beside the id because the
   * caller reached it by some URL of its own — a proxy's, an alias — and what a
   * peer is to dial is neither that nor derivable from the id. Absent on an
   * instance that joins no mesh: it is reached by the people and sessions on
   * its own machine, and it has no URL to give a peer. */
  endpoint: Type.Optional(Endpoint),
  /** The instances this one knows of, itself included. */
  instances: Type.Array(InstanceInfo),
  /** What this instance can do. An op whose `capability` is absent here
   * answers `capability_unavailable`, so a client can tell which ops are worth
   * offering before it calls any of them. */
  capabilities: Type.Array(Capability),
  /** The daemon build, for display. */
  version: Type.String(),
  started_at: Timestamp,
  /** Where a person opens the terminal a session runs in: the base URL of the
   * gateway that fronts this instance's terminals. A session's terminal names
   * itself in `terminal_id` on the `agents` topic, and the gateway's URL for it
   * is `<terminal_gateway>/sessions/<terminal_id>` — so the base URL carries no
   * trailing slash, the path below it being the gateway's spelling and not this
   * contract's.
   *
   * Stated by the instance because only it knows which gateway stands in front
   * of the machine its sessions run on; a client has no way to derive one from
   * the endpoint it reached. Absent where the instance cannot reach its
   * sessions' terminals at all, which is the same condition that leaves the
   * `terminal` capability out of the set above. */
  terminal_gateway: Type.Optional(
    Type.String({ pattern: "^https?://[^/?#\\s]+(/[^?#\\s]*[^/?#\\s])?$" }),
  ),
  /** When this connection's authorization runs out, after which the instance
   * closes it. Present on a connection an access token opened; absent where
   * reaching the instance is itself the permission (the Unix socket) or where
   * the connection is a mesh link. The person's client renews before this
   * instant with `auth_refresh` rather than reconnecting. */
  auth_expires_at: Type.Optional(Timestamp),
});
export type HelloResult = Static<typeof HelloResult>;

export const HelloRequest = request("hello", HelloArgs);
export const HelloResponse = response("hello", HelloResult);
