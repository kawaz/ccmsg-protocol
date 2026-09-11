import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** One task on the session's list. */
export const SessionTodo = Type.Object(
  {
    id: Type.String(),
    subject: Type.String(),
    /** Pending, in progress, done — an open set the harness may grow. */
    status: Type.String(),
    owner: Type.Optional(Type.String()),
    /** Tasks this one waits on, and tasks that wait on it. Both are read out of
     * the session's own transcript, and both are empty when nothing was
     * declared. */
    blocked_by: Type.Array(Type.String()),
    blocks: Type.Array(Type.String()),
  },
  { $id: "SessionTodo" },
);
export type SessionTodo = Static<typeof SessionTodo>;

/** One phase of a workflow, with how much of it is finished. */
export const WorkflowPhaseStatus = Type.Object(
  { title: Type.String(), done: Type.Integer({ minimum: 0 }), total: Type.Integer({ minimum: 0 }) },
  { $id: "WorkflowPhaseStatus" },
);
export type WorkflowPhaseStatus = Static<typeof WorkflowPhaseStatus>;

/** One agent belonging to a workflow.
 *
 * Nearly everything is optional because a finished agent and a running one are
 * observed from different places: a finished one is described by the record the
 * workflow wrote, a running one only by the fact that it started and has not
 * reported back. */
