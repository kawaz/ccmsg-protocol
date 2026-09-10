import type { Static } from "@sinclair/typebox";
import type {
  AuthAssertRequest,
  AuthAssertResponse,
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthRefreshRequest,
  AuthRefreshResponse,
  AuthRefreshTokenRequest,
  AuthRefreshTokenResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResolveRequest,
  AuthResolveResponse,
  AuthRotateRequest,
  AuthRotateResponse,
} from "../common/auth.ts";
import type { HelloRequest, HelloResponse } from "../common/hello.ts";
import type { InstancePingRequest, InstancePingResponse } from "../common/ping.ts";
import type {
  InstanceShutdownRequest,
  InstanceShutdownResponse,
  SessionStoppingRequest,
  SessionStoppingResponse,
} from "../common/shutdown.ts";
import type {
  TopicSubscribeRequest,
  TopicSubscribeResponse,
  TopicUnsubscribeRequest,
  TopicUnsubscribeResponse,
} from "../common/topics.ts";
import { FIXTURE_IDS, FIXTURE_NOW } from "./ids.ts";

const { sid, instance, other_instance, endpoint, other_endpoint, request_id } = FIXTURE_IDS;

export const HELLO_REQUEST: Static<typeof HelloRequest> = {
  request_id,
  op: "hello",
  role: "session",
  protocol_version: 3,
  sid,
  client_version: "0.1.0",
  repo: "ccmsg-protocol",
  ws: "main",
  cwd: "/repos/kawaz/ccmsg-protocol/main",
  repo_root: "/repos/kawaz/ccmsg-protocol",
  branch: "main",
  transcript_path: "/transcripts/6f1a2b3c.jsonl",
  title: "contract fixtures",
  model: "claude-opus-5",
  effort: "high",
};

/** The other side of `hello`: an instance greeting a peer, which carries the
 * mesh claim in place of a session's meta. */
export const HELLO_MESH_REQUEST: Static<typeof HelloRequest> = {
  request_id,
  op: "hello",
  role: "instance",
  protocol_version: 3,
  mesh: {
    ver: 1,
    iss: other_endpoint,
    aud: endpoint,
    id: other_instance,
    kid: "9f2c7a5e1b4d8036af51c9e27d604b18",
  },
};

export const HELLO_RESPONSE: Static<typeof HelloResponse> = {
  ok: true,
  request_id,
  protocol_version: 3,
  instance,
  endpoint,
  auth_expires_at: FIXTURE_NOW + 10_000_000,
  instances: [
    { id: instance, endpoint, host: "mba", reachable: true },
    { id: other_instance, endpoint: other_endpoint, host: "nuc", reachable: false },
  ],
  capabilities: ["fork", "launcher", "terminal"],
  terminal_gateway: "https://mba.example.ts.net/hyoui",
  version: "0.1.0",
  started_at: FIXTURE_NOW - 3_600_000,
};

export const INSTANCE_PING_REQUEST: Static<typeof InstancePingRequest> = {
  request_id,
  op: "instance_ping",
};

export const INSTANCE_PING_RESPONSE: Static<typeof InstancePingResponse> = {
  ok: true,
  request_id,
  instance,
  version: "0.1.0",
  pid: 4821,
  started_at: FIXTURE_NOW - 3_600_000,
  clients: 3,
  http: ["127.0.0.1:8787"],
  network: "online",
};

export const INSTANCE_SHUTDOWN_REQUEST: Static<typeof InstanceShutdownRequest> = {
  request_id,
  op: "instance_shutdown",
};

export const INSTANCE_SHUTDOWN_RESPONSE: Static<typeof InstanceShutdownResponse> = {
  ok: true,
  request_id,
};

export const SESSION_STOPPING_REQUEST: Static<typeof SessionStoppingRequest> = {
  request_id,
  op: "session_stopping",
  reason: "prompt_input_exit",
};

export const SESSION_STOPPING_RESPONSE: Static<typeof SessionStoppingResponse> = {
  ok: true,
  request_id,
  stopped_at: FIXTURE_NOW - 1_000_000,
};

export const TOPIC_SUBSCRIBE_REQUEST: Static<typeof TopicSubscribeRequest> = {
  request_id,
  op: "topic_subscribe",
  topic: "peers",
};

export const TOPIC_SUBSCRIBE_RESPONSE: Static<typeof TopicSubscribeResponse> = {
  ok: true,
  request_id,
  topic: "peers",
};

/** A subscription naming one session, which is how the session-scoped topics
 * are spelled. */
export const TOPIC_SUBSCRIBE_SESSION_REQUEST: Static<typeof TopicSubscribeRequest> = {
  request_id,
  op: "topic_subscribe",
  topic: `transcript:${sid}`,
};

export const TOPIC_UNSUBSCRIBE_REQUEST: Static<typeof TopicUnsubscribeRequest> = {
  request_id,
  op: "topic_unsubscribe",
  topic: "peers",
};

