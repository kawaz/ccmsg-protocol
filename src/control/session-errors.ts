import { type Static, Type } from "@sinclair/typebox";
import { topicFrame } from "../envelope.ts";
import { InstanceId, Sid } from "../identifiers.ts";
import { SessionApiError } from "./session-status.ts";

/** Which session is stopped, and on what. */
export const SessionErrorEntry = Type.Intersect(
  [Type.Object({ sid: Sid, instance: InstanceId }), SessionApiError],
  { $id: "SessionErrorEntry" },
);
export type SessionErrorEntry = Static<typeof SessionErrorEntry>;

/** The `session_errors` topic: every connected session currently stopped on a
 * harness error.
 *
 * Not per session, unlike `session_status`. A client showing a list of sessions
 * has to mark the stopped ones, and subscribing to a whole status fold for each
 * visible session is the cost this exists to avoid: the instance folds the one
 * error pattern over every connected session instead.
 *
 * Whole-value per instance. A session that recovers drops out of the list
 * rather than appearing with an empty error, so a client that missed a frame
 * still converges on the next one. */
export const SessionErrorsFrame = topicFrame(
  "session_errors",
  Type.Object({ errors: Type.Array(SessionErrorEntry) }),
);
