import { type Static, type TSchema, Type } from "@sinclair/typebox";
import { ErrorBody } from "./errors.ts";
import { InstanceId } from "./identifiers.ts";

/** The generation of this wire contract. Within a generation, only optional
 * fields and whole new ops may be added; a removal or a change of meaning
 * raises it. Peers announcing another generation are refused, on client
 * connections and on mesh links alike. */
export const PROTOCOL_VERSION = 2;

/** Fields a request carries in addition to its own arguments.
 *
 * `request_id` pairs a reply with its request so one connection can run its
 * requests concurrently instead of in arrival order. Uniqueness only has to
 * hold among one connection's in-flight requests.
 *
 * The three mesh fields are the whole of the mesh plane: an op forwarded to
 * another instance is the same op in the same shape, wrapped in these. */
export const RequestEnvelope = Type.Object(
  {
    request_id: Type.String({ minLength: 1 }),
    /** Set when the caller wants this op run by a named instance rather than
     * by the one it is connected to. */
    to_instance: Type.Optional(InstanceId),
    /** Stamped by the forwarding instance so the destination knows where the
     * reply goes back to. */
    from_instance: Type.Optional(InstanceId),
    /** Instances this request has already passed through, in order. A request
     * that would revisit an instance is dropped rather than looped. */
    hops: Type.Optional(Type.Array(InstanceId)),
  },
  { $id: "RequestEnvelope" },
);
export type RequestEnvelope = Static<typeof RequestEnvelope>;

/** Compose an op's own arguments with the request envelope. */
export function request<T extends TSchema>(op: string, args: T) {
  return Type.Intersect([Type.Object({ op: Type.Literal(op) }), args, RequestEnvelope], {
    $id: `${op}:request`,
  });
}

/** Compose an op's reply body with `ok: true` and the correlation id.
 *
 * `request_id` is required, unlike the generation that introduced it: a reply
 * that cannot name its request settles no caller, and the only replies in that
 * position are the reject-before-dispatch failures below. */
export function response<T extends TSchema>(op: string, body: T) {
  return Type.Intersect(
    [Type.Object({ ok: Type.Literal(true), request_id: Type.String({ minLength: 1 }) }), body],
    { $id: `${op}:response` },
  );
}

/** A failed reply. `request_id` is absent only where the request could not be
 * identified at all (unparseable JSON, missing `op`, missing `request_id`). */
export const ErrorResponse = Type.Object(
  {
    ok: Type.Literal(false),
    request_id: Type.Optional(Type.String({ minLength: 1 })),
    error: ErrorBody,
  },
  { $id: "ErrorResponse" },
);
export type ErrorResponse = Static<typeof ErrorResponse>;

/** A frame pushed on a topic the connection subscribed to.
 *
 * Snapshot and delta share one shape: the first frame after `topic_subscribe`
 * carries `snapshot: true` and the whole current value, and later frames carry
 * the same payload type as a change. `instance` names where the frame came
 * from, which is what keeps whole-value topics from several instances out of
 * each other's way. */
export function topicFrame<T extends TSchema>(topic: string, data: T) {
  return Type.Intersect(
    [
      Type.Object({
        ev: Type.Literal("topic"),
        topic: Type.String({ minLength: 1 }),
        snapshot: Type.Optional(Type.Literal(true)),
        instance: InstanceId,
      }),
      Type.Object({ data }),
    ],
    { $id: `topic:${topic}` },
  );
}

/** The daemon is going down and will come back on the same socket. */
export const RestartingEvent = Type.Object(
  { ev: Type.Literal("restarting"), instance: InstanceId },
  { $id: "RestartingEvent" },
);
export type RestartingEvent = Static<typeof RestartingEvent>;

/** Another connection took over this session's subscription; this one will
 * receive nothing further. About this connection alone, so it carries no
 * originating instance. */
export const SubscribeSupersededEvent = Type.Object(
  { ev: Type.Literal("subscribe_superseded") },
  { $id: "SubscribeSupersededEvent" },
);
export type SubscribeSupersededEvent = Static<typeof SubscribeSupersededEvent>;

/** The instance's view of the host link changed. */
export const NetOnlineEvent = Type.Object(
  { ev: Type.Literal("net_online"), instance: InstanceId, online: Type.Boolean() },
  { $id: "NetOnlineEvent" },
);
export type NetOnlineEvent = Static<typeof NetOnlineEvent>;

/** Events about the connection itself rather than about a topic. */
export const ConnectionEvent = Type.Union(
  [RestartingEvent, SubscribeSupersededEvent, NetOnlineEvent],
  { $id: "ConnectionEvent" },
);
export type ConnectionEvent = Static<typeof ConnectionEvent>;
