import { describe, expect, test } from "bun:test";
import {
  AUTH_CHALLENGE_TTL_MS,
  AuthAssertRequest,
  AuthAssertResponse,
  AuthChallengeResponse,
  AuthRecordsFrame,
  AuthRefreshRequest,
  AuthRefreshResponse,
  AuthRefreshTokenResponse,
  AuthRegisterRequest,
  AuthResolveRequest,
  AuthResolveResponse,
  AuthRotateResponse,
  FAMILY_TOMBSTONE_RETENTION_MS,
  REGISTER_TTL_MS,
} from "../src/common/auth.ts";
import { HelloRequest, HelloResponse } from "../src/common/hello.ts";
import { InstancePingResponse } from "../src/common/ping.ts";
import { SessionStoppingRequest, SessionStoppingResponse } from "../src/common/shutdown.ts";
import {
  TopicSubscribeRequest,
  TopicSubscribeResponse,
  TopicUnsubscribeRequest,
} from "../src/common/topics.ts";
import { LAST_LIVE_RETENTION_MS, PeersFrame } from "../src/control/peers.ts";
import { ErrorResponse, MAX_FRAME_BYTES } from "../src/envelope.ts";
import {
  INBOX_MAX_PER_SID,
  INBOX_RETENTION_MS,
  InboxFrame,
  MessageSendRequest,
  MessageSendResponse,
} from "../src/messaging/message.ts";
import { NotifyFrame, NotifySendRequest } from "../src/messaging/notify.ts";
import { SayMarkReadRequest, SayPostRequest } from "../src/messaging/say.ts";
import { isValid } from "../src/schemas.ts";

const SID = "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607";
const OTHER_INSTANCE = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const OTHER_SID = "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b";
const INSTANCE = "3f9c1a7b5e2d48069c1a7b5e2d480691";
const INSTANCE_ENDPOINT = "wss://mba.example.ts.net/ccmsg/personal";

