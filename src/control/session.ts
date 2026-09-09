import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { InstanceId, Sid, Timestamp } from "../identifiers.ts";

/** Ends the OS process behind a session.
 *
 * The request names a session, never a pid: the instance resolves sid to pid
 * itself at the moment it signals, and a pid the caller asserted would be a
 * weaker basis for killing something than that. */
export const SessionKillArgs = Type.Object({
  sid: Sid,
  /** Escalate to an unconditional kill. The instance never chooses this on its
   * own, because it forfeits the session's chance to flush its transcript; a
   * caller asks for it after watching a graceful attempt go unconfirmed. */
  force: Type.Optional(Type.Boolean()),
});
export type SessionKillArgs = Static<typeof SessionKillArgs>;

export const SessionKillResult = Type.Object({
  /** The process was seen to be gone before the grace period ran out. False is
   * not a failure: the signal was delivered and the process was still there,
   * which is what a caller needs to know to decide whether to force. */
  terminated: Type.Boolean(),
});
export type SessionKillResult = Static<typeof SessionKillResult>;

export const SessionKillRequest = request("session_kill", SessionKillArgs);
export const SessionKillResponse = response("session_kill", SessionKillResult);

/** Retitles a running session by typing its own rename command into the
 * terminal it lives in.
 *
 * Nothing can set a session's title from outside, so this drives the terminal
 * multiplexer the session runs under. Success means the keystrokes reached the
 * terminal, not that the session took them — the instance cannot see the TUI's
 * reaction, and the title it settles on arrives later on the `agents` topic. A
 * session whose terminal is unknown is refused rather than guessed at. */
/** How long a title may be. A title is typed into a terminal and shown as a
 * session's first line, where anything longer is unreadable whatever the
 * terminal would accept — so the ceiling is the caller's to keep to, and a
 * client that composes a title has to know it before it sends one. Counted the
 * way a JSON Schema `maxLength` is, over the value as sent. */
export const TITLE_MAX_CHARS = 200;

export const SessionRenameArgs = Type.Object({
  sid: Sid,
  /** The new title. Surrounding whitespace is trimmed and control characters
   * are refused: the value is typed, so a newline in it would submit a
   * half-written command. */
  title: Type.String({ minLength: 1, maxLength: TITLE_MAX_CHARS }),
});
export type SessionRenameArgs = Static<typeof SessionRenameArgs>;

export const SessionRenameResult = Type.Object({
  /** The terminal handle the keystrokes went to. A host-local handle, so it
   * travels with the instance that owns it. */
  terminal_id: Type.String(),
  instance: InstanceId,
  /** The trimmed title actually typed, which is what a caller should report
   * rather than the draft it sent. */
  title: Type.String(),
});
export type SessionRenameResult = Static<typeof SessionRenameResult>;

export const SessionRenameRequest = request("session_rename", SessionRenameArgs);
export const SessionRenameResponse = response("session_rename", SessionRenameResult);

/** Reads the environment of a session's own process.
 *
 * The environment comes from the resolved pid, not from the connection the
 * session speaks on: the helper that holds that connection carries a different
 * environment than the session itself. */
export const SessionEnvReadArgs = Type.Object({ sid: Sid });
export type SessionEnvReadArgs = Static<typeof SessionEnvReadArgs>;

export const SessionEnvReadResult = Type.Object({
  /** The pid actually read, after the same reuse check a kill applies. */
  pid: Type.Integer({ minimum: 1 }),
  instance: InstanceId,
  /** Values verbatim, secrets included. Redaction is the caller's decision, so
   * the contract does not make it for them. */
  env: Type.Record(Type.String(), Type.String()),
});
export type SessionEnvReadResult = Static<typeof SessionEnvReadResult>;

export const SessionEnvReadRequest = request("session_env_read", SessionEnvReadArgs);
export const SessionEnvReadResponse = response("session_env_read", SessionEnvReadResult);

/** Searches the transcripts of sessions that have run on this instance,
 * including ones long finished. */