export const WorkflowAgentStatus = Type.Object(
  {
    /** The handle a transcript read accepts for this agent. */
    agent_id: Type.String(),
    label: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    agent_type: Type.Optional(Type.String()),
    /** How it is getting on. An open set: most values come from the workflow's
     * own record, and "still running" is inferred from a start with no result. */
    state: Type.String(),
    tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    tool_calls: Type.Optional(Type.Integer({ minimum: 0 })),
    phase_index: Type.Optional(Type.Integer({ minimum: 0 })),
    phase_title: Type.Optional(Type.String()),
    last_tool: Type.Optional(Type.String()),
    result_preview: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    started_at: Type.Optional(Timestamp),
    duration_ms: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { $id: "WorkflowAgentStatus" },
);
export type WorkflowAgentStatus = Static<typeof WorkflowAgentStatus>;

export const SessionWorkflowStatus = Type.Object(
  {
    /** Correlates the workflow with the notification announcing its result. */
    task_id: Type.String(),
    name: Type.String(),
    summary: Type.Optional(Type.String()),
    /** Running, or one of the ways it can end. An open set. */
    status: Type.String(),
    started_at: Timestamp,
    ended_at: Type.Optional(Timestamp),
    /** Names this run, and is what a transcript read asks for to reach the
     * agents belonging to it. */
    run_id: Type.Optional(Type.String()),
    /** The declared phases. Empty while the run is still going, since a
     * workflow declares them in the record it writes when it finishes. */
    phases: Type.Array(WorkflowPhaseStatus),
    /** From that record once it exists, and from the run's journal before then.
     * Empty when neither could be read. */
    agents: Type.Array(WorkflowAgentStatus),
  },
  { $id: "SessionWorkflowStatus" },
);
export type SessionWorkflowStatus = Static<typeof SessionWorkflowStatus>;

export const SessionBackgroundStatus = Type.Object(
  {
    task_id: Type.String(),
    kind: Type.Union([Type.Literal("monitor"), Type.Literal("bash"), Type.Literal("agent")]),
    description: Type.String(),
    /** Running, or one of the ways it can end. An open set. */
    status: Type.String(),
    started_at: Timestamp,
    ended_at: Type.Optional(Timestamp),
    /** Which kind of agent was spawned. Only for `agent`. */
    agent_type: Type.Optional(Type.String()),
  },
  { $id: "SessionBackgroundStatus" },
);
export type SessionBackgroundStatus = Static<typeof SessionBackgroundStatus>;

/** How much context the session's own turns are carrying.
 *
 * The raw counts travel and the ceiling is left to the reader: what a model's
 * limit is can be overridden where the session runs, and the transcript does
 * not record that, so a limit computed here would be wrong exactly where it
 * mattered. */
export const SessionContextUsage = Type.Object(
  {
    /** Everything the last turn had to read. */
    tokens: Type.Integer({ minimum: 0 }),
    /** As the transcript spells it. */
    model: Type.String(),
    /** Absent from transcripts written before the harness recorded it. */
    effort: Type.Optional(Type.String()),
    /** The turn this reading was taken from. */
    observed_at: Timestamp,
  },
  { $id: "SessionContextUsage" },
);
export type SessionContextUsage = Static<typeof SessionContextUsage>;

/** A teammate of the session, as its transcript shows it. The teammate's own
 * sense of whether it is busy is not reachable, so the state is an estimate. */
export const SessionTeammate = Type.Object(
  {
    name: Type.String(),
    /** Whether the spawn was seen to succeed. */
    spawned: Type.Boolean(),
    agent_type: Type.Optional(Type.String()),
    color: Type.Optional(Type.String()),
    spawned_at: Type.Optional(Timestamp),
    last_sent_at: Type.Optional(Timestamp),
    last_received_at: Type.Optional(Timestamp),
    /** An open set, taken from the latest thing observed. */
    state: Type.String(),
    /** Fixed when it was spawned, in the raw spelling. */
    model: Type.Optional(Type.String()),
  },
  { $id: "SessionTeammate" },
);
export type SessionTeammate = Static<typeof SessionTeammate>;

/** One agent below the session.
 *
 * A node whose parent cannot be located — the parent's transcript has rotated,
 * or was never seen — is surfaced at the top rather than dropped, so it stays
 * reachable instead of quietly disappearing. */
export const AgentTreeNode = Type.Recursive(
  (self) =>
    Type.Object({
      /** Stable across reads, and what a transcript read asks for. */
      agent_id: Type.String(),
      /** Present for a teammate: the name it is addressed by, which is its
       * observable identity even though it resolves to the same transcript. */
      teammate_name: Type.Optional(Type.String()),
      /** The role it was spawned as. Absent only when its record is malformed. */
      agent_type: Type.Optional(Type.String()),
      /** The spawn's description, verbatim. */
      description: Type.Optional(Type.String()),
      color: Type.Optional(Type.String()),
      model: Type.Optional(Type.String()),
      team_name: Type.Optional(Type.String()),
      /** How far below the session it sits; a direct child is zero. */
      spawn_depth: Type.Integer({ minimum: 0 }),
      /** Where the node came from: a long-lived teammate, a one-off spawn, or a
       * member of a workflow run. */
      kind: Type.Union([
        Type.Literal("teammate"),
        Type.Literal("subagent"),
        Type.Literal("workflow_member"),
      ]),
      /** The run it belongs to. Only for a workflow member. */
      workflow_id: Type.Optional(Type.String()),
      /** An estimate, and an open set. Direct children reuse what the session's
       * own fold observed; deeper ones fall back to how recently their
       * transcript was touched. */
      state: Type.String(),
      /** When its transcript was last written to. */
      last_activity_at: Type.Optional(Timestamp),
      children: Type.Array(self),
    }),
  { $id: "AgentTreeNode" },
);
export type AgentTreeNode = Static<typeof AgentTreeNode>;

/** One phase of a workflow run, with the members assigned to it. */
export const AgentTreeWorkflowPhase = Type.Object(
  {
    /** Counting from one, as the workflow declares its phases. */
    index: Type.Integer({ minimum: 1 }),
    title: Type.String(),
    done: Type.Integer({ minimum: 0 }),
    total: Type.Integer({ minimum: 0 }),
    members: Type.Array(AgentTreeNode),
  },
  { $id: "AgentTreeWorkflowPhase" },
);
export type AgentTreeWorkflowPhase = Static<typeof AgentTreeWorkflowPhase>;

/** One workflow run's members, grouped by phase. */
export const AgentTreeWorkflowGroup = Type.Object(
  {
    workflow_id: Type.String(),
    /** The whole run's progress, across every phase. */
    done: Type.Integer({ minimum: 0 }),
    total: Type.Integer({ minimum: 0 }),
    /** Empty while the run has not declared its phases yet, in which case every
     * member is unassigned. */
    phases: Type.Array(AgentTreeWorkflowPhase),
    /** Members no phase could be found for. Normally empty. */
    unassigned: Type.Array(AgentTreeNode),
    /** The newest activity anywhere in the run, for ordering runs against each
     * other. */
    last_activity_at: Type.Optional(Timestamp),
  },
  { $id: "AgentTreeWorkflowGroup" },
);
export type AgentTreeWorkflowGroup = Static<typeof AgentTreeWorkflowGroup>;

/** Everything running below the session, in the three kinds it distinguishes.
 * A kind with nothing in it is an empty list rather than an absent one. */
export const AgentTreeGroups = Type.Object(
  {
    /** Long-lived members of the session's team, all directly below it. */
    teammates: Type.Array(AgentTreeNode),
    /** One-off spawns, nested where one spawned another. */
    agents: Type.Array(AgentTreeNode),
    /** One group per workflow run. */
    workflows: Type.Array(AgentTreeWorkflowGroup),
  },
  { $id: "AgentTreeGroups" },
);
export type AgentTreeGroups = Static<typeof AgentTreeGroups>;

/** Which kind of transcript record named a file outside the session's root.
 * Grouping is all this decides; both origins grant the same single-file read. */
export const ExternalFile = Type.Object(
  {
    path: Type.String(),
    /** A file tool touched it, or it arrived as an attachment. A path named
     * both ways is reported as whichever came first. */
    origin: Type.Union([Type.Literal("tool"), Type.Literal("attachment")]),
  },
  { $id: "ExternalFile" },
);
export type ExternalFile = Static<typeof ExternalFile>;

/** One folder the session's editor workspace names.
 *
 * The path is the allowlist key a `workspace` read is checked against; the name
 * is for display, and falls back to the folder's own basename. Duplicates are
 * removed, so a folder named twice appears once. */
export const WorkspaceFolder = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    /** Absolute, fully resolved, and without a trailing separator. */
    path: Type.String({ minLength: 1 }),
  },
  { $id: "WorkspaceFolder" },
);
export type WorkspaceFolder = Static<typeof WorkspaceFolder>;

