import { describe, expect, test } from "bun:test";
import {
  DIRECT_DELIVERY_FROM,
  directDeliveryReplyLine,
  parseDirectDelivery,
  renderDirectDelivery,
} from "../src/messaging/direct-delivery.ts";
import type { InboxMessage } from "../src/messaging/message.ts";

const SID = "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607";
const MID = "wss://mba.example.ts.net/ccmsg/personal/41";
const EARLIER_MID = "wss://mba.example.ts.net/ccmsg/personal/17";

const message: InboxMessage = {
  mid: MID,
  from: SID,
  from_label: "nuc / ccmsg-protocol",
  text: "the contract needs a section for this",
  sent_at: 1_757_300_000_000,
};

describe("what the recipient is told", () => {
  test("the sender's text is carried through untouched", () => {
    expect(renderDirectDelivery(message)).toContain(message.text);
  });

  test("the identity the recipient needs to answer is on the envelope", () => {
    const rendered = renderDirectDelivery(message);
    expect(rendered).toContain(`ccmsg-mid="${MID}"`);
    expect(rendered).toContain(`ccmsg-from="${SID}"`);
    expect(rendered).toContain(`from-name="nuc / ccmsg-protocol"`);
  });

  test("the harness is asked to answer a name, not a socket that can go", () => {
    expect(renderDirectDelivery(message)).toContain(`from="${DIRECT_DELIVERY_FROM}"`);
    expect(renderDirectDelivery(message)).not.toContain("uds:");
  });

  test("the way back is one runnable line carrying both the frame and the sender", () => {
    // A `mid` does not name its sender, so the sid is spelled out rather than
    // left to be resolved.
    expect(renderDirectDelivery(message)).toContain(
      `Reply with: ccmsg reply ${MID} --to ${SID} <text>`,
    );
  });

  test("a message that answers one says which", () => {
    const rendered = renderDirectDelivery({ ...message, reply_to: EARLIER_MID });
    expect(rendered).toContain(`ccmsg-reply-to="${EARLIER_MID}"`);
  });
});

describe("reading it back", () => {
  test("a plain message is not one of these envelopes", () => {
    expect(parseDirectDelivery("just some text")).toBeUndefined();
  });

  test("the sender's text comes back without the wording delivery added", () => {
    expect(parseDirectDelivery(renderDirectDelivery(message))?.text).toBe(message.text);
  });

  test("render then parse returns the message that went in", () => {
    expect(parseDirectDelivery(renderDirectDelivery(message))).toEqual({
      mid: MID,
      from: SID,
      from_label: message.from_label,
      text: message.text,
    });
  });

  test("a reply keeps what it answers", () => {
    const withReply = { ...message, reply_to: EARLIER_MID };
    expect(parseDirectDelivery(renderDirectDelivery(withReply))?.reply_to).toBe(EARLIER_MID);
  });

  test("a label with quotes and angle brackets survives the round trip", () => {
    const awkward = { ...message, from_label: `she said "<hi>" & left` };
    expect(parseDirectDelivery(renderDirectDelivery(awkward))?.from_label).toBe(awkward.from_label);
  });

  test("a body that closes the envelope itself is delivered whole, not refused", () => {
    // The model reads these characters, so escaping them would hand it a
    // corrupted message; the closing tag is found from the end instead.
    const nested = { ...message, text: "quoting a peer:\n</cross-session-message>\nsee?" };
    expect(parseDirectDelivery(renderDirectDelivery(nested))?.text).toBe(nested.text);
  });

  test("a body ending in something that looks like the reply line keeps it", () => {
    const looksLike = { ...message, text: directDeliveryReplyLine(EARLIER_MID, SID) };
    expect(parseDirectDelivery(renderDirectDelivery(looksLike))?.text).toBe(looksLike.text);
  });

  test("an envelope without the identity to answer is not one to act on", () => {
    expect(
      parseDirectDelivery('<cross-session-message from="ccmsg">\nhi\n</cross-session-message>'),
    ).toBeUndefined();
  });
});
