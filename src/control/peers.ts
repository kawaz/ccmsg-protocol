import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, Sid, Timestamp } from "../identifiers.ts";
import { SessionMetaFields } from "../session-meta.ts";

/** How a session stands, as the instance holding it derives it.
 *
 * The instance states the classification rather than the raw inputs it read,
 * so every client shows the same session the same way. The first three appear
 * on connected sessions, the last two on sessions the instance has lost; a
 * client that groups its list groups on this field alone.
 *
 * Being pinned is not one of these: a person pins a session, and the mark
 * travels beside the classification rather than replacing it. */
export const SessionState = Type.Union(
  [
    /** Stopped at something a person has to answer: a dialog it opened, or a
     * turn that ended in an upstream error. */
    Type.Literal("waiting"),
    Type.Literal("live"),
    /** Alive, but reachable through neither a client connection nor a
     * terminal, so nothing here can act on it. */
    Type.Literal("live_unmanaged"),
    /** Gone, having said it was stopping. */
    Type.Literal("paused"),
    /** Gone without saying so. */
    Type.Literal("disappeared"),
  ],
  { $id: "SessionState" },
);
export type SessionState = Static<typeof SessionState>;

/** How long a lost session's row is kept after it was last seen, before the
 * instance forgets it and the row leaves as a removal. The same window the inbox
 * keeps undelivered messages for: what a person comes back to
 * is one thing — the session and what was said to it — so the two cannot expire
 * at different times. */
export const LAST_LIVE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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

/** One session an instance knows of, connected or lost.
 *
 * The paths are the host's, so the entry names the instance holding them:
 * `peers` carries every instance's sessions in one list, and two hosts' paths
 * would otherwise be indistinguishable. The pair `instance` and `sid` is also
 * what a later row is matched against, since one session lives on one
 * instance.
 *
 * Connected and lost sessions are one kind of row rather than two lists: a
 * session registering or going quiet moves it between the two, and a row that
 * changed lists while keeping its identity is an update of that row. Which it
 * is now is the `state` below, and the fields that only a lost session has
 * (`last_seen_at`, `stopped_at`, and what it must resume as) are stated
 * alongside the connection fields it kept. */
export const PeerInfo = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    repo: SessionMetaFields.repo,
    ws: SessionMetaFields.ws,
    cwd: SessionMetaFields.cwd,
    /** Present when the session announced one the instance accepted. What an
     * instance accepts is its own rule — the reference one takes a path under
     * the `projects/` tree of its own config home, so that a session cannot
     * turn a transcript read into a read of any file it names. */
    transcript_path: Type.Optional(SessionMetaFields.transcript_path),
    repo_root: Type.Optional(SessionMetaFields.repo_root),
    branch: Type.Optional(SessionMetaFields.branch),
    /** The session's own title, as it named it. Also what resolves a display
     * name for this session elsewhere — a message's `from_label`, a
     * notification's `sid_label` — so the material for those is on the row that
     * every client already holds. */
    title: Type.Optional(SessionMetaFields.title),
    /** How this session stands, which is also what separates a connected row
     * from one its instance has lost. Absent from an instance that states no
     * classification, and a client then shows the session without grouping it
     * rather than guessing one. */
    state: Type.Optional(SessionState),
    /** Set while a person has pinned this session. Absent means not pinned. */
    pinned: Type.Optional(Type.Boolean()),
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
    /** When inference last ran for this session, as the gateway saw it.
     *
     * How busy a session is, carried as an attribute of the row rather than
     * folded into `state`: a session is busy while it stands in any of the
     * connected classifications, so the two answer different questions and
     * collapsing them would lose one. It is an instant rather than a flag
     * because there is no moment a request stops being in flight that anything
     * observes — a client reads recency and decides its own threshold.
     *
     * Absent from an instance with no gateway configured, where nothing
     * observes inference at all. That is not "idle": a client shows such a
     * session without the mark rather than as quiet. */
    gateway_active_at: Type.Optional(Timestamp),
    /** Whether the asking session can reach this one with the harness's own
     * cross-session messaging, which does not cross config homes. Computed
     * against the asker, so it never appears on the asker's own entry nor for a
     * person, who has no config home to compare. Absent means one side's config
     * home is unknown: an unflagged peer merely costs a message sent the long
     * way, a wrongly flagged one costs a message that never arrives. */
    send_message: Type.Optional(Type.Boolean()),
    /** The build of the client that last greeted for this session. */
    client_version: Type.Optional(Type.String()),
    /** The generation the connected client speaks. Absent from a row that has
     * no connection to read one from — the instance's state file names such a
     * session live without any client ever having greeted it, so there is no
     * generation to state. */
    protocol_version: Type.Optional(Type.Integer({ minimum: 1 })),
    /** Set while some client of this session is being refused. */
    stale_client: Type.Optional(StaleClientInfo),
    /** The newest instant this session is known to have been alive. Stated on a
     * row its instance has lost, where it is what the retention window above is
     * measured from; a connected row is alive now and states none. */
    last_seen_at: Type.Optional(Timestamp),
    /** When the session said it was stopping. Its presence is what makes a lost
     * session a pause rather than a disappearance: one that goes without a word
     * leaves nothing to stamp here. */
    stopped_at: Type.Optional(Timestamp),
    /** What its last turn ran as, in the transcript's own spelling, read back
     * from the transcript rather than copied from the connection: what a lost
     * session must resume as is a property of where it actually stopped. A
     * resume must not quietly switch the session to something else. */
    model: Type.Optional(SessionMetaFields.model),
    effort: Type.Optional(SessionMetaFields.effort),
  },
  { $id: "PeerInfo" },
);
export type PeerInfo = Static<typeof PeerInfo>;

/** A row that is gone: the session has been forgotten by the instance that
 * held it, whether its retention window ran out or a person dropped it.
 *
 * A removal has to be a marked element rather than an absence, since a frame
 * carries only what changed and an absence in it says nothing. It names the
 * same pair every row is matched by and nothing else — there is no row left to
 * describe. */
export const PeerRemoved = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    removed: Type.Literal(true),
  },
  { $id: "PeerRemoved" },
);
export type PeerRemoved = Static<typeof PeerRemoved>;

export const PeerElement = Type.Union([PeerInfo, PeerRemoved], { $id: "PeerElement" });
export type PeerElement = Static<typeof PeerElement>;

/** The `peers` topic.
 *
 * Elements: each frame carries the rows that changed, matched by their
 * `instance` and `sid`, and rows it does not name are left as they were. A row
 * changes on its own — one session becoming busy, another going quiet — and
 * restating every row an instance knows would send a list to report one field.
 *
 * The opening `snapshot: true` frame carries every row the instance holds,
 * connected and lost alike. */
export const PeersFrame = topicFrame("peers", Type.Object({ peers: Type.Array(PeerElement) }));
