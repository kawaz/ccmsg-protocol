import type { TSchema } from "@sinclair/typebox";
import { describe, expect, test } from "bun:test";
import { OP_NAMES } from "../src/attributes.ts";
import {
  AUTH_CHALLENGE_TTL_MS,
  AuthAssertRequest,
  AuthChallengeResponse,
  AuthRecordsFrame,
  AuthRegisterRequest,
  AuthResolveRequest,
  FAMILY_TOMBSTONE_RETENTION_MS,
  REGISTER_TTL_MS,
} from "../src/common/auth.ts";
import {
  HelloInstanceRequest,
  HelloSessionRequest,
  HelloSessionResponse,
  HelloUserRequest,
} from "../src/common/hello.ts";
import { InstancePingResponse } from "../src/common/ping.ts";
import { SessionStoppingRequest, SessionStoppingResponse } from "../src/common/shutdown.ts";
import { TopicSubscribeRequest, TopicUnsubscribeRequest } from "../src/common/topics.ts";
import { InstancesFrame } from "../src/control/instances.ts";
import { LAST_LIVE_RETENTION_MS, type PeerInfo, PeersFrame } from "../src/control/peers.ts";
import { ErrorResponse, MAX_FRAME_BYTES } from "../src/envelope.ts";
import {
  AUTH_RECORDS_FAMILY_FRAME,
  AUTH_RECORDS_TOMBSTONE_FRAME,
  AUTH_RESOLVE_CHALLENGE_REQUEST,
  AUTH_RESOLVE_CHALLENGE_RESPONSE,
  ERROR_RESPONSE,
  ERROR_RESPONSE_UNIDENTIFIED,
  FIXTURE_IDS,
  HELLO_INSTANCE_REQUEST,
  HELLO_USER_REQUEST,
  MESSAGE_SEND_FORWARDED_REQUEST,
  MESSAGE_SEND_HELD_RESPONSE,
  OP_FIXTURES,
  PEERS_CHANGE_FRAME,
  TOPIC_FIXTURES,
  TOPIC_SUBSCRIBE_SESSION_REQUEST,
  TRANSCRIPT_SIZE_FRAME,
} from "../src/fixtures/index.ts";
import {
  INBOX_MAX_PER_SID,
  INBOX_RETENTION_MS,
  InboxFrame,
  MessageSendRequest,
  MessageSendResponse,
} from "../src/messaging/message.ts";
import { NotifyFrame } from "../src/messaging/notify.ts";
import { isValid, OP_SCHEMAS, TOPIC_SCHEMAS, validationErrors } from "../src/schemas.ts";

const { sid: SID, instance: INSTANCE, endpoint: INSTANCE_ENDPOINT } = FIXTURE_IDS;

/** Assert against the schema and say what failed when it does — a fixture is
 * only useful if a break in it names the field that broke. */
function passes(schema: TSchema, value: unknown): void {
  expect(validationErrors(schema, value)).toEqual([]);
}

const helloRequest = OP_FIXTURES["hello.session"].request;
const helloResponse = OP_FIXTURES["hello.session"].response;
const challenge = {
  challenge: OP_FIXTURES["auth.challenge"].response.challenge,
  issuer: OP_FIXTURES["auth.challenge"].response.issuer,
  expires_at: OP_FIXTURES["auth.challenge"].response.expires_at,
};

