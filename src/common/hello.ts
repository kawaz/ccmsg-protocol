import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Capability, InstanceId, Role, Sid, Timestamp } from "../identifiers.ts";
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
    /** The endpoint URL the connecting instance claims to be. */
    iss: InstanceId,
    /** The endpoint URL it believes it is connecting to. Compared whole
     * against the receiver's own URL, which is what stops a signature made for
     * one instance from being replayed at another on the same host. */
    aud: InstanceId,
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
 * neither side meant. */
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
    id: InstanceId,
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
  /** The instances this one knows of, itself included. */
  instances: Type.Array(InstanceInfo),
  /** What this instance can do. An op whose `capability` is absent here
   * answers `capability_unavailable`, so a client can tell which ops are worth
   * offering before it calls any of them. */
  capabilities: Type.Array(Capability),
  /** The daemon build, for display. */
  version: Type.String(),
  started_at: Timestamp,
});
export type HelloResult = Static<typeof HelloResult>;

export const HelloRequest = request("hello", HelloArgs);
export const HelloResponse = response("hello", HelloResult);
