import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, TerminalId, Timestamp } from "../identifiers.ts";

/** One terminal on a host, as the terminal manager reports it.
 *
 * A terminal is not an attribute of a session: a person opens one with nothing
 * running in it, and the terminal outlives the session that was running there.
 * So it is a row of its own, matched by `instance` and `id`, and which session
 * is in it is read off the pids rather than stated here.
 *
 * The words are a terminal's own — `id`, `state`, `pid` — rather than any one
 * manager's, so another manager's terminals are rows of the same list. Which
 * manager a row came from is the scheme of its `id`. */
export const TerminalInfo = Type.Object(
  {
    /** The instance that polled it, and whose host the pid belongs to. */
    instance: InstanceId,
    /** `<scheme>:<id>`, the scheme naming which terminal manager observed it. */
    id: TerminalId,
    /** What the terminal manager says the terminal is doing. An open set. */
    state: Type.String(),
    /** What is running in the terminal, as argv. */
    command: Type.Array(Type.String()),
    cwd: Type.Optional(Type.String()),
    /** The main process inside the terminal. Absent where the manager reports
     * none, which is also what leaves such a row out of every derivation
     * below: nothing can be matched against a pid that is not there. */
    pid: Type.Optional(Type.Integer({ minimum: 1 })),
    started_at: Type.Optional(Timestamp),
  },
  { $id: "TerminalInfo" },
);
export type TerminalInfo = Static<typeof TerminalInfo>;

/** A row that is gone: the terminal was closed, or the instance that polled it
 * stopped. Marked rather than absent, since a frame carries only what changed. */
export const TerminalRemoved = Type.Object(
  {
    instance: InstanceId,
    id: TerminalId,
    removed: Type.Literal(true),
  },
  { $id: "TerminalRemoved" },
);
export type TerminalRemoved = Static<typeof TerminalRemoved>;

export const TerminalElement = Type.Union([TerminalInfo, TerminalRemoved], {
  $id: "TerminalElement",
});
export type TerminalElement = Static<typeof TerminalElement>;

/** The commands a harness is started as, by the name its binary is installed
 * under. What `starting` below reads a terminal's `command` against, so that a
 * shell a person opened is not read as a session on its way up.
 *
 * Names rather than paths: the same harness is installed under a dozen
 * prefixes and run through as many wrappers, and none of that changes what it
 * is. A harness outside this list is one nothing here claims to recognise — its
 * terminal is unattached until the harness reports the run itself. */
export const HARNESS_COMMANDS = ["claude", "codex"] as const;

/** What a derivation below reads off a terminal: where it is and what is
 * running in it. */
interface TerminalRow {
  readonly instance: string;
  readonly pid?: number;
  readonly command?: readonly string[];
}

/** What it reads off an `agents` row: where the process is, and whose session
 * it runs. */
interface AgentRow {
  readonly instance: string;
  readonly pid: number;
  readonly sid?: string;
}

const held = (agents: readonly AgentRow[]): Set<string> =>
  new Set(agents.map((agent) => `${agent.instance}/${agent.pid}`));

/** Whether a terminal is running a harness, read off the name its command was
 * invoked under. */
const isHarness = (command: readonly string[] | undefined): boolean => {
  const argv0 = command?.[0];
  if (argv0 === undefined) return false;
  const name = argv0.slice(argv0.lastIndexOf("/") + 1);
  return (HARNESS_COMMANDS as readonly string[]).includes(name);
};

const key = (terminal: TerminalRow): string | undefined =>
  terminal.pid === undefined ? undefined : `${terminal.instance}/${terminal.pid}`;

/** The terminals a session is running in: those whose process is a run of that
 * session.
 *
 * The pid is what says so, not `agents.terminal_id`: the terminal list is the
 * one that knows which terminals exist, and a run reaches it as the process
 * inside one. Both lists are the `user` role's, and both are keyed by the host
 * the pid belongs to, which is why a row is matched by `instance` and `pid`
 * together.
 *
 * Derived here rather than by each side, for the reason `liveness` is: an
 * instance and a client that each wrote this would show one host two ways. */
export function terminalsOf<T extends TerminalRow>(
  sid: string,
  agents: readonly AgentRow[],
  terminals: readonly T[],
): T[] {
  const pids = held(agents.filter((agent) => agent.sid === sid));
  return terminals.filter((terminal) => {
    const at = key(terminal);
    return at !== undefined && pids.has(at);
  });
}

/** The terminals no run is in: the ones a person opened for themselves, and the
 * ones a harness has just started in and not yet been seen as a run of.
 *
 * A terminal whose manager reports no pid is here too — nothing can be matched
 * against it, so nothing can claim it. */
export function unattachedTerminals<T extends TerminalRow>(
  agents: readonly AgentRow[],
  terminals: readonly T[],
): T[] {
  const pids = held(agents);
  return terminals.filter((terminal) => {
    const at = key(terminal);
    return at === undefined || !pids.has(at);
  });
}

/** The terminals a harness is running in that the harness has not reported: one
 * that has started and has neither written a state file nor greeted yet. This
 * is where a run before its state file is said, rather than as an `agents` row
 * without a `sid`.
 *
 * Narrower than `unattachedTerminals` in both ways it can be: a terminal with
 * no process is one nothing can be starting in, and a terminal running
 * something that is not a harness is a person's own and is not on its way to
 * becoming a session. The `command` is what says which — a pid alone cannot
 * tell a shell from a harness — so a row that states none is not here. */
export function starting<T extends TerminalRow>(
  terminals: readonly T[],
  agents: readonly AgentRow[],
): T[] {
  const pids = held(agents);
  return terminals.filter((terminal) => {
    const at = key(terminal);
    return at !== undefined && !pids.has(at) && isHarness(terminal.command);
  });
}

/** The `terminals` topic. Elements, like `agents`: the rows that changed since
 * the last frame, matched by their `instance` and `id`.
 *
 * The `user` role's alone. A terminal is the host's, and a session has no
 * reason to be told which terminals another session is being typed into. */
export const TerminalsFrame = topicFrame(
  "terminals",
  Type.Object({
    terminals: Type.Array(TerminalElement),
    /** When the poll behind these rows ran. Absent before the first one. */
    polled_at: Type.Optional(Timestamp),
  }),
);