describe("the fixtures cover the contract", () => {
  test.each(OP_NAMES)("%s carries a request and a reply that pass", (op) => {
    const fixture = OP_FIXTURES[op];
    passes(OP_SCHEMAS[op].request, fixture.request);
    passes(OP_SCHEMAS[op].response, fixture.response);
  });

  test.each(Object.keys(TOPIC_SCHEMAS) as (keyof typeof TOPIC_SCHEMAS)[])(
    "the %s topic carries a frame that passes",
    (topic) => {
      passes(TOPIC_SCHEMAS[topic], TOPIC_FIXTURES[topic]);
    },
  );

  test.each([
    ["an instance's hello", HelloInstanceRequest, HELLO_INSTANCE_REQUEST],
    ["a person's hello", HelloUserRequest, HELLO_USER_REQUEST],
    ["a subscription naming one session", TopicSubscribeRequest, TOPIC_SUBSCRIBE_SESSION_REQUEST],
    ["spending a challenge", AuthResolveRequest, AUTH_RESOLVE_CHALLENGE_REQUEST],
    [
      "what spending one answers",
      OP_SCHEMAS["auth.resolve"].response,
      AUTH_RESOLVE_CHALLENGE_RESPONSE,
    ],
    ["a forwarded send", MessageSendRequest, MESSAGE_SEND_FORWARDED_REQUEST],
    ["a send nobody took", MessageSendResponse, MESSAGE_SEND_HELD_RESPONSE],
    ["a transcript's opening frame", TOPIC_SCHEMAS.transcript, TRANSCRIPT_SIZE_FRAME],
    ["a token family", AuthRecordsFrame, AUTH_RECORDS_FAMILY_FRAME],
    ["a removal", AuthRecordsFrame, AUTH_RECORDS_TOMBSTONE_FRAME],
    ["a failed reply", ErrorResponse, ERROR_RESPONSE],
    ["a reply that names no request", ErrorResponse, ERROR_RESPONSE_UNIDENTIFIED],
  ] as [string, TSchema, unknown][])("%s passes", (_name, schema, fixture) => {
    passes(schema, fixture);
  });
});

describe("hello", () => {
  test("a session that names none of where it lives is still a hello", () => {
    const {
      repo: _repo,
      ws: _ws,
      cwd: _cwd,
      repo_root: _repoRoot,
      branch: _branch,
      transcript_path: _transcriptPath,
      title: _title,
      model: _model,
      effort: _effort,
      ...rest
    } = helloRequest;
    expect(isValid(HelloSessionRequest, rest)).toBe(true);
  });

  test("a meta field is held to its type", () => {
    expect(isValid(HelloSessionRequest, { ...helloRequest, cwd: ["/repos"] })).toBe(false);
  });

  test("a greeting arrives under the name of what it settles, not as a field", () => {
    // The op is the role, so a session's meta has nowhere to go on the other
    // two and a mesh claim has nowhere to go on this one.
    expect(isValid(HelloUserRequest, HELLO_USER_REQUEST)).toBe(true);
    expect(isValid(HelloUserRequest, { ...HELLO_USER_REQUEST, op: "hello.session" })).toBe(false);
    expect(isValid(HelloSessionRequest, HELLO_USER_REQUEST)).toBe(false);
    expect(isValid(HelloInstanceRequest, helloRequest)).toBe(false);
  });

  test("a malformed sid is refused", () => {
    expect(isValid(HelloSessionRequest, { ...helloRequest, sid: "session-3" })).toBe(false);
  });

  test("a request without its correlation id is refused", () => {
    const { request_id: _dropped, ...rest } = helloRequest;
    expect(isValid(HelloSessionRequest, rest)).toBe(false);
  });

  test("a capability outside the set is refused", () => {
    expect(isValid(HelloSessionResponse, { ...helloResponse, capabilities: ["telepathy"] })).toBe(
      false,
    );
  });

  test("an instance id names the instance and not where it is reached", () => {
    // The URL is the endpoint, which moves; the id does not.
    expect(isValid(HelloSessionResponse, { ...helloResponse, instance: INSTANCE_ENDPOINT })).toBe(
      false,
    );
  });

  test("an instance in no mesh answers without an endpoint to be dialed at", () => {
    const { endpoint: _dropped, ...rest } = helloResponse;
    expect(
      isValid(HelloSessionResponse, {
        ...rest,
        instances: [{ id: INSTANCE, host: "mba", reachable: true }],
      }),
    ).toBe(true);
  });

  test("an endpoint naming a route rather than the base it hangs under is refused", () => {
    // `/ws` is below the endpoint, not part of it, and the scheme is the one
    // the HTTP routes are spelled with.
    for (const endpoint of [
      "wss://mba.example.ts.net/ccmsg/personal/",
      "https://mba.example.ts.net/ccmsg/personal/ws",
      "https://mba.example.ts.net/ccmsg/personal",
      "https://mba.example.ts.net/ccmsg/?x=1",
    ]) {
      expect(isValid(HelloSessionResponse, { ...helloResponse, endpoint, instances: [] })).toBe(
        false,
      );
    }
  });

  test("a peer that has not finished greeting is listed by endpoint alone", () => {
    expect(
      isValid(HelloSessionResponse, {
        ...helloResponse,
        instances: [
          { endpoint: "https://nuc.example.ts.net/ccmsg/personal/", host: "nuc", reachable: false },
        ],
      }),
    ).toBe(true);
  });
});

