import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Timestamp } from "../identifiers.ts";
import { upstream } from "../upstream.ts";

export const InstanceShutdownArgs = Type.Object({});
export type InstanceShutdownArgs = Static<typeof InstanceShutdownArgs>;

/** Answered before the process goes down, so the caller learns the request was
 * accepted rather than inferring it from the socket closing. */
export const InstanceShutdownResult = Type.Object({});
export type InstanceShutdownResult = Static<typeof InstanceShutdownResult>;

export const InstanceShutdownRequest = request("instance_shutdown", InstanceShutdownArgs);
export const InstanceShutdownResponse = response("instance_shutdown", InstanceShutdownResult);

/** A session saying it is about to go, so that its disconnection reads as a
 * pause rather than a loss.
 *
 * The calling session is recorded as `paused` — carrying the `stopped_at`
 * below — once the connection closes; a session that vanishes without this
 * call is `disappeared`. The instance holds the declaration until the
 * disconnection arrives, so the two are one event in that order however long
 * the session takes to actually exit, and a session that carries on regardless
 * stays connected and unchanged. */
export const SessionStoppingArgs = Type.Object({
  /** Why it is stopping, for display. An open set: this is normally called
   * from the harness's own end-of-session hook, which passes its reason
   * through, and nothing here gates on the word. */
  reason: Type.Optional(
    Type.String({
      minLength: 1,
      ...upstream("claude", "the session-end reason, in the harness's spelling"),
    }),
  ),
});
export type SessionStoppingArgs = Static<typeof SessionStoppingArgs>;

export const SessionStoppingResult = Type.Object({
  /** The instant the instance recorded, and the one that will appear on the
   * session's `last_live` entry. Stated rather than left to the caller so the
   * pause is stamped by the clock the entry is read against. */
  stopped_at: Timestamp,
});
export type SessionStoppingResult = Static<typeof SessionStoppingResult>;

export const SessionStoppingRequest = request("session_stopping", SessionStoppingArgs);
export const SessionStoppingResponse = response("session_stopping", SessionStoppingResult);
