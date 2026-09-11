import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";

/** Reads the launcher's configuration, as much of it as a form needs.
 *
 * Neither the directory tree nor the launch itself lets a client learn the
 * roots it may pick from, or the recipes and their parameters — which are the
 * form. This fills that gap, and its capability answer is also how a client
 * decides whether to offer a launcher at all. */
export const LauncherConfigReadArgs = Type.Object({});
export type LauncherConfigReadArgs = Static<typeof LauncherConfigReadArgs>;

/** One value the recipe's command reads.
 *
 * The declaration is the only statement of which variables exist: the launcher
 * defines exactly these and nothing else. A client renders one input per
 * declaration, in order. */
export const LauncherParam = Type.Object(
  {
    /** A shell identifier, unique within a recipe. Some names are conventional
     * enough to deserve a dedicated widget — a directory picker, a model
     * chooser — and anything else is a plain text field. */
    name: Type.String({ minLength: 1 }),
    /** The form's initial value, and what resetting it restores. Empty is the
     * ordinary "the user fills this in" case. */
    default: Type.String(),
  },
  { $id: "LauncherParam" },
);
export type LauncherParam = Static<typeof LauncherParam>;

/** One launch recipe as a client sees it: how the shell runs it is the
 * instance's business and is not reported. */
export const LauncherTemplate = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    /** A shell program whose vocabulary is the declared parameters. Nothing is
     * substituted into it — the parameters reach it as shell variables — so it
     * is shown verbatim, and a client may offer it for editing. */
    command: Type.String(),
    params: Type.Array(LauncherParam),
  },
  { $id: "LauncherTemplate" },
);
export type LauncherTemplate = Static<typeof LauncherTemplate>;

export const LauncherConfigReadResult = Type.Object({
  /** Directories a session may be started in, on the instance's host. A launch
   * elsewhere is refused. */
  root_dirs: Type.Array(Type.String()),
  /** In configured order; the first is the default recipe. */
  templates: Type.Array(LauncherTemplate),
});
export type LauncherConfigReadResult = Static<typeof LauncherConfigReadResult>;

export const LauncherConfigReadRequest = request("launcher.config.read", LauncherConfigReadArgs);
export const LauncherConfigReadResponse = response(
  "launcher.config.read",
  LauncherConfigReadResult,
);

/** Starts a session.
 *
 * The reply comes back when the launched command has finished or been given up
 * on, which can be seconds. That waits for nothing else: requests on one
 * connection are answered as they complete, not in order. */
export const LauncherRunArgs = Type.Object({
  /** Where to run, and what the command sees as its working directory. It is a
   * field of its own rather than one of `params` because it is the one value
   * the instance acts on itself: it is checked against the configured roots
   * before anything is spawned. */
  cwd: Type.String({ minLength: 1 }),
  /** Values for the recipe's declared parameters, by name. An omitted one falls
   * back to its default; a name the recipe does not declare is refused rather
   * than dropped, because a client sending a value nothing will read has a bug
   * worth surfacing. The values are opaque and are never spliced into shell
   * text, so none of them can inject syntax. */
  params: Type.Record(Type.String(), Type.String()),
  /** Which recipe to launch. Absent takes the default one; a name that is not
   * configured is refused rather than quietly replaced with something else. */
  template: Type.Optional(Type.String()),
  /** Replaces the recipe's command for this launch. A person editing the
   * command is doing what they could do by typing it in a terminal, so it is
   * allowed for them and gated behind the same role as the launch itself. */
  command: Type.Optional(Type.String({ minLength: 1 })),
});
export type LauncherRunArgs = Static<typeof LauncherRunArgs>;

export const LauncherRunResult = Type.Object({
  stdout: Type.String(),
  stderr: Type.String(),
  /** Absent when a signal ended the command, which leaves no code to state. */
  exit_code: Type.Optional(Type.Integer()),
  /** The command outlived its allowance and was stopped. */
  timed_out: Type.Boolean(),
});
export type LauncherRunResult = Static<typeof LauncherRunResult>;

export const LauncherRunRequest = request("launcher.run", LauncherRunArgs);
export const LauncherRunResponse = response("launcher.run", LauncherRunResult);
