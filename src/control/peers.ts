import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, Sid, Timestamp } from "../identifiers.ts";

/** A client of one session whose greeting was refused.
 *
 * Overwritten rather than accumulated: such a client reconnects every few
 * seconds, so what is worth reading is that it is still happening, not how
 * often it has tried. The session itself is fine — some other process of the
 * same session is the stale one, and it is invisible otherwise, retrying
 * forever with nothing in sight moving. */
export const StaleClientInfo = Type.Object(
  {
    last_seen_at: Timestamp,
    /** The build it reported, when it got far enough to report one. */
    version: Type.Optional(Type.String()),
    /** The generation it announced. Absent means it was refused before it could
     * be read as a greeting at all. */
    protocol_version: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { $id: "StaleClientInfo" },
);
export type StaleClientInfo = Static<typeof StaleClientInfo>;

/** One connected session.
 *
 * The paths are the host's, so the entry names the instance holding them:
 * `peers` carries every instance's sessions in one list, and two hosts' paths
 * would otherwise be indistinguishable. */
export const PeerInfo = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    repo: Type.String(),
    ws: Type.String(),
    cwd: Type.String(),
    /** Present when the session announced a transcript the instance accepted,
     * which is what decides whether its transcript can be read at all. */
    transcript_path: Type.Optional(Type.String()),
    /** Present when the session announced a repository container the instance
     * accepted. File browsing is rooted here rather than at the working
     * directory, so sibling workspaces are reachable. */
    repo_root: Type.Optional(Type.String()),
    branch: Type.Optional(Type.String()),
    /** When this session first registered with the instance. Stable across its
     * reconnections, and reset when the instance restarts. */
    connected_at: Type.Optional(Timestamp),
    /** The session's most recent request on any of its connections. */
    last_activity_at: Type.Optional(Timestamp),
    /** When a person last put something into this session: a prompt they typed,
     * or a message they sent it. Distinct from the activity above, which every
     * request the session makes on its own re-stamps — this one moves only when
     * a person speaks, which is what an attention-ordered list wants. Absent
     * while none has been found; a client orders such a session after every
     * session that has one rather than treating it as long ago. */
    last_user_input_at: Type.Optional(Timestamp),
    /** Whether the asking session can reach this one with the harness's own
     * cross-session messaging, which does not cross config homes. Computed
     * against the asker, so it never appears on the asker's own entry nor for a
     * person, who has no config home to compare. Absent means one side's config
     * home is unknown: an unflagged peer merely costs a message sent the long
     * way, a wrongly flagged one costs a message that never arrives. */
    send_message: Type.Optional(Type.Boolean()),
    /** The build of the client that last greeted for this session. */
    client_version: Type.Optional(Type.String()),
    /** The generation that client speaks. Always stated: a client that does not
     * announce one is refused, so there is no connected session whose
     * generation is a guess. */
    protocol_version: Type.Integer({ minimum: 1 }),
    /** Set while some client of this session is being refused. */
    stale_client: Type.Optional(StaleClientInfo),
  },
  { $id: "PeerInfo" },
);
export type PeerInfo = Static<typeof PeerInfo>;

/** One session that was connected when its instance last saw it, and has not
 * come back.
 *
 * The connection fields are a frozen copy of what that session looked like at
 * the last snapshot, not a live reading — by definition it is not connected
 * while it appears here. The model and effort are the exception: they are read
 * back from the transcript's last turn, because what the session must resume as
 * is a property of where it actually stopped, not of when the snapshot was
 * written. An entry leaves this list the moment its session registers again, so
 * a fully recovered host shows none. */
export const LastLiveSession = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    repo: Type.String(),
    ws: Type.String(),
    cwd: Type.String(),
    /** Also where the model and effort below were read from. */
    transcript_path: Type.Optional(Type.String()),
    repo_root: Type.Optional(Type.String()),
    branch: Type.Optional(Type.String()),
    /** The session's own title as of the snapshot, when one was known. Absent
     * means not known, never untitled. */
    title: Type.Optional(Type.String()),
    connected_at: Type.Optional(Timestamp),
    /** The newest instant this session is known to have been alive. */
    last_seen_at: Timestamp,
    /** What its last turn ran as, in the transcript's own spelling. A resume
     * must not quietly switch the session to something else. */
    model: Type.Optional(Type.String()),
    effort: Type.Optional(Type.String()),
  },
  { $id: "LastLiveSession" },
);
export type LastLiveSession = Static<typeof LastLiveSession>;

/** The `peers` topic.
 *
 * Whole-value per instance: a frame replaces everything previously known from
 * the instance that sent it and leaves other instances' entries alone, which is
 * what lets several instances each state their whole list without colliding.
 *
 * Both lists travel together because a session registering is exactly what
 * moves it from one to the other. */
export const PeersFrame = topicFrame(
  "peers",
  Type.Object({
    peers: Type.Array(PeerInfo),
    last_live: Type.Array(LastLiveSession),
  }),
);