export const SessionSearchArgs = Type.Object({
  /** Newline-separated clauses, ORed. Within a clause, whitespace-separated
   * terms are ANDed across the session's messages. */
  query: Type.Optional(Type.String()),
  case_sensitive: Type.Optional(Type.Boolean()),
  /** Read each clause as a regular expression instead of as literal terms. */
  regex: Type.Optional(Type.Boolean()),
  /** Include what people said. Defaults to true. */
  target_user: Type.Optional(Type.Boolean()),
  /** Include what sessions said. Defaults to true. */
  target_agent: Type.Optional(Type.Boolean()),
  /** Space-separated words matched against the session's working directory. */
  cwd: Type.Optional(Type.String()),
  /** Substring of the session id. */
  sid: Type.Optional(Type.String()),
  /** Restricts the search to these config homes; ones the instance does not
   * know are ignored. */
  config_dirs: Type.Optional(Type.Array(Type.String())),
  /** Only search transcripts touched within this window. */
  modified_within_ms: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type SessionSearchArgs = Static<typeof SessionSearchArgs>;

export const SessionSearchMatch = Type.Object(
  {
    role: Type.Union([Type.Literal("user"), Type.Literal("agent")]),
    text: Type.String(),
    said_at: Type.Optional(Timestamp),
  },
  { $id: "SessionSearchMatch" },
);
export type SessionSearchMatch = Static<typeof SessionSearchMatch>;

/** One session the search matched. Paths and the config home are host values,
 * so the hit names the instance they belong to — a search answered by several
 * instances would otherwise mix two hosts' paths in one list. */
export const SessionSearchHit = Type.Object(
  {
    sid: Sid,
    instance: InstanceId,
    config_dir: Type.String(),
    /** Absolute path of the transcript, on the answering instance's host. */
    file: Type.String(),
    /** Absent when the transcript never established one. */
    cwd: Type.Optional(Type.String()),
    /** `owner/repo`, when the working directory follows the repo layout. */
    repo: Type.Optional(Type.String()),
    /** Workspace path within the repository. */
    ws: Type.Optional(Type.String()),
    /** The session's own title, when it set one early enough to be read here.
     * Absent means none was found, never that the session is untitled. */
    title: Type.Optional(Type.String()),
    created_at: Timestamp,
    updated_at: Timestamp,
    size: Type.Integer({ minimum: 0 }),
    matches: Type.Array(SessionSearchMatch),
    /** What the session's last turn ran as, in the transcript's own spelling.
     * Resuming it should default to these rather than to anything else, so
     * they are reported unmapped. Independently absent. */
    model: Type.Optional(Type.String()),
    effort: Type.Optional(Type.String()),
  },
  { $id: "SessionSearchHit" },
);
export type SessionSearchHit = Static<typeof SessionSearchHit>;

export const SessionSearchResult = Type.Object({
  hits: Type.Array(SessionSearchHit),
  /** The walk stopped at its budget, so the hits are not every match. */
  truncated: Type.Boolean(),
});
export type SessionSearchResult = Static<typeof SessionSearchResult>;

export const SessionSearchRequest = request("session_search", SessionSearchArgs);
export const SessionSearchResponse = response("session_search", SessionSearchResult);

/** Writes a session's dump to a file on the instance's host and answers with
 * its path.
 *
 * What it adds over reading the transcript is a durable artifact whose path can
 * be handed to a successor session, instead of a payload that would travel out
 * through a client and back in again. The caller never supplies a path — the
 * destination is the instance's own data directory. */
export const SessionDumpWriteArgs = Type.Object({
  sid: Sid,
  /** Inclusive lower bound in time. */
  since_at: Type.Optional(Timestamp),
  /** Inclusive lower bound as a transcript record id, which cuts at that
   * record's position rather than at its clock — records sharing an instant
   * stay on their own side of the cut. Give one bound or the other, not both. */
  since_uuid: Type.Optional(Type.String()),
  until_at: Type.Optional(Timestamp),
  until_uuid: Type.Optional(Type.String()),
  /** Leave out the assistant's thinking blocks. */
  no_thinking: Type.Optional(Type.Boolean()),
  /** Leave out the machinery of in-process agents. */
  no_agent: Type.Optional(Type.Boolean()),
});
export type SessionDumpWriteArgs = Static<typeof SessionDumpWriteArgs>;

export const SessionDumpWriteResult = Type.Object({
  /** Absolute path on the writing instance's host. */
  path: Type.String(),
  instance: InstanceId,
  entries: Type.Integer({ minimum: 0 }),
  bytes: Type.Integer({ minimum: 0 }),
});
export type SessionDumpWriteResult = Static<typeof SessionDumpWriteResult>;

export const SessionDumpWriteRequest = request("session_dump_write", SessionDumpWriteArgs);
export const SessionDumpWriteResponse = response("session_dump_write", SessionDumpWriteResult);

/** Asks where a forked session stopped being a copy of its ancestor.
 *
 * Forking duplicates the ancestor's records keeping each record id, so nothing
 * inside the file marks the seam; finding it means comparing against the
 * sibling transcripts the instance can already enumerate. */
export const SessionForkOriginArgs = Type.Object({ sid: Sid });
export type SessionForkOriginArgs = Static<typeof SessionForkOriginArgs>;

export const ForkOrigin = Type.Object(
  {
    /** The session the copied records came from. */
    sid: Sid,
    /** Id of the last copied record; the seam sits just after it. */
    boundary_uuid: Type.String(),
    /** How many records were copied. */
    copied: Type.Integer({ minimum: 0 }),
  },
  { $id: "ForkOrigin" },
);
export type ForkOrigin = Static<typeof ForkOrigin>;

export const SessionForkOriginResult = Type.Object({
  /** Absent both when the session is no fork and when it is one whose ancestor
   * file is gone. Nothing left on disk tells those two apart, and neither has a
   * seam to place. */
  origin: Type.Optional(ForkOrigin),
});
export type SessionForkOriginResult = Static<typeof SessionForkOriginResult>;

export const SessionForkOriginRequest = request("session_fork_origin", SessionForkOriginArgs);
export const SessionForkOriginResponse = response("session_fork_origin", SessionForkOriginResult);

/** Drops one entry from the list of sessions that were running when the
 * instance last saw them.
 *
 * The removal touches that list alone: the session stays resumable by every
 * other route, and an instance that later sees it connected records it again.
 * An unknown session is not an error — two clients pressing the same button is
 * the ordinary case, and the caller's goal holds either way. */
export const SessionLastLiveRemoveArgs = Type.Object({ sid: Sid });
export type SessionLastLiveRemoveArgs = Static<typeof SessionLastLiveRemoveArgs>;

export const SessionLastLiveRemoveResult = Type.Object({
  /** Whether the entry was there to remove. */
  removed: Type.Boolean(),
});
export type SessionLastLiveRemoveResult = Static<typeof SessionLastLiveRemoveResult>;

export const SessionLastLiveRemoveRequest = request(
  "session_last_live_remove",
  SessionLastLiveRemoveArgs,
);
export const SessionLastLiveRemoveResponse = response(
  "session_last_live_remove",
  SessionLastLiveRemoveResult,
);