/** An error the harness wrote in the session's own voice, seen as the last
 * thing its main context did.
 *
 * The harness phrases these as though the agent were speaking — that a prompt
 * is too long, that a login is needed — but they are the harness reporting a
 * turn that stopped, and the session sits idle until a person intervenes.
 *
 * Only the latest turn counts: a real turn after one of these clears it, so a
 * session that hit a passing failure and carried on is not flagged. An error
 * inside a subagent never sets it, since a failed subagent does not stop the
 * session. */
export const SessionApiError = Type.Object(
  {
    /** The error as written, so a reader can see why the session stopped. May
     * run to several lines. */
    text: Type.String(),
    occurred_at: Timestamp,
  },
  { $id: "SessionApiError" },
);
export type SessionApiError = Static<typeof SessionApiError>;

/** Everything the instance can fold out of one session's transcript. */
export const SessionStatusSnapshot = Type.Object(
  {
    todos: Type.Array(SessionTodo),
    workflows: Type.Array(SessionWorkflowStatus),
    background: Type.Array(SessionBackgroundStatus),
    teammates: Type.Array(SessionTeammate),
    agent_tree: AgentTreeGroups,
    /** Absolute paths outside the session's root that its transcript names.
     * This is exactly the allowlist an `external` read is checked against — one
     * list, so nothing can honour one origin and forget another. */
    external_files: Type.Array(ExternalFile),
    workspace_folders: Type.Array(WorkspaceFolder),
    /** Absent when the transcript's last turn carried no reading. */
    context: Type.Optional(SessionContextUsage),
    /** Present only while the session is stopped on one. */
    api_error: Type.Optional(SessionApiError),
  },
  { $id: "SessionStatusSnapshot" },
);
export type SessionStatusSnapshot = Static<typeof SessionStatusSnapshot>;

/** The `session.status:<sid>` topic. Whole-value: the fold is recomputed and
 * sent entire whenever something in the transcript changes it. */
export const SessionStatusFrame = topicFrame(
  "session.status",
  Type.Intersect([Type.Object({ sid: Sid }), SessionStatusSnapshot]),
);