describe("hello", () => {
  const helloRequest = {
    request_id: "1",
    op: "hello",
    role: "session",
    protocol_version: 3,
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
        protocol_version: 3,
        mesh: {
          ver: 1,
          iss: "wss://nuc.example.ts.net/ccmsg/personal",
          aud: INSTANCE_ENDPOINT,
          id: OTHER_INSTANCE,
          kid: "9f2c7a5e1b4d8036af51c9e27d604b18",
        },
      }),
    ).toBe(true);
  });

  test("a session may name where it lives and what it runs as", () => {
    expect(
      isValid(HelloRequest, {
        ...helloRequest,
        repo: "ccmsg-protocol",
        ws: "main",
        cwd: "/repos/kawaz/ccmsg-protocol/main",
        repo_root: "/repos/kawaz/ccmsg-protocol",
        branch: "main",
        transcript_path: "/transcripts/6f1a2b3c.jsonl",
        title: "pv2-contract",
        model: "claude-opus-5",
        effort: "high",
      }),
    ).toBe(true);
  });

  test("a session that names none of it is still a hello", () => {
    expect(isValid(HelloRequest, helloRequest)).toBe(true);
  });

  test("a meta field is held to its type", () => {
    expect(isValid(HelloRequest, { ...helloRequest, cwd: ["/repos"] })).toBe(false);
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
        protocol_version: 3,
        instance: INSTANCE,
        endpoint: INSTANCE_ENDPOINT,
        auth_expires_at: 1_757_310_000_000,
        instances: [
          { id: INSTANCE, endpoint: INSTANCE_ENDPOINT, host: "mba", reachable: true },
          {
            id: OTHER_INSTANCE,
            endpoint: "wss://nuc.example.ts.net/ccmsg/personal",
            host: "nuc",
            reachable: false,
          },
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
        protocol_version: 3,
        instance: INSTANCE,
        endpoint: INSTANCE_ENDPOINT,
        instances: [],
        capabilities: ["telepathy"],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(false);
  });

  test("an instance id names the instance and not where it is reached", () => {
    // The URL is the endpoint, which moves; the id does not.
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 3,
        instance: INSTANCE_ENDPOINT,
        endpoint: INSTANCE_ENDPOINT,
        instances: [],
        capabilities: [],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(false);
  });

  test("an instance in no mesh answers without an endpoint to be dialed at", () => {
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 3,
        instance: INSTANCE,
        instances: [{ id: INSTANCE, host: "mba", reachable: true }],
        capabilities: [],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(true);
  });

  test("a peer that has not finished greeting is listed by endpoint alone", () => {
    expect(
      isValid(HelloResponse, {
        ok: true,
        request_id: "1",
        protocol_version: 3,
        instance: INSTANCE,
        endpoint: INSTANCE_ENDPOINT,
        instances: [
          { endpoint: "wss://nuc.example.ts.net/ccmsg/personal", host: "nuc", reachable: false },
        ],
        capabilities: [],
        version: "0.1.0",
        started_at: 1_757_300_000_000,
      }),
    ).toBe(true);
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

describe("session_stopping", () => {
  test("a session may say it is going without saying why", () => {
    expect(isValid(SessionStoppingRequest, { request_id: "2b", op: "session_stopping" })).toBe(
      true,
    );
  });

  test("the reason travels in the harness's own spelling", () => {
    expect(
      isValid(SessionStoppingRequest, {
        request_id: "2b",
        op: "session_stopping",
        reason: "prompt_input_exit",
      }),
    ).toBe(true);
  });

  test("an empty reason is refused — omit it instead", () => {
    expect(
      isValid(SessionStoppingRequest, { request_id: "2b", op: "session_stopping", reason: "" }),
    ).toBe(false);
  });

  test("the reply stamps the instant the pause will carry", () => {
    expect(
      isValid(SessionStoppingResponse, {
        ok: true,
        request_id: "2b",
        stopped_at: 1_757_299_000_000,
      }),
    ).toBe(true);
  });

  test("a reply without that instant is refused", () => {
    expect(isValid(SessionStoppingResponse, { ok: true, request_id: "2b" })).toBe(false);
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
        to_instance: OTHER_INSTANCE,
        from_instance: INSTANCE,
        hops: [INSTANCE],
      }),
    ).toBe(true);
  });

  test("a forwarded request may name the connection it came from", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "hi",
        from_instance: INSTANCE,
        hops: [INSTANCE],
        caller: { role: "session", sid: SID },
      }),
    ).toBe(true);
  });

  test("a person's request names a role and no session", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "hi",
        caller: { role: "user" },
      }),
    ).toBe(true);
  });

  test("a caller without a role is refused — the role is what is dispatched on", () => {
    expect(
      isValid(MessageSendRequest, {
        request_id: "5",
        op: "message_send",
        to: OTHER_SID,
        text: "hi",
        caller: { sid: SID },
      }),
    ).toBe(false);
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

describe("the peers topic", () => {
  const peer = {
    sid: SID,
    instance: INSTANCE,
    repo: "ccmsg-protocol",
    ws: "main",
    cwd: "/repos/kawaz/ccmsg-protocol/main",
    protocol_version: 3,
  };
  const lastLive = {
    sid: OTHER_SID,
    instance: INSTANCE,
    repo: "ccmsg",
    ws: "daemon-v2",
    cwd: "/repos/kawaz/ccmsg/daemon-v2",
    last_seen_at: 1_757_300_000_000,
  };

  test("each entry carries the classification the instance derived", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        snapshot: true,
        instance: INSTANCE,
        data: {
          peers: [
            { ...peer, state: "waiting", pinned: true },
            { ...peer, sid: OTHER_SID, state: "live_unmanaged" },
          ],
          last_live: [{ ...lastLive, state: "paused", stopped_at: 1_757_299_000_000 }],
        },
      }),
    ).toBe(true);
  });

  test("a session gone without a word carries no stopped_at", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [], last_live: [{ ...lastLive, state: "disappeared" }] },
      }),
    ).toBe(true);
  });

  test("an entry that states no classification passes", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [peer], last_live: [] },
      }),
    ).toBe(true);
  });

  test("a classification outside the list is refused", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [{ ...peer, state: "busy" }], last_live: [] },
      }),
    ).toBe(false);
  });

  test("a busy session carries when inference last ran, not a flag", () => {
    // Busy is an attribute of the row: the session is `live` and busy at once,
    // and a client reads recency against its own threshold.
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: {
          peers: [
            { ...peer, state: "live", title: "契約 0.4.0", gateway_active_at: 1_757_300_000_000 },
          ],
          last_live: [],
        },
      }),
    ).toBe(true);
  });

  test("an instance with no gateway simply omits it", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [{ ...peer, state: "live" }], last_live: [] },
      }),
    ).toBe(true);
  });

  test("a boolean in place of the instant is refused", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [{ ...peer, gateway_active_at: true }], last_live: [] },
      }),
    ).toBe(false);
  });

  test("a frame may carry the sending instance's view of the mesh", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        snapshot: true,
        instance: INSTANCE,
        data: {
          peers: [peer],
          last_live: [],
          instances: [
            { id: INSTANCE, endpoint: INSTANCE_ENDPOINT, host: "mba", reachable: true },
            {
              id: OTHER_INSTANCE,
              endpoint: "wss://nuc.example.ts.net/ccmsg/personal",
              host: "nuc",
              reachable: false,
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("an instance entry without its reachability is refused", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: {
          peers: [],
          last_live: [],
          instances: [{ id: INSTANCE, endpoint: INSTANCE_ENDPOINT, host: "mba" }],
        },
      }),
    ).toBe(false);
  });

  test("an ISO stopped_at is refused", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: {
          peers: [],
          last_live: [{ ...lastLive, state: "paused", stopped_at: "2026-09-08T00:00:00Z" }],
        },
      }),
    ).toBe(false);
  });
});

