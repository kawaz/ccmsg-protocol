import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, Sid, Timestamp } from "../identifiers.ts";
import { upstream } from "../upstream.ts";

/** One session as the harness itself reports it, noted with which config home
 * it was found under.
 *
 * This is the harness's view rather than the instance's: it covers sessions
 * that never connected here, and it carries what only the process knows — its
 * pid, its terminal, the title the session gave itself. The instance renames
 * the fields as it copies them in; the words inside them stay the harness's,
 * which is why the status-like fields are open sets. */
export const AgentInfo = Type.Object(
  {
    sid: Sid,
    /** The instance that polled it, and whose host the pid belongs to. */
    instance: InstanceId,
    pid: Type.Integer({ minimum: 1 }),
    cwd: Type.String(),
    /** Whether the session is one a person is sitting at or one running on its
     * own. An open set. */
    kind: Type.String(),
    started_at: Timestamp,
    /** The session's own title, when it has set one. */
    name: Type.Optional(Type.String()),
    /** What the session is doing. An open set. */
    status: Type.Optional(Type.String()),
    /** What it is waiting on, in the harness's words. */
    waiting_for: Type.Optional(Type.String()),
    /** How a background session ended up. An open set; absent for a session a
     * person is sitting at. */
    state: Type.Optional(Type.String()),
    /** The short handle a background session is addressed by. */
    background_id: Type.Optional(Type.String()),
    /** The config home this row was polled from. */
    config_dir: Type.String(),
    /** The terminal the session runs in, which is the handle a rename types
     * into. Absent when the process does not name one or its environment could
     * not be read. Read from the running process rather than remembered from
     * when it started, since resuming a session gives it a new process. */
    terminal_id: Type.Optional(Type.String()),
    /** Which namespace that terminal lives in. Absent means the process set
     * none, which the multiplexer treats as its default — not the instance's
     * own namespace, which can differ. Typing into the wrong namespace reports a
     * live session as gone. */
    terminal_namespace: Type.Optional(Type.String()),
  },
  { $id: "AgentInfo", ...upstream("claude", "one row of the harness's session list") },
);
export type AgentInfo = Static<typeof AgentInfo>;

/** A row that is gone: the harness no longer reports this session, or the
 * instance that polled it stopped. Marked rather than absent, since a frame
 * carries only what changed. */
export const AgentRemoved = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    removed: Type.Literal(true),
  },
  { $id: "AgentRemoved" },
);
export type AgentRemoved = Static<typeof AgentRemoved>;

export const AgentElement = Type.Union([AgentInfo, AgentRemoved], { $id: "AgentElement" });
export type AgentElement = Static<typeof AgentElement>;

/** The `agents` topic. Elements, like `peers`: the rows that changed since the
 * last frame, matched by their `instance` and `sid`.
 *
 * The instance polls the harness only while somebody is listening here, so the
 * list is as fresh as the subscription is old — and a poll that finds one
 * session's status changed says that, rather than restating every row it read.
 */
export const AgentsFrame = topicFrame(
  "agents",
  Type.Object({
    agents: Type.Array(AgentElement),
    /** When the poll behind these rows ran. Absent before the first one. */
    polled_at: Type.Optional(Timestamp),
  }),
);
