import type { InboxMessage } from "./message.ts";
import { type Mid, type Sender, USER_SENDER } from "../identifiers.ts";

/** How an `InboxMessage` is worded when it is handed to a session through the
 * harness's own messaging socket rather than over this protocol.
 *
 * On that route the recipient is the model, not a client: it reads one block of
 * text and has no frame to look at. So `mid` and `from` have to be in the text
 * or the recipient cannot answer — it would know a message arrived and not what
 * to answer or how. That is what this module puts there, and nothing more: the
 * wording is the delivery's, not the sender's, and `text` is carried through
 * untouched.
 *
 * The shape is the harness's own sender convention, `<cross-session-message>`
 * embedded in the message body. Sitting on it means the receiving harness reads
 * the origin it already knows how to read, and a session that has seen a peer
 * message sees the same envelope here. */

/** The element senders wrap a peer message in. */
export const DIRECT_DELIVERY_TAG = "cross-session-message";

/** What the recipient's harness is told to answer to.
 *
 * Not the sender's session and not a `uds:` path. Those are the addresses the
 * harness itself dials, and dialing one that has gone ends the recipient's turn
 * in failure. A name asks for no answer, so there is nothing to dangle — the
 * way back is the reply line, which the recipient runs rather than the harness.
 *
 * The frame this wrapper is written in is a separate address: there the
 * instance may name a `uds:` socket of its own, which is where the receiving
 * harness writes what became of the delivery. Those receipts are negative only
 * — `refused`, `denied`, `dropped`, `expired`, `held` — so silence within the
 * window is what says the message was taken. */
export const DIRECT_DELIVERY_FROM = "ccmsg";

/** What the recipient is told the sender is doing. `prompting` is what a peer
 * mid-turn sends as, which is what a relayed message is. */
export const DIRECT_DELIVERY_FROM_MODE = "prompting";

/** How the recipient answers: the one line of instruction in the body.
 *
 * A command and not a description of one, because the recipient acts on it
 * directly. It carries both halves of the address — the sender to send to, and
 * the frame being answered — so nothing has to be looked up to use it. A `mid`
 * does not name its sender, and the alternative to spelling the sid out here
 * would be an op that resolves one, which means a sent-message index the
 * daemon does not otherwise need.
 *
 * A message from a person carries no addressee: `user` is not a sid and
 * addressing it would be a send that fails. The line drops `--to` instead, and
 * what an answer to a person becomes is the instance's to decide — it reaches
 * them as a notification, which is a route the recipient does not have to know
 * about to run this line. */
export function directDeliveryReplyLine(mid: Mid, from: Sender): string {
  const to = from === USER_SENDER ? "" : ` --to ${from}`;
  return `Reply with: ccmsg reply ${mid}${to} <text>`;
}

/** An `InboxMessage` as it reaches a session through the messaging socket. */
export interface DirectDelivery {
  mid: Mid;
  from: Sender;
  from_label: string;
  reply_to?: Mid;
  /** The sender's text, exactly as it was sent. */
  text: string;
}

/** Attribute values are quoted, so a label the sender chose cannot be trusted
 * to stay inside its quotes. The identifiers cannot contain any of these, but
 * they go through the same escape so one rule covers every attribute. */
function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function unescapeAttribute(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

/** Word a message for the messaging socket.
 *
 * `from` / `from-name` / `from-mode` are the harness's attributes, so the
 * receiving harness reads the origin it expects. The `ccmsg-` ones are this
 * protocol's: the harness has no use for them and a reader that does not know
 * them sees an envelope it can still read, while a recipient that wants to
 * answer has the `mid` and the sid without parsing prose.
 *
 * The body is not escaped. What the model reads is these characters, so
 * entity-escaping them would hand the recipient a corrupted message to answer;
 * a `</cross-session-message>` inside the text is left where the sender put it
 * and the closing tag is found from the end (see `parseDirectDelivery`).
 * Refusing such a message instead would lose it for a substring. */
export function renderDirectDelivery(message: InboxMessage): string {
  const attributes = [
    `from="${DIRECT_DELIVERY_FROM}"`,
    `from-name="${escapeAttribute(message.from_label)}"`,
    `from-mode="${DIRECT_DELIVERY_FROM_MODE}"`,
    `ccmsg-mid="${escapeAttribute(message.mid)}"`,
    `ccmsg-from="${escapeAttribute(message.from)}"`,
  ];
  if (message.reply_to !== undefined) {
    attributes.push(`ccmsg-reply-to="${escapeAttribute(message.reply_to)}"`);
  }
  const body = `${message.text}\n\n${directDeliveryReplyLine(message.mid, message.from)}`;
  return `<${DIRECT_DELIVERY_TAG} ${attributes.join(" ")}>\n${body}\n</${DIRECT_DELIVERY_TAG}>`;
}

const OPENING = new RegExp(`^<${DIRECT_DELIVERY_TAG}((?:\\s+[a-z-]+="[^"]*")*)\\s*>\\n`);
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g;

/** Read back what `renderDirectDelivery` wrote.
 *
 * For the recipient side: a session or client holding the delivered text can
 * recover the frame it answers without the sender's help. Returns `undefined`
 * for anything that is not one of these envelopes — a plain message, or one
 * missing the identity that makes it answerable.
 *
 * The closing tag is taken from the end so a body containing one round-trips,
 * and the reply line this delivery added is removed, leaving the sender's own
 * text. */
export function parseDirectDelivery(delivered: string): DirectDelivery | undefined {
  const opening = OPENING.exec(delivered);
  if (!opening) return undefined;
  const closing = `\n</${DIRECT_DELIVERY_TAG}>`;
  const end = delivered.lastIndexOf(closing);
  if (end < opening[0].length - 1) return undefined;

  const attributes = new Map<string, string>();
  for (const [, key, value] of (opening[1] ?? "").matchAll(ATTRIBUTE)) {
    if (key !== undefined && value !== undefined) attributes.set(key, unescapeAttribute(value));
  }
  const mid = attributes.get("ccmsg-mid");
  const from = attributes.get("ccmsg-from");
  const from_label = attributes.get("from-name");
  if (mid === undefined || from === undefined || from_label === undefined) return undefined;

  let text = delivered.slice(opening[0].length, end);
  const suffix = `\n\n${directDeliveryReplyLine(mid, from)}`;
  if (text.endsWith(suffix)) text = text.slice(0, -suffix.length);

  const reply_to = attributes.get("ccmsg-reply-to");
  return { mid, from, from_label, ...(reply_to !== undefined ? { reply_to } : {}), text };
}
