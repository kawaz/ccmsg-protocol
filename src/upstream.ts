/** Systems other than ccmsg that own the meaning of a type.
 *
 * `claude` is the Claude Code CLI (`claude agents --json`, the session state
 * files, transcript rows); `llm-gateway` is the proxy the daemon asks about
 * quota, spend and upstream health. */
export type UpstreamSource = "claude" | "llm-gateway";

/** Marks a type whose vocabulary belongs to `source`, not to ccmsg.
 *
 * The mark says where an open set's future values come from, so a reader knows
 * an unfamiliar `status` string is the upstream's to add rather than a bug. It
 * does not exempt the type from this contract's spelling: the daemon renames
 * and re-units every field as it copies the upstream document in, so what
 * travels here is snake_case with Unix-ms instants like everything else. */
export function upstream(source: UpstreamSource, note: string): { description: string } {
  return { description: `upstream: ${source} — ${note}` };
}