describe("instance.ping", () => {
  test("an ISO timestamp is refused", () => {
    expect(
      isValid(InstancePingResponse, {
        ...OP_FIXTURES["instance.ping"].response,
        started_at: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });
});

describe("session.stopping", () => {
  test("a session may say it is going without saying why", () => {
    const { reason: _dropped, ...rest } = OP_FIXTURES["session.stopping"].request;
    expect(isValid(SessionStoppingRequest, rest)).toBe(true);
  });

  test("an empty reason is refused — omit it instead", () => {
    expect(
      isValid(SessionStoppingRequest, { ...OP_FIXTURES["session.stopping"].request, reason: "" }),
    ).toBe(false);
  });

  test("a reply without the instant the pause will carry is refused", () => {
    const { stopped_at: _dropped, ...rest } = OP_FIXTURES["session.stopping"].response;
    expect(isValid(SessionStoppingResponse, rest)).toBe(false);
  });
});

describe("topic subscription", () => {
  test("a per-session topic without a sid is refused", () => {
    expect(
      isValid(TopicSubscribeRequest, { ...TOPIC_SUBSCRIBE_SESSION_REQUEST, topic: "transcript" }),
    ).toBe(false);
  });

  test("an unknown topic is refused", () => {
    expect(
      isValid(TopicUnsubscribeRequest, {
        ...OP_FIXTURES["topic.unsubscribe"].request,
        topic: "rooms",
      }),
    ).toBe(false);
  });
});

describe("message.send", () => {
  test("a reply_to that is not a mid is refused", () => {
    expect(
      isValid(MessageSendRequest, { ...OP_FIXTURES["message.send"].request, reply_to: "1841" }),
    ).toBe(false);
  });

  test("an empty body is refused", () => {
    expect(isValid(MessageSendRequest, { ...OP_FIXTURES["message.send"].request, text: "" })).toBe(
      false,
    );
  });

  test("a person's request names a role and no session", () => {
    expect(
      isValid(MessageSendRequest, { ...MESSAGE_SEND_FORWARDED_REQUEST, caller: { role: "user" } }),
    ).toBe(true);
  });

  test("a caller without a role is refused — the role is what is dispatched on", () => {
    expect(
      isValid(MessageSendRequest, { ...MESSAGE_SEND_FORWARDED_REQUEST, caller: { sid: SID } }),
    ).toBe(false);
  });

  test("a reason outside the list is refused", () => {
    expect(isValid(MessageSendResponse, { ...MESSAGE_SEND_HELD_RESPONSE, reason: "busy" })).toBe(
      false,
    );
  });
});

describe("the peers topic", () => {
  const peersFrame = TOPIC_FIXTURES.peers;
  const rows = peersFrame.data.peers.filter((row): row is PeerInfo => !("removed" in row));
  const [peer] = rows;
  const lost = rows[rows.length - 1];

  test("a session gone without a word carries no stopped_at", () => {
    const { stopped_at: _dropped, ...rest } = lost;
    expect(
      isValid(PeersFrame, { ...peersFrame, data: { peers: [{ ...rest, state: "disappeared" }] } }),
    ).toBe(true);
  });

  test("a lost session is a row of the same list, matched by the same pair", () => {
    // What moves it there is its own field, so a client that already holds the
    // row updates it rather than moving it between two lists.
    expect(lost.state).toBe("paused");
    expect(typeof lost.last_seen_at).toBe("number");
    expect(lost.sid).not.toBe(peer.sid);
  });

  test("a removal names the pair it is matched by and nothing else", () => {
    const [, removal] = PEERS_CHANGE_FRAME.data.peers;
    expect(removal).toEqual({ sid: removal.sid, instance: removal.instance, removed: true });
    passes(PeersFrame, PEERS_CHANGE_FRAME);
  });

  test("a removal that is not marked is refused — an absence would say nothing", () => {
    expect(
      isValid(PeersFrame, {
        ...peersFrame,
        data: { peers: [{ sid: peer.sid, instance: peer.instance }] },
      }),
    ).toBe(false);
  });

  test("an entry that states no classification passes", () => {
    const { state: _dropped, ...rest } = peer;
    expect(isValid(PeersFrame, { ...peersFrame, data: { peers: [rest] } })).toBe(true);
  });

  test("a classification outside the list is refused", () => {
    expect(
      isValid(PeersFrame, { ...peersFrame, data: { peers: [{ ...peer, state: "busy" }] } }),
    ).toBe(false);
  });

  test("a busy session carries when inference last ran, not a flag", () => {
    // Busy is an attribute of the row: the session is `live` and busy at once,
    // and a client reads recency against its own threshold.
    expect(isValid(PeersFrame, peersFrame)).toBe(true);
    expect(peer.state).toBe("live");
    expect(typeof peer.gateway_active_at).toBe("number");
  });

  test("a boolean in place of the instant is refused", () => {
    expect(
      isValid(PeersFrame, {
        ...peersFrame,
        data: { peers: [{ ...peer, gateway_active_at: true }] },
      }),
    ).toBe(false);
  });

  test("an ISO stopped_at is refused", () => {
    expect(
      isValid(PeersFrame, {
        ...peersFrame,
        data: { peers: [{ ...lost, stopped_at: "2026-09-08T00:00:00Z" }] },
      }),
    ).toBe(false);
  });
});

describe("the instances topic", () => {
  const frame = TOPIC_FIXTURES.instances;

  test("an instance entry without its reachability is refused", () => {
    expect(
      isValid(InstancesFrame, {
        ...frame,
        data: { instances: [{ id: INSTANCE, endpoint: INSTANCE_ENDPOINT, host: "mba" }] },
      }),
    ).toBe(false);
  });

  test("a sender states its own whole view, itself included", () => {
    expect(frame.data.instances.map((entry) => entry.id)).toContain(INSTANCE);
  });
});

describe("authenticating a person", () => {
  test("a challenge without its issuer is refused — nobody could consume it", () => {
    const { issuer: _dropped, ...rest } = OP_FIXTURES["auth.challenge"].response;
    expect(isValid(AuthChallengeResponse, rest)).toBe(false);
  });

  test("an issuer spelled as a URL is refused", () => {
    expect(
      isValid(AuthChallengeResponse, {
        ...OP_FIXTURES["auth.challenge"].response,
        issuer: INSTANCE_ENDPOINT,
      }),
    ).toBe(false);
  });

  test("a registration with only the URL, and no code beside it, is refused", () => {
    const { code: _dropped, ...rest } = OP_FIXTURES["auth.register"].request;
    expect(isValid(AuthRegisterRequest, rest)).toBe(false);
  });

  test("a code that is not six digits is refused", () => {
    expect(
      isValid(AuthRegisterRequest, { ...OP_FIXTURES["auth.register"].request, code: "4821" }),
    ).toBe(false);
  });

  test("a credential field that is not base64url is refused", () => {
    const request = OP_FIXTURES["auth.register"].request;
    expect(
      isValid(AuthRegisterRequest, {
        ...request,
        credential: { ...request.credential, raw_id: "cred id!" },
      }),
    ).toBe(false);
  });

  test("an assertion from a resident credential names no account", () => {
    const request = OP_FIXTURES["auth.assert"].request;
    const { user_handle: _dropped, ...credential } = request.credential;
    expect(isValid(AuthAssertRequest, { ...request, credential })).toBe(true);
  });

  test("the refresh token is not in the reply — it is the cookie's", () => {
    // Carried, not refused, like any field this generation does not name — but
    // nothing reads it, and an instance that answered one would be handing the
    // browser's script the value the cookie exists to keep from it.
    expect(OP_FIXTURES["auth.token.refresh"].response).not.toHaveProperty("refresh");
  });

  test("a forwarded registration without the typed code is refused", () => {
    const { code: _dropped, ...rest } = OP_FIXTURES["auth.resolve"].request;
    expect(isValid(AuthResolveRequest, rest)).toBe(false);
  });

  test("a resolve that mixes the two subjects is refused", () => {
    expect(
      isValid(AuthResolveRequest, { ...OP_FIXTURES["auth.resolve"].request, kind: "challenge" }),
    ).toBe(false);
  });

  test("a credential says which endpoint it admits its holder to, and cannot leave it out", () => {
    const frame = TOPIC_FIXTURES["auth.records"];
    const [record] = frame.data.records;
    const { endpoint: _dropped, ...body } = record.body;
    // A neighbour under the same host and the same relying party is a separate
    // endpoint, so it takes a registration of its own.
    expect(
      isValid(AuthRecordsFrame, {
        ...frame,
        data: {
          records: [{ ...record, body: { ...body, endpoint: "https://mba.example.ts.net/" } }],
        },
      }),
    ).toBe(true);
    expect(isValid(AuthRecordsFrame, { ...frame, data: { records: [{ ...record, body }] } })).toBe(
      false,
    );
  });

  test("a retired generation is remembered as a digest and not as the token", () => {
    const [record] = AUTH_RECORDS_FAMILY_FRAME.data.records;
    expect(
      isValid(AuthRecordsFrame, {
        ...AUTH_RECORDS_FAMILY_FRAME,
        data: {
          records: [
            {
              ...record,
              body: {
                ...record.body,
                retired: [{ hash: "b2xkLXJlZnJlc2g", expires_at: record.updated_at }],
              },
            },
          ],
        },
      }),
    ).toBe(false);
  });

  test("a record of no known kind is refused", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ...TOPIC_FIXTURES["auth.records"],
        data: {
          records: [{ key: "k", updated_at: 1, body: { kind: "password", sub: "personal-1" } }],
        },
      }),
    ).toBe(false);
  });

  test("a family expires within the window its tombstone is kept for", () => {
    expect(FAMILY_TOMBSTONE_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(AUTH_CHALLENGE_TTL_MS).toBeLessThan(REGISTER_TTL_MS);
  });

  test("a challenge is spent at the instance that issued it", () => {
    expect(challenge.issuer).toBe(INSTANCE);
    expect(AUTH_RESOLVE_CHALLENGE_RESPONSE.kind).toBe("challenge");
  });
});

