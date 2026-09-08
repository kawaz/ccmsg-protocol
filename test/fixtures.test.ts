import { describe, expect, test } from "bun:test";
import { HelloRequest, HelloResponse } from "../src/common/hello.ts";
import { InstancePingResponse } from "../src/common/ping.ts";
import {
  TopicSubscribeRequest,
  TopicSubscribeResponse,
  TopicUnsubscribeRequest,
} from "../src/common/topics.ts";
import { ErrorResponse } from "../src/envelope.ts";
import { InboxFrame, MessageSendRequest, MessageSendResponse } from "../src/messaging/message.ts";
import { NotifyFrame, NotifySendRequest } from "../src/messaging/notify.ts";
import { SayMarkReadRequest, SayPostRequest } from "../src/messaging/say.ts";
import { isValid } from "../src/schemas.ts";

const SID = "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607";
const OTHER_SID = "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b";
const INSTANCE = "wss://mba.example.ts.net/ccmsg/personal";

describe("hello", () => {
  const helloRequest = {
    request_id: "1",
    op: "hello",
    role: "session",
    protocol_version: 2,
    sid: SID,
    client_version: "0.1.0",
  };

  test("a session hello passes", () => {
    expect(isValid(HelloRequest, helloRequest)).toBe(true);
  });

  test("an instance hello carries the mesh claim", () => {
    expect(
      isValid(HelloRequest, {
        request_id: "1",
        op: "hello",
        role: "instance",
        protocol_version: 2,
        mesh: {
          ver: 1,
          iss: "wss://nuc.example.ts.net/ccmsg/personal",
          aud: INSTANCE,
          kid: "9f2c7a5e1b4d8036af51c9e27d604b18",
        },
      }),
    ).toBe(true);
  });

  test("an unknown role is refused", () => {
    expect(isValid(HelloRequest, { ...helloRequest, role: "admin" })).toBe(false);
  });

  test("a malformed sid is refused", () => {
    expect(isValid(HelloRequest, { ...helloRequest, sid: "session-3" })).toBe(false);
  });

  test("a request without its correlation id is refused", () => {
    const { request_id: _dropped, ...rest } = helloRequest;
    expect(isValid(HelloRequest, rest)).toBe(false);
  });

  test("the reply carries the instance view and the capability set", () => {
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 2,
        instance: INSTANCE,
        instances: [
          { id: INSTANCE, host: "mba", reachable: true },
          { id: "wss://nuc.example.ts.net/ccmsg/personal", host: "nuc", reachable: false },
        ],
        capabilities: ["fork", "launcher", "terminal"],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(true);
  });

  test("a capability outside the set is refused", () => {
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 2,
        instance: INSTANCE,
        instances: [],
        capabilities: ["telepathy"],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(false);
  });

  test("an instance id must be a whole endpoint URL", () => {
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 2,
        instance: "personal@mba",
        instances: [],
        capabilities: [],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(false);
  });
});

describe("instance_ping", () => {
  const pong = {
    ok: true,
    request_id: "2",
    instance: INSTANCE,
    version: "0.1.0",
    pid: 4821,
    started_at: 1_757_300_000_000,
    clients: 3,
    http: ["127.0.0.1:8787"],
    network: "online",
  };

  test("a pong passes", () => {
    expect(isValid(InstancePingResponse, pong)).toBe(true);
  });

  test("an ISO timestamp is refused", () => {
    expect(isValid(InstancePingResponse, { ...pong, started_at: "2026-09-08T00:00:00Z" })).toBe(
      false,
    );
  });
});

describe("topic subscription", () => {
  test("a plain topic passes", () => {
    expect(
      isValid(TopicSubscribeRequest, { request_id: "3", op: "topic_subscribe", topic: "peers" }),
    ).toBe(true);
  });

  test("a per-session topic carries its sid", () => {
    expect(
      isValid(TopicSubscribeRequest, {
        request_id: "3",
        op: "topic_subscribe",
        topic: `transcript:${SID}`,
      }),
    ).toBe(true);
  });

  test("a per-session topic without a sid is refused", () => {
    expect(
      isValid(TopicSubscribeRequest, {
        request_id: "3",
        op: "topic_subscribe",
        topic: "transcript",
      }),
    ).toBe(false);
  });

  test("an unknown topic is refused", () => {
    expect(
      isValid(TopicUnsubscribeRequest, {
        request_id: "4",
        op: "topic_unsubscribe",
        topic: "rooms",
      }),
    ).toBe(false);
  });

  test("the ack names the topic", () => {
    expect(isValid(TopicSubscribeResponse, { ok: true, request_id: "3", topic: "peers" })).toBe(
      true,
    );
  });
});

