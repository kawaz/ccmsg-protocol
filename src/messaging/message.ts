import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { InstanceId, Mid, Sender, Sid, Timestamp } from "../identifiers.ts";

/** Why a message was not handed to its recipient right away.
 *
 * These are not errors: the op succeeded and the message is held in the
 * recipient's inbox. They tell the sender what to do next — wait, resend to
 * another session, or give up. The op itself fails only when `to` names no
 * session anywhere in the cluster (`session_not_found`). */
export const UndeliveredReason = Type.Union(
  [
    /** Alive, but not yet listening. The daemon delivers when it starts. */
    Type.Literal("preparing"),
    Type.Literal("paused"),
    /** The session is gone. */
    Type.Literal("disappeared"),
    /** The instance holding the session cannot be reached over the mesh. */
    Type.Literal("instance_unreachable"),
    /** The recipient declined it for now — too much arriving at once, a full
     * queue, or a message it has already been handed. It stays in the inbox and
     * is offered again, so the sender waits rather than resending. */
    Type.Literal("throttled"),
    /** The recipient's inbox is at its limit; the oldest message was dropped
     * to make room for this one. */
    Type.Literal("inbox_full"),
  ],
  { $id: "UndeliveredReason" },
);
export type UndeliveredReason = Static<typeof UndeliveredReason>;

/** A session the sender could send to instead, offered when the addressee is
 * paused or gone: a session live now in the same repository. The workspace
 * name is there because several worktrees of one repository qualify and the
 * sender has to tell them apart. */
export const CandidateSession = Type.Object(
  {
    sid: Sid,
    /** Workspace name, when the session runs in a named workspace. */
    ws: Type.Optional(Type.String()),
    instance: InstanceId,
  },
  { $id: "CandidateSession" },
);
export type CandidateSession = Static<typeof CandidateSession>;

export const MessageSendArgs = Type.Object({
  /** The recipient session. There is no room to address: a message goes to one
   * session. */
  to: Sid,
  text: Type.String({ minLength: 1 }),
  /** The `mid` of the frame this message answers, when it answers one. */
  reply_to: Type.Optional(Mid),
});
export type MessageSendArgs = Static<typeof MessageSendArgs>;

export const MessageSendResult = Type.Object({
  /** True when the recipient received it now; false when it went to the inbox
   * to be delivered once the recipient can take it. */
  delivered: Type.Boolean(),
  /** Present when `delivered` is false. */
  reason: Type.Optional(UndeliveredReason),
  /** Present when the addressee is paused or gone. */
  candidates: Type.Optional(Type.Array(CandidateSession)),
});
export type MessageSendResult = Static<typeof MessageSendResult>;

export const MessageSendRequest = request("message_send", MessageSendArgs);
export const MessageSendResponse = response("message_send", MessageSendResult);

/** A message as the recipient receives it, on topic `inbox`.
 *
 * To answer it, send to `from`. The route is the sender and nothing else, so no
 * reply instructions travel on the wire: the wording a session sees belongs to
 * whoever renders it — see `direct-delivery.ts` for the one route whose
 * recipient reads text instead of this frame.
 *
 * A `from` of `user` is the exception: `message_send` addresses a sid, so there
 * is no such thing as sending back to the person. An answer to one reaches them
 * as a notification instead, which is the instance's to arrange — this contract
 * only states that the sender can be a person, so a client stops treating one
 * as a malformed message. */
export const InboxMessage = Type.Object(
  {
    mid: Mid,
    from: Sender,
    /** How the sender should be shown, resolved by the issuing instance. */
    from_label: Type.String(),
    text: Type.String(),
    reply_to: Type.Optional(Mid),
    sent_at: Timestamp,
  },
  { $id: "InboxMessage" },
);
export type InboxMessage = Static<typeof InboxMessage>;

/** How long an undelivered message is kept for its recipient. The same window
 * a lost session stays listed for: a message outliving the session it was
 * addressed to would be offered to no one, and a session outliving what was
 * said to it would come back to an empty inbox. */
export const INBOX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** How many undelivered messages one session's inbox holds. Beyond it the
 * oldest is dropped for the newest and the sender is told `inbox_full`. Matched
 * to what the harness itself will hold for a session, so a message the inbox
 * accepts is one the recipient can still be handed. */
export const INBOX_MAX_PER_SID = 256;

/** The `inbox` topic. Its snapshot is whatever is still undelivered for this
 * session; each later frame is one newly arrived message. */
export const InboxFrame = topicFrame("inbox", Type.Array(InboxMessage));