describe("authenticating a person", () => {
  const challenge = {
    challenge: "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA",
    issuer: INSTANCE,
    expires_at: 1_757_300_300_000,
  };
  const session = {
    ok: true,
    request_id: "a1",
    sub: "personal-1",
    access: { value: "YWNjZXNzLXRva2Vu", expires_at: 1_757_310_000_000 },
  };

  test("a challenge says who can spend it", () => {
    expect(isValid(AuthChallengeResponse, { ok: true, request_id: "a1", ...challenge })).toBe(true);
  });

  test("a challenge without its issuer is refused — nobody could consume it", () => {
    const { issuer: _dropped, ...rest } = challenge;
    expect(isValid(AuthChallengeResponse, { ok: true, request_id: "a1", ...rest })).toBe(false);
  });

  test("an issuer spelled as a URL is refused", () => {
    expect(
      isValid(AuthChallengeResponse, {
        ok: true,
        request_id: "a1",
        ...challenge,
        issuer: INSTANCE_ENDPOINT,
      }),
    ).toBe(false);
  });

  test("registration carries the URL's token, the typed code and what the authenticator made", () => {
    expect(
      isValid(AuthRegisterRequest, {
        request_id: "a2",
        op: "auth_register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        code: "048213",
        device_label: "work laptop",
        challenge,
        credential: {
          id: "Y3JlZC1pZA",
          raw_id: "Y3JlZC1pZA",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestation_object: "o2NmbXRkbm9uZQ",
        },
      }),
    ).toBe(true);
  });

  test("a registration with only the URL, and no code beside it, is refused", () => {
    expect(
      isValid(AuthRegisterRequest, {
        request_id: "a2",
        op: "auth_register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        credential: {
          id: "Y3JlZC1pZA",
          raw_id: "Y3JlZC1pZA",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestation_object: "o2NmbXRkbm9uZQ",
        },
      }),
    ).toBe(false);
  });

  test("a code that is not six digits is refused", () => {
    expect(
      isValid(AuthRegisterRequest, {
        request_id: "a2",
        op: "auth_register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        code: "4821",
        credential: {
          id: "Y3JlZC1pZA",
          raw_id: "Y3JlZC1pZA",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestation_object: "o2NmbXRkbm9uZQ",
        },
      }),
    ).toBe(false);
  });

  test("a credential field that is not base64url is refused", () => {
    expect(
      isValid(AuthRegisterRequest, {
        request_id: "a2",
        op: "auth_register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        code: "048213",
        credential: {
          id: "Y3JlZC1pZA",
          raw_id: "cred id!",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
          attestation_object: "o2NmbXRkbm9uZQ",
        },
      }),
    ).toBe(false);
  });

  test("an assertion names the challenge it answers", () => {
    expect(
      isValid(AuthAssertRequest, {
        request_id: "a3",
        op: "auth_assert",
        challenge,
        credential: {
          raw_id: "Y3JlZC1pZA",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
          authenticator_data: "YXV0aC1kYXRh",
          signature: "c2lnbmF0dXJl",
          user_handle: "dXNlci1oYW5kbGU",
        },
      }),
    ).toBe(true);
  });

  test("an assertion from a resident credential names no account", () => {
    expect(
      isValid(AuthAssertRequest, {
        request_id: "a3",
        op: "auth_assert",
        challenge,
        credential: {
          raw_id: "Y3JlZC1pZA",
          client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
          authenticator_data: "YXV0aC1kYXRh",
          signature: "c2lnbmF0dXJl",
        },
      }),
    ).toBe(true);
  });

  test("what a person gets back is the access token alone", () => {
    expect(isValid(AuthAssertResponse, session)).toBe(true);
  });

  test("the refresh token is not in the reply — it is the cookie's", () => {
    expect(
      isValid(AuthRefreshTokenResponse, {
        ...session,
        refresh: { value: "cmVmcmVzaA", expires_at: 1_757_900_000_000 },
      }),
    ).toBe(true);
    // Carried, not refused, like any field this generation does not name — but
    // nothing reads it, and an instance that answered one would be handing the
    // browser's script the value the cookie exists to keep from it.
    expect(isValid(AuthRefreshTokenResponse, session)).toBe(true);
  });

  test("renewing a live connection moves its deadline", () => {
    expect(
      isValid(AuthRefreshRequest, {
        request_id: "a4",
        op: "auth_refresh",
        access_token: "YWNjZXNzLXRva2Vu",
      }),
    ).toBe(true);
    expect(
      isValid(AuthRefreshResponse, {
        ok: true,
        request_id: "a4",
        auth_expires_at: 1_757_320_000_000,
      }),
    ).toBe(true);
  });

  test("the issuer is asked to spend a registration, and answers what it authorized", () => {
    expect(
      isValid(AuthResolveRequest, {
        request_id: "a5",
        op: "auth_resolve",
        kind: "register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        code: "048213",
        to_instance: INSTANCE,
      }),
    ).toBe(true);
    expect(
      isValid(AuthResolveResponse, {
        ok: true,
        request_id: "a5",
        kind: "register",
        claims: {
          iss: INSTANCE,
          sub: "personal-1",
          unit: "personal",
          endpoint: INSTANCE_ENDPOINT,
          rp_id: "mba.example.ts.net",
          expires_at: 1_757_300_600_000,
          jti: "01J9Z3W2Q",
          user_id: "dXNlci1oYW5kbGU",
          issued_label: "for kawaz",
        },
      }),
    ).toBe(true);
  });

  test("a forwarded registration without the typed code is refused", () => {
    expect(
      isValid(AuthResolveRequest, {
        request_id: "a5",
        op: "auth_resolve",
        kind: "register",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
        to_instance: INSTANCE,
      }),
    ).toBe(false);
  });

  test("spending a challenge answers nothing beyond having spent it", () => {
    expect(isValid(AuthResolveResponse, { ok: true, request_id: "a5", kind: "challenge" })).toBe(
      true,
    );
  });

  test("a resolve that mixes the two subjects is refused", () => {
    expect(
      isValid(AuthResolveRequest, {
        request_id: "a5",
        op: "auth_resolve",
        kind: "challenge",
        token: "eyJhbGciOiJIUzI1NiJ9.e30.c2ln",
      }),
    ).toBe(false);
  });

  test("a rotation answers both halves — the caller has a cookie to set", () => {
    expect(
      isValid(AuthRotateResponse, {
        ok: true,
        request_id: "a6",
        sub: "personal-1",
        access: { value: "YWNjZXNz", expires_at: 1_757_310_000_000 },
        refresh: { value: "cmVmcmVzaA", expires_at: 1_757_900_000_000 },
      }),
    ).toBe(true);
  });

  test("a credential record is complete without the instance that wrote it", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        snapshot: true,
        instance: INSTANCE,
        data: {
          records: [
            {
              key: "credential/personal-1/Y3JlZC1pZA",
              updated_at: 1_757_300_000_000,
              body: {
                kind: "credential",
                sub: "personal-1",
                credential_id: "Y3JlZC1pZA",
                public_key: "pQECAyYgASFYIA",
                user_handle: "dXNlci1oYW5kbGU",
                sign_count: 0,
                registered_at: 1_757_300_000_000,
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a record carries what a person reads it back by, none of it authenticating", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        instance: INSTANCE,
        data: {
          records: [
            {
              key: "credential/personal-1/Y3JlZC1pZA",
              updated_at: 1_757_400_000_000,
              body: {
                kind: "credential",
                sub: "personal-1",
                credential_id: "Y3JlZC1pZA",
                public_key: "pQECAyYgASFYIA",
                user_handle: "dXNlci1oYW5kbGU",
                rp_id: "mba.example.ts.net",
                issued_label: "for kawaz",
                device_label: "work laptop",
                registered_at: 1_757_300_000_000,
                registered_ip: "203.0.113.7",
                registered_user_agent: "Mozilla/5.0",
                last_used_at: 1_757_400_000_000,
                last_used_ip: "203.0.113.7",
                last_used_user_agent: "Mozilla/5.0",
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a family names the one instance allowed to write it", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        instance: INSTANCE,
        data: {
          records: [
            {
              key: "family/01J9Z3W2Q",
              updated_at: 1_757_300_100_000,
              body: {
                kind: "token_family",
                sub: "personal-1",
                iss: INSTANCE,
                access: { value: "YWNjZXNz", expires_at: 1_757_310_000_000 },
                refresh: { value: "cmVmcmVzaA", expires_at: 1_757_900_000_000 },
                previous_refresh: { value: "b2xkLXJlZnJlc2g", expires_at: 1_757_400_000_000 },
                retired: [
                  {
                    hash: "9f".repeat(32),
                    expires_at: 1_757_380_000_000,
                  },
                ],
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a retired generation is remembered as a digest and not as the token", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        instance: INSTANCE,
        data: {
          records: [
            {
              key: "family/01J9Z3W2Q",
              updated_at: 1_757_300_100_000,
              body: {
                kind: "token_family",
                sub: "personal-1",
                iss: INSTANCE,
                access: { value: "YWNjZXNz", expires_at: 1_757_310_000_000 },
                refresh: { value: "cmVmcmVzaA", expires_at: 1_757_900_000_000 },
                retired: [{ hash: "b2xkLXJlZnJlc2g", expires_at: 1_757_380_000_000 }],
              },
            },
          ],
        },
      }),
    ).toBe(false);
  });

  test("a removal travels as a record, and a credential's never expires", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        instance: INSTANCE,
        data: {
          records: [
            {
              key: "credential/personal-1/Y3JlZC1pZA",
              updated_at: 1_757_400_000_000,
              body: { kind: "tombstone", sub: "personal-1", deleted_at: 1_757_400_000_000 },
            },
            {
              key: "family/01J9Z3W2Q",
              updated_at: 1_757_400_000_000,
              body: {
                kind: "tombstone",
                sub: "personal-1",
                deleted_at: 1_757_400_000_000,
                expires_at: 1_758_004_800_000,
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a record of no known kind is refused", () => {
    expect(
      isValid(AuthRecordsFrame, {
        ev: "topic",
        topic: "auth_records",
        instance: INSTANCE,
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

  test("a message a person sent names them as the sender", () => {
    expect(
      isValid(InboxFrame, {
        ev: "topic",
        topic: "inbox",
        instance: INSTANCE,
        data: [
          {
            mid: `${INSTANCE}/1843`,
            from: "user",
            from_label: "kawaz",
            text: "契約の 4 件をまとめて",
            sent_at: 1_757_300_002_000,
          },
        ],
      }),
    ).toBe(true);
  });

  test("a sender that is neither a sid nor the person is refused", () => {
    expect(
      isValid(InboxFrame, {
        ev: "topic",
        topic: "inbox",
        instance: INSTANCE,
        data: [
          {
            mid: `${INSTANCE}/1844`,
            from: "instance",
            from_label: "nuc",
            text: "誰",
            sent_at: 1_757_300_003_000,
          },
        ],
      }),
    ).toBe(false);
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

  test("a failure that is not the caller's says so", () => {
    // Not `bad_request`: the arguments were right, so re-reading them is the
    // one thing that cannot help.
    expect(
      isValid(ErrorResponse, {
        ok: false,
        request_id: "9",
        error: { code: "internal_error", msg: "the transcript reader threw" },
      }),
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