describe("message_send", () => {
  test("a plain send passes", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "op 表の control 25 op を書き始める",
      }),
    ).toBe(true);
  });

  test("a reply points at a delivery frame", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "了解",
        reply_to: `${INSTANCE}/1841`,
      }),
    ).toBe(true);
  });

  test("a reply_to that is not a mid is refused", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "了解",
        reply_to: "1841",
      }),
    ).toBe(false);
  });

  test("an empty body is refused", () => {
    expect(
      isValid(MessageSendRequest, { request_id: "5", op: "message_send", to: OTHER_SID, text: "" }),
    ).toBe(false);
  });

  test("a forwarded request carries the mesh envelope", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "hi",
        to_instance: "wss://nuc.example.ts.net/ccmsg/personal",
        from_instance: INSTANCE,
        hops: [INSTANCE],
      }),
    ).toBe(true);
  });

  test("delivery succeeded", () => {
    expect(isValid(MessageSendResponse, { ok: true, request_id: "5", delivered: true })).toBe(true);
  });

  test("held with a reason and candidates", () => {
    expect(
      isValid(MessageSendResponse, {
        ok: true,
        request_id: "5",
        delivered: false,
        reason: "disappeared",
        candidates: [{ sid: SID, ws: "main", instance: INSTANCE }],
      }),
    ).toBe(true);
  });

  test("held because the recipient would not take it just now", () => {
    expect(
      isValid(MessageSendResponse, {
        ok: true,
        request_id: "5",
        delivered: false,
        reason: "throttled",
      }),
    ).toBe(true);
  });

  test("a reason outside the list is refused", () => {
    expect(
      isValid(MessageSendResponse, {
        ok: true,
        request_id: "5",
        delivered: false,
        reason: "busy",
      }),
    ).toBe(false);
  });
});

describe("say and notify", () => {
  test("say_post carries only its text", () => {
    expect(isValid(SayPostRequest, { request_id: "6", op: "say_post", text: "終わりました" })).toBe(
      true,
    );
  });

  test("say_mark_read may name one session or none", () => {
    expect(isValid(SayMarkReadRequest, { request_id: "7", op: "say_mark_read" })).toBe(true);
    expect(isValid(SayMarkReadRequest, { request_id: "7", op: "say_mark_read", sid: SID })).toBe(
      true,
    );
  });

  test("notify_send passes", () => {
    expect(
      isValid(NotifySendRequest, {
        request_id: "8",
        op: "notify_send",
        sid: SID,
        text: "確認して",
      }),
    ).toBe(true);
  });
});

describe("topic frames", () => {
  test("the inbox snapshot is the undelivered messages", () => {
    expect(
      isValid(InboxFrame, {
        ev: "topic",
        topic: "inbox",
        snapshot: true,
        instance: INSTANCE,
        data: [
          {
            mid: `${INSTANCE}/1841`,
            from: OTHER_SID,
            from_label: "pv2-op-table",
            text: "op 表を書き終えた",
            sent_at: 1_757_300_000_000,
          },
        ],
      }),
    ).toBe(true);
  });

  test("a delta frame carries no snapshot mark", () => {
    expect(
      isValid(InboxFrame, {
        ev: "topic",
        topic: "inbox",
        instance: INSTANCE,
        data: [
          {
            mid: `${INSTANCE}/1842`,
            from: OTHER_SID,
            from_label: "pv2-op-table",
            text: "続き",
            reply_to: `${INSTANCE}/1841`,
            sent_at: 1_757_300_001_000,
          },
        ],
      }),
    ).toBe(true);
  });

  test("`snapshot: false` is refused — the mark is present or absent", () => {
    expect(
      isValid(InboxFrame, {
        ev: "topic",
        topic: "inbox",
        snapshot: false,
        instance: INSTANCE,
        data: [],
      }),
    ).toBe(false);
  });

  test("a frame without its originating instance is refused", () => {
    expect(isValid(NotifyFrame, { ev: "topic", topic: "notify", data: {} })).toBe(false);
  });

  test("a notification frame passes", () => {
    expect(
      isValid(NotifyFrame, {
        ev: "topic",
        topic: "notify",
        instance: INSTANCE,
        data: { sid: SID, sid_label: "pv2-skeleton", text: "確認して", sent_at: 1_757_300_000_000 },
      }),
    ).toBe(true);
  });
});

describe("errors", () => {
  test("an error reply passes", () => {
    expect(
      isValid(ErrorResponse, {
        ok: false,
        request_id: "9",
        error: { code: "capability_unavailable", msg: "launcher is not configured" },
      }),
    ).toBe(true);
  });

  test("a reply that could not name its request passes without the id", () => {
    expect(
      isValid(ErrorResponse, { ok: false, error: { code: "bad_request", msg: "no request_id" } }),
    ).toBe(true);
  });

  test("a code outside the union is refused", () => {
    expect(
      isValid(ErrorResponse, {
        ok: false,
        request_id: "9",
        error: { code: "room_not_found", msg: "gone" },
      }),
    ).toBe(false);
  });
});