export const TOPIC_UNSUBSCRIBE_RESPONSE: Static<typeof TopicUnsubscribeResponse> = {
  ok: true,
  request_id,
  topic: "peers",
};

const CHALLENGE = {
  challenge: "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA",
  issuer: instance,
  expires_at: FIXTURE_NOW + 300_000,
};

const ACCESS = { value: "YWNjZXNzLXRva2Vu", expires_at: FIXTURE_NOW + 10_000_000 };
const REFRESH = { value: "cmVmcmVzaA", expires_at: FIXTURE_NOW + 600_000_000 };
const REGISTER_TOKEN = "eyJhbGciOiJIUzI1NiJ9.e30.c2ln";
const REGISTER_CODE = "048213";
const SUBJECT = "personal-1";

export const AUTH_CHALLENGE_REQUEST: Static<typeof AuthChallengeRequest> = {
  request_id,
  op: "auth_challenge",
};

export const AUTH_CHALLENGE_RESPONSE: Static<typeof AuthChallengeResponse> = {
  ok: true,
  request_id,
  ...CHALLENGE,
};

export const AUTH_REGISTER_REQUEST: Static<typeof AuthRegisterRequest> = {
  request_id,
  op: "auth_register",
  token: REGISTER_TOKEN,
  code: REGISTER_CODE,
  device_label: "work laptop",
  challenge: CHALLENGE,
  credential: {
    id: "Y3JlZC1pZA",
    raw_id: "Y3JlZC1pZA",
    client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
    attestation_object: "o2NmbXRkbm9uZQ",
  },
};

export const AUTH_REGISTER_RESPONSE: Static<typeof AuthRegisterResponse> = {
  ok: true,
  request_id,
  sub: SUBJECT,
  access: ACCESS,
};

export const AUTH_ASSERT_REQUEST: Static<typeof AuthAssertRequest> = {
  request_id,
  op: "auth_assert",
  challenge: CHALLENGE,
  credential: {
    raw_id: "Y3JlZC1pZA",
    client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
    authenticator_data: "YXV0aC1kYXRh",
    signature: "c2lnbmF0dXJl",
    user_handle: "dXNlci1oYW5kbGU",
  },
};

export const AUTH_ASSERT_RESPONSE: Static<typeof AuthAssertResponse> = {
  ok: true,
  request_id,
  sub: SUBJECT,
  access: ACCESS,
};

export const AUTH_REFRESH_TOKEN_REQUEST: Static<typeof AuthRefreshTokenRequest> = {
  request_id,
  op: "auth_refresh_token",
  reason: "reload",
};

export const AUTH_REFRESH_TOKEN_RESPONSE: Static<typeof AuthRefreshTokenResponse> = {
  ok: true,
  request_id,
  sub: SUBJECT,
  access: ACCESS,
};

export const AUTH_REFRESH_REQUEST: Static<typeof AuthRefreshRequest> = {
  request_id,
  op: "auth_refresh",
  access_token: ACCESS.value,
};

export const AUTH_REFRESH_RESPONSE: Static<typeof AuthRefreshResponse> = {
  ok: true,
  request_id,
  auth_expires_at: FIXTURE_NOW + 20_000_000,
};

export const AUTH_RESOLVE_REQUEST = {
  request_id,
  op: "auth_resolve",
  to_instance: instance,
  kind: "register",
  token: REGISTER_TOKEN,
  code: REGISTER_CODE,
} satisfies Static<typeof AuthResolveRequest>;

export const AUTH_RESOLVE_RESPONSE = {
  ok: true,
  request_id,
  kind: "register",
  claims: {
    iss: instance,
    sub: SUBJECT,
    unit: "personal",
    endpoint,
    rp_id: "mba.example.ts.net",
    expires_at: FIXTURE_NOW + 600_000,
    jti: "01J9Z3W2Q",
    user_id: "dXNlci1oYW5kbGU",
    issued_label: "for kawaz",
  },
} satisfies Static<typeof AuthResolveResponse>;

/** The other half of the resolve union: spending a challenge, which answers
 * nothing beyond having spent it. */
export const AUTH_RESOLVE_CHALLENGE_REQUEST = {
  request_id,
  op: "auth_resolve",
  to_instance: instance,
  kind: "challenge",
  challenge: CHALLENGE.challenge,
} satisfies Static<typeof AuthResolveRequest>;

export const AUTH_RESOLVE_CHALLENGE_RESPONSE = {
  ok: true,
  request_id,
  kind: "challenge",
} satisfies Static<typeof AuthResolveResponse>;

export const AUTH_ROTATE_REQUEST: Static<typeof AuthRotateRequest> = {
  request_id,
  op: "auth_rotate",
  to_instance: instance,
  refresh_token: REFRESH.value,
  reason: "reconnect",
  ip: "203.0.113.7",
  user_agent: "Mozilla/5.0",
};

export const AUTH_ROTATE_RESPONSE: Static<typeof AuthRotateResponse> = {
  ok: true,
  request_id,
  sub: SUBJECT,
  access: ACCESS,
  refresh: REFRESH,
};
