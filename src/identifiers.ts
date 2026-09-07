import { type Static, Type } from "@sinclair/typebox";

/** A session id: the uuid Claude Code gives its own session. Globally unique,
 * so it names a session across the whole cluster without an instance prefix. */
export const Sid = Type.String({
  $id: "Sid",
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
});
export type Sid = Static<typeof Sid>;

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
