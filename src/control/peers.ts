import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, Sid, TerminalId, Timestamp } from "../identifiers.ts";
import { SessionMetaFields } from "../session-meta.ts";

/** How recently the gateway must have seen inference for a session for that
 * alone to say the session is alive. A session whose processes are all gone but
 * whose inference is still running is alive: the request outlives the terminal
 * it was typed in. */
export const GATEWAY_LIVE_WINDOW_MS = 5 * 60 * 1000;

/** One process running a session.
 *
 * A session and a run of it are two things: the session is the transcript and
 * the folded state, and lives whether nothing or two processes are running it.
 * This is the process — what a signal reaches, what a terminal shows, what a
 * connection speaks over. */
export const SessionRun = Type.Object(
  {
    /** The harness process. Present when the harness's state file names one or
     * a launcher started it; a run known only by its connection has none, and
     * nothing in this contract can signal such a run. */
    pid: Type.Optional(Type.Integer({ minimum: 1 })),
    /** When that process started, which is what tells a pid the OS has handed
     * to something else from the run it was read for. Stated wherever `pid`
     * is. */
    started_at: Type.Optional(Timestamp),
    terminal_id: Type.Optional(TerminalId),
    /** Whether a connection of this run is open to the instance right now. */
    connected: Type.Boolean(),
  },
  { $id: "SessionRun" },
);
export type SessionRun = Static<typeof SessionRun>;

/** What the `session.status` fold for this session is worth.
 *
 * A client reads this before it reads the fold: the values below say whether
 * there is a transcript at all, whether the instance has caught up with it, and
 * whether anything it says can still be trusted. */
export const SessionStatusStanding = Type.Union(
  [
    /** No transcript, so there is nothing to fold. A session that has just
     * started stands here until the harness writes its first record. */
    Type.Literal("absent"),
    /** The transcript is being read from the top; what the fold says so far is
     * incomplete. */
    Type.Literal("folding"),
    Type.Literal("ready"),
    /** Two or more runs are writing the same transcript, so the instance stops
     * updating the fold and stops carrying the transcript's additions. What it
     * states is the last value it could trust. */
    Type.Literal("frozen"),
  ],
  { $id: "SessionStatusStanding" },
);
export type SessionStatusStanding = Static<typeof SessionStatusStanding>;

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
 * is now is read off `runs` and `stopped_at` by `liveness` below, and the
 * fields that only a lost session has (`last_seen_at`, `stopped_at`, and what
 * it must resume as) are stated alongside the connection fields it kept. */
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
    /** Every process the instance can see running this session, which is also
     * what separates a connected row from one its instance has lost. Empty
     * means none is running, which is a row a person can still resume; two or
     * more mean the harness let the same session be resumed while it was
     * running, and nothing here picks one of them.
     *
     * The observation itself rather than a count or a verdict: which process,
     * where it can be opened, and whether it is connected are each what a
     * person decides on, and a session role holds this row without ever seeing
     * the `agents` topic. */
    runs: Type.Array(SessionRun),
    /** What this session's `session.status` fold is worth just now. */
    session_status: SessionStatusStanding,
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
     * folded into how it stands: a session is busy whether one process or none
     * is running it, so the two answer different questions and collapsing them
     * would lose one. It is also what says a session with no run left is still
     * alive, the request outliving the process. It is an instant rather than a flag
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
     * leaves nothing to stamp here. It says something only while `runs` is
     * empty — a session that declared it was stopping and is running again has
     * a stamp older than the run. */
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

/** Where a session stands as a thing that is or is not running.
 *
 * `duplicated` is not a degree of aliveness but the answer to a different
 * question — how many processes — which is why it wins over the rest: a session
 * two processes are writing is one nothing should be read from, however alive
 * it looks. */
export type Liveness = "alive" | "duplicated" | "paused" | "disappeared";

/** How a session stands, read off the row.
 *
 * Derived here rather than stated on the wire, and here rather than once per
 * side: an instance and a client that each wrote this arithmetic would show the
 * same row two ways. */
export function liveness(
  row: {
    runs: readonly { connected: boolean }[];
    stopped_at?: number;
    gateway_active_at?: number;
  },
  now: number,
): Liveness {
  if (row.runs.length >= 2) return "duplicated";
  const running =
    (row.runs.length > 0 && row.stopped_at === undefined) ||
    (row.gateway_active_at !== undefined && now - row.gateway_active_at <= GATEWAY_LIVE_WINDOW_MS);
  if (running) return "alive";
  return row.stopped_at === undefined ? "disappeared" : "paused";
}

/** Whether anything here can act on the session: some run of it is connected or
 * names a terminal. A session alive with neither is one nothing can be handed
 * to and nothing can be typed into. */
export function reachable(row: {
  runs: readonly { connected: boolean; terminal_id?: string }[];
}): boolean {
  return row.runs.some((run) => run.connected || run.terminal_id !== undefined);
}

/** Whether something is out that a person has to answer: a dialog the harness
 * is holding open, or a turn that ended on an upstream error.
 *
 * Both materials belong to the `user` role — the `agents` row and the status
 * fold — which is why this takes them rather than a `peers` row: a session role
 * asking how another session stands has `runs` and `stopped_at` and no way to
 * see this one. Either argument may be missing, which says only that its
 * material was not there to read. */
export function waiting(
  agentsRow: { waiting_for?: string } | undefined,
  status: { api_error?: unknown } | undefined,
): boolean {
  return agentsRow?.waiting_for !== undefined || status?.api_error !== undefined;
}

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
