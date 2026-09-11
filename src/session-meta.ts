import { Type } from "@sinclair/typebox";

/** The fields that describe where a session lives and what it runs as.
 *
 * Stated once and referenced wherever a session is described: the session names
 * them itself in `hello.session`, and the instance repeats them on the `peers`
 * topic
 * for connected and last-known sessions alike. Which of them are required
 * differs by place — a greeting may leave any of them unsaid — so each place
 * wraps what it needs in `Type.Optional`, but the name and the type of a field
 * never differ between them. */
export const SessionMetaFields = {
  /** The repository the session works in, as a display name. */
  repo: Type.String(),
  /** The workspace (worktree) name within that repository. */
  ws: Type.String(),
  /** The session's working directory. */
  cwd: Type.String(),
  /** The transcript file, which is what decides whether the session's
   * transcript can be read at all. */
  transcript_path: Type.String(),
  /** The repository container. File browsing is rooted here rather than at the
   * working directory, so sibling workspaces are reachable. An instance that is
   * not told one derives it from `cwd`. */
  repo_root: Type.String(),
  /** The branch checked out in that workspace. */
  branch: Type.String(),
  /** The session's own title. Absent means not known, never untitled. */
  title: Type.String(),
  /** The model the session runs as, in its own spelling. */
  model: Type.String(),
  /** The reasoning effort the session runs at, in its own spelling. */
  effort: Type.String(),
};