describe("frame size", () => {
  test("one frame is capped at 1 MiB", () => {
    expect(MAX_FRAME_BYTES).toBe(1024 * 1024);
  });
});

describe("retention", () => {
  test("the inbox and the last-known list expire on the same window", () => {
    expect(INBOX_RETENTION_MS).toBe(LAST_LIVE_RETENTION_MS);
    expect(LAST_LIVE_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("one session's inbox holds 256 undelivered messages", () => {
    expect(INBOX_MAX_PER_SID).toBe(256);
  });
});

describe("topic frames", () => {
  test("a message a person sent names them as the sender", () => {
    const senders = TOPIC_FIXTURES.inbox.data.map((message) => message.from);
    expect(senders).toContain("user");
  });

  test("a sender that is neither a sid nor the person is refused", () => {
    const frame = TOPIC_FIXTURES.inbox;
    const [message] = frame.data;
    expect(isValid(InboxFrame, { ...frame, data: [{ ...message, from: "instance" }] })).toBe(false);
  });

  test("`snapshot: false` is refused — the mark is present or absent", () => {
    expect(isValid(InboxFrame, { ...TOPIC_FIXTURES.inbox, snapshot: false })).toBe(false);
  });

  test("a frame without its originating instance is refused", () => {
    const { instance: _dropped, ...rest } = TOPIC_FIXTURES.notify;
    expect(isValid(NotifyFrame, rest)).toBe(false);
  });
});

describe("errors", () => {
  test("a failure that is not the caller's says so", () => {
    // Not `bad_request`: the arguments were right, so re-reading them is the
    // one thing that cannot help.
    expect(
      isValid(ErrorResponse, {
        ...ERROR_RESPONSE,
        error: { code: "internal_error", msg: "the transcript reader threw" },
      }),
    ).toBe(true);
  });

  test("a code outside the union is refused", () => {
    expect(
      isValid(ErrorResponse, { ...ERROR_RESPONSE, error: { code: "room_not_found", msg: "gone" } }),
    ).toBe(false);
  });
});
