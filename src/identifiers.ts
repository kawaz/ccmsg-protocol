import { type Static, Type } from "@sinclair/typebox";

/** A session id: the uuid Claude Code gives its own session. Globally unique,
 * so it names a session across the whole cluster without an instance prefix. */
export const Sid = Type.String({
  $id: "Sid",
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
});
export type Sid = Static<typeof Sid>;

/** Who sent a message: a session, or the person at the web UI.
 *
 * A person has no sid — the `user` role greets without one — so the sender of a
 * message cannot be a `Sid` alone. The literal is spelled out rather than left
 * as an absent field, because a reader has to tell "a person sent this" from "a
 * session sent this and the id was lost". Every session id remains a valid
 * sender, so a reader that only knew sids keeps working.
 *
 * There is one person per instance to a session's eye, so the literal carries
 * no id of its own; which browser it was is not a thing this contract names. */
export const Sender = Type.Union([Sid, Type.Literal("user")], { $id: "Sender" });
export type Sender = Static<typeof Sender>;

/** The sender that is the person rather than a session. */
export const USER_SENDER = "user" as const;

/** An instance id: the endpoint URL other instances dial, compared as a whole
 * string including its path (mesh-peer-auth §4.2 — one origin may host several
 * instances, so origin-level comparison would confuse them). The display name
 * lives in config, never on the wire. */
export const InstanceId = Type.String({
  $id: "InstanceId",
  pattern: "^wss?://[^\\s?#]+$",
});
export type InstanceId = Static<typeof InstanceId>;

/** A delivery-frame id: `<instance>/<counter>`, numbered by the instance that
 * issued the frame. It exists so `reply_to` can point at one frame; it is not
 * a cursor and carries no ordering across instances. */
export const Mid = Type.String({
  $id: "Mid",
  pattern: "^wss?://[^\\s?#]+/\\d+$",
});
export type Mid = Static<typeof Mid>;

/** Who a connection speaks as. Set once by `hello` and fixed for the
 * connection's life; the op attribute table's `roles` is checked against it. */
export const Role = Type.Union(
  [Type.Literal("session"), Type.Literal("user"), Type.Literal("instance")],
  { $id: "Role" },
);
export type Role = Static<typeof Role>;

/** A capability name. `hello` returns the set this instance has, and an op
 * whose `capability` is outside that set answers `capability_unavailable`. */
export const Capability = Type.Union(
  [
    Type.Literal("fork"),
    Type.Literal("launcher"),
    /** A gateway webhook source is configured, so request activity arrives to
     * be pushed on the `llm_requests` topic. */
    Type.Literal("llm_events"),
    Type.Literal("llm_stats"),
    Type.Literal("llm_status"),
    Type.Literal("llm_usage"),
    Type.Literal("sandbox"),
    Type.Literal("terminal"),
    Type.Literal("translate"),
  ],
  { $id: "Capability" },
);
export type Capability = Static<typeof Capability>;

/** A Unix-milliseconds timestamp. Every wire field naming a point in time is
 * this type and ends in `_at`; durations carry their unit instead (`*_ms` /
 * `*_secs`). */
export const Timestamp = Type.Integer({ $id: "Timestamp", minimum: 0 });
export type Timestamp = Static<typeof Timestamp>;
