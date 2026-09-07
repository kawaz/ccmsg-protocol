import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** A session speaking to whoever is watching, rather than to one recipient.
 *
 * What was said is already in the calling session's transcript, since the call
 * itself is a tool use there. So this op only pushes "this session just spoke"
 * to the watchers; the instance keeps no log of its own. */
export const SayPostArgs = Type.Object({
  text: Type.String({ minLength: 1 }),
});
export type SayPostArgs = Static<typeof SayPostArgs>;

export const SayPostResult = Type.Object({
  posted_at: Timestamp,
});
export type SayPostResult = Static<typeof SayPostResult>;

export const SayPostRequest = request("say_post", SayPostArgs);
export const SayPostResponse = response("say_post", SayPostResult);

/** Clears the unread mark a `say_post` raised. The mark is instance state that
 * a restart may forget — nothing depends on it surviving. */
export const SayMarkReadArgs = Type.Object({
  /** The session whose unread mark is cleared. Omit to clear every one. */
  sid: Type.Optional(Sid),
});
export type SayMarkReadArgs = Static<typeof SayMarkReadArgs>;

export const SayMarkReadResult = Type.Object({});
export type SayMarkReadResult = Static<typeof SayMarkReadResult>;

export const SayMarkReadRequest = request("say_mark_read", SayMarkReadArgs);
export const SayMarkReadResponse = response("say_mark_read", SayMarkReadResult);
