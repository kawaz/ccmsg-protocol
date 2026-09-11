import type { Static } from "@sinclair/typebox";
import type { MessageSendRequest, MessageSendResponse } from "../messaging/message.ts";
import type { NotifySendRequest, NotifySendResponse } from "../messaging/notify.ts";
import type {
  SayUnreadClearRequest,
  SayUnreadClearResponse,
  SayPostRequest,
  SayPostResponse,
} from "../messaging/say.ts";
import { FIXTURE_IDS, FIXTURE_NOW } from "./ids.ts";

const { sid, other_sid, instance, mid, request_id } = FIXTURE_IDS;

export const MESSAGE_SEND_REQUEST: Static<typeof MessageSendRequest> = {
  request_id,
  op: "message.send",
  to: other_sid,
  text: "契約の fixture を export した",
  reply_to: mid,
};

/** A send that crossed instances, which is the same op wrapped in the mesh
 * fields and the identity it was called with. */
export const MESSAGE_SEND_FORWARDED_REQUEST: Static<typeof MessageSendRequest> = {
  request_id,
  op: "message.send",
  to: other_sid,
  text: "契約の fixture を export した",
  from_instance: instance,
  hops: [instance],
  caller: { role: "session", sid },
};

export const MESSAGE_SEND_RESPONSE: Static<typeof MessageSendResponse> = {
  ok: true,
  request_id,
  delivered: true,
};

/** The reply when nobody took it: the reason, and where the recipient might
 * be instead. */
export const MESSAGE_SEND_HELD_RESPONSE: Static<typeof MessageSendResponse> = {
  ok: true,
  request_id,
  delivered: false,
  reason: "disappeared",
  candidates: [{ sid, ws: "main", instance }],
};

export const SAY_POST_REQUEST: Static<typeof SayPostRequest> = {
  request_id,
  op: "say.post",
  text: "終わりました",
};

export const SAY_POST_RESPONSE: Static<typeof SayPostResponse> = {
  ok: true,
  request_id,
  posted_at: FIXTURE_NOW,
};

export const SAY_UNREAD_CLEAR_REQUEST: Static<typeof SayUnreadClearRequest> = {
  request_id,
  op: "say.unread.clear",
  sid,
};

export const SAY_UNREAD_CLEAR_RESPONSE: Static<typeof SayUnreadClearResponse> = {
  ok: true,
  request_id,
};

export const NOTIFY_SEND_REQUEST: Static<typeof NotifySendRequest> = {
  request_id,
  op: "notify.send",
  sid,
  text: "確認して",
};

export const NOTIFY_SEND_RESPONSE: Static<typeof NotifySendResponse> = {
  ok: true,
  request_id,
};
