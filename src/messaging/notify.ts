import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** A short line meant to reach a person watching, not the session's own turn.
 * Delivery is best effort and unacknowledged; unlike `message_send`, nothing is
 * held for later. */
export const NotifySendArgs = Type.Object({
  /** The session the notification is about. Omit to mean the caller. */
  sid: Type.Optional(Sid),
  text: Type.String({ minLength: 1 }),
});
export type NotifySendArgs = Static<typeof NotifySendArgs>;

export const NotifySendResult = Type.Object({});
export type NotifySendResult = Static<typeof NotifySendResult>;

export const NotifySendRequest = request("notify_send", NotifySendArgs);
export const NotifySendResponse = response("notify_send", NotifySendResult);

export const Notification = Type.Object(
  {
    sid: Sid,
    /** How the session should be shown, resolved by the issuing instance. */
    sid_label: Type.String(),
    text: Type.String(),
    sent_at: Timestamp,
  },
  { $id: "Notification" },
);
export type Notification = Static<typeof Notification>;

/** The `notify` topic. There is nothing to snapshot — a notification matters
 * when it happens — so every frame is a new one. */
export const NotifyFrame = topicFrame("notify", Notification);
