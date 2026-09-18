import type { Static } from "@sinclair/typebox";
import type {
  AuthAssertRequest,
  AuthAssertResponse,
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthExtendRequest,
  AuthExtendResponse,
  AuthTokenRefreshRequest,
  AuthTokenRefreshResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResolveRequest,
  AuthResolveResponse,
  AuthAccountReadRequest,
  AuthAccountReadResponse,
  AuthCredentialRemoveRequest,
  AuthCredentialRemoveResponse,
  AuthOwnershipRemoveRequest,
  AuthOwnershipRemoveResponse,
  AuthEnrollRequest,
  AuthEnrollResponse,
} from "../common/auth.ts";
import type {
  HelloInstanceRequest,
  HelloSessionRequest,
  HelloSessionResponse,
  HelloUserRequest,
} from "../common/hello.ts";
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

const {
  sid,
  instance,
  other_instance,
  endpoint,
  other_endpoint,
  origin,
  same_site_origin,
  hosting_endpoint,
  user: USER,
  request_id,
} = FIXTURE_IDS;

export const HELLO_SESSION_REQUEST: Static<typeof HelloSessionRequest> = {
  request_id,
  op: "hello.session",
  protocol_version: 4,
  sid,
  pid: 4821,
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

/** A person greeting, which names neither a session nor a mesh claim. */
export const HELLO_USER_REQUEST: Static<typeof HelloUserRequest> = {
  request_id,
  op: "hello.user",
  protocol_version: 4,
  client_version: "0.1.0",
};

/** An instance greeting a peer, which carries the mesh claim in place of a
 * session's meta. */
export const HELLO_INSTANCE_REQUEST: Static<typeof HelloInstanceRequest> = {
  request_id,
  op: "hello.instance",
  protocol_version: 4,
  mesh: {
    ver: 1,
    iss: other_endpoint,
    aud: endpoint,
    id: other_instance,
    kid: "9f2c7a5e1b4d8036af51c9e27d604b18",
  },
};

/** One reply for all three greetings: what an instance answers does not turn
 * on which of them asked. */
export const HELLO_RESPONSE: Static<typeof HelloSessionResponse> = {
  ok: true,
  request_id,
  protocol_version: 4,
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
  op: "instance.ping",
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
  op: "instance.shutdown",
};

export const INSTANCE_SHUTDOWN_RESPONSE: Static<typeof InstanceShutdownResponse> = {
  ok: true,
  request_id,
};

export const SESSION_STOPPING_REQUEST: Static<typeof SessionStoppingRequest> = {
  request_id,
  op: "session.stopping",
  reason: "prompt_input_exit",
};

export const SESSION_STOPPING_RESPONSE: Static<typeof SessionStoppingResponse> = {
  ok: true,
  request_id,
  stopped_at: FIXTURE_NOW - 1_000_000,
};

export const TOPIC_SUBSCRIBE_REQUEST: Static<typeof TopicSubscribeRequest> = {
  request_id,
  op: "topic.subscribe",
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
  op: "topic.subscribe",
  topic: `transcript:${sid}`,
};

export const TOPIC_UNSUBSCRIBE_REQUEST: Static<typeof TopicUnsubscribeRequest> = {
  request_id,
  op: "topic.unsubscribe",
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
const ENROLL_TOKEN = "eyJhbGciOiJIUzI1NiJ9.e30.c2ln";
const ENROLL_CODE = "048213";
export const AUTH_CHALLENGE_REQUEST: Static<typeof AuthChallengeRequest> = {
  request_id,
  op: "auth.challenge",
};

export const AUTH_CHALLENGE_RESPONSE: Static<typeof AuthChallengeResponse> = {
  ok: true,
  request_id,
  ...CHALLENGE,
};

export const AUTH_REGISTER_REQUEST: Static<typeof AuthRegisterRequest> = {
  request_id,
  op: "auth.register",
  token: ENROLL_TOKEN,
  code: ENROLL_CODE,
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
  user: USER,
  access: ACCESS,
};

export const AUTH_ASSERT_REQUEST: Static<typeof AuthAssertRequest> = {
  request_id,
  op: "auth.assert",
  challenge: CHALLENGE,
  credential: {
    raw_id: "Y3JlZC1pZA",
    client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
    authenticator_data: "YXV0aC1kYXRh",
    signature: "c2lnbmF0dXJl",
    user_handle: USER,
  },
};

export const AUTH_ASSERT_RESPONSE: Static<typeof AuthAssertResponse> = {
  ok: true,
  request_id,
  user: USER,
  access: ACCESS,
};

/** Taking a second instance as one's own: the same token and digits a
 * registration carries, answered with the passkey that already exists. */
export const AUTH_ENROLL_REQUEST: Static<typeof AuthEnrollRequest> = {
  request_id,
  op: "auth.enroll",
  token: ENROLL_TOKEN,
  code: ENROLL_CODE,
  challenge: CHALLENGE,
  credential: {
    raw_id: "Y3JlZC1pZA",
    client_data_json: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
    authenticator_data: "YXV0aC1kYXRh",
    signature: "c2lnbmF0dXJl",
    user_handle: USER,
  },
};

export const AUTH_ENROLL_RESPONSE: Static<typeof AuthEnrollResponse> = {
  ok: true,
  request_id,
  user: USER,
  access: ACCESS,
};

export const AUTH_TOKEN_REFRESH_REQUEST: Static<typeof AuthTokenRefreshRequest> = {
  request_id,
  op: "auth.token.refresh",
  reason: "reload",
};

export const AUTH_TOKEN_REFRESH_RESPONSE: Static<typeof AuthTokenRefreshResponse> = {
  ok: true,
  request_id,
  user: USER,
  access: ACCESS,
};

export const AUTH_EXTEND_REQUEST: Static<typeof AuthExtendRequest> = {
  request_id,
  op: "auth.extend",
  access_token: ACCESS.value,
};

export const AUTH_EXTEND_RESPONSE: Static<typeof AuthExtendResponse> = {
  ok: true,
  request_id,
  auth_expires_at: FIXTURE_NOW + 20_000_000,
};

/** The three things a person has, read back at once: who they are, what answers
 * for them at each origin, and the instances they own. Two instances here, one
 * of them granted by nobody (they made it) and one added by an owner. */
export const AUTH_ACCOUNT_READ_REQUEST: Static<typeof AuthAccountReadRequest> = {
  request_id,
  op: "auth.account.read",
};

export const AUTH_ACCOUNT_READ_RESPONSE: Static<typeof AuthAccountReadResponse> = {
  ok: true,
  request_id,
  user: {
    kind: "user",
    user: USER,
    display_name: "kawaz",
    created_at: FIXTURE_NOW - 900_000,
  },
  credentials: [
    {
      kind: "credential",
      user: USER,
      credential_id: "Y3JlZC1pZA",
      origin,
      sign_count: 0,
      issued_label: "for kawaz",
      device_label: "work laptop",
      registered_at: FIXTURE_NOW - 600_000,
      registered_ip: "203.0.113.7",
      registered_user_agent: "Mozilla/5.0",
      last_used_at: FIXTURE_NOW,
      last_used_ip: "203.0.113.7",
      last_used_user_agent: "Mozilla/5.0",
    },
    {
      kind: "credential",
      user: USER,
      credential_id: "Y3JlZC1pZC0y",
      origin: same_site_origin,
      device_label: "phone",
      registered_at: FIXTURE_NOW - 300_000,
    },
  ],
  instances: [
    { instance, endpoint, granted_at: FIXTURE_NOW - 600_000 },
    {
      instance: other_instance,
      endpoint: other_endpoint,
      granted_at: FIXTURE_NOW - 60_000,
      granted_by: USER,
    },
  ],
};

/** Giving up an instance, named from another one the person owns — the
 * connection's own instance is the one call that is refused. */
export const AUTH_OWNERSHIP_REMOVE_REQUEST: Static<typeof AuthOwnershipRemoveRequest> = {
  request_id,
  op: "auth.ownership.remove",
  instance: other_instance,
};

export const AUTH_OWNERSHIP_REMOVE_RESPONSE: Static<typeof AuthOwnershipRemoveResponse> = {
  ok: true,
  request_id,
};

/** Removing a passkey that is not the one this session authenticated with. */
export const AUTH_CREDENTIAL_REMOVE_REQUEST: Static<typeof AuthCredentialRemoveRequest> = {
  request_id,
  op: "auth.credential.remove",
  credential_id: "Y3JlZC1pZC0y",
};

export const AUTH_CREDENTIAL_REMOVE_RESPONSE: Static<typeof AuthCredentialRemoveResponse> = {
  ok: true,
  request_id,
};

export const AUTH_RESOLVE_REQUEST = {
  request_id,
  op: "auth.resolve",
  to_instance: instance,
  kind: "claims",
  token: ENROLL_TOKEN,
  code: ENROLL_CODE,
} satisfies Static<typeof AuthResolveRequest>;

/** What the issuer answers about a URL that makes a person. It names the user
 * the credential will be created against, and posts to the address in front of
 * the instances rather than to the issuer's own — whichever of them the answer
 * lands on completes it. */
export const AUTH_RESOLVE_RESPONSE = {
  ok: true,
  request_id,
  kind: "claims",
  claims: {
    iss: instance,
    purpose: "create_user",
    instance,
    origin,
    endpoint: hosting_endpoint,
    expires_at: FIXTURE_NOW + 600_000,
    jti: "01J9Z3W2Q",
    user: USER,
    issued_label: "for kawaz",
  },
} satisfies Static<typeof AuthResolveResponse>;

/** The other purpose: a URL that adds an instance to whoever asserts. It names
 * no user — who arrives is what the assertion says. */
export const AUTH_RESOLVE_ADD_OWNER_RESPONSE = {
  ok: true,
  request_id,
  kind: "claims",
  claims: {
    iss: other_instance,
    purpose: "add_owner",
    instance: other_instance,
    origin,
    endpoint: hosting_endpoint,
    expires_at: FIXTURE_NOW + 600_000,
    jti: "01J9Z3W2R",
    issued_label: "nuc, for kawaz",
  },
} satisfies Static<typeof AuthResolveResponse>;

/** The other half of the resolve union: spending a challenge, which answers
 * nothing beyond having spent it. */
export const AUTH_RESOLVE_CHALLENGE_REQUEST = {
  request_id,
  op: "auth.resolve",
  to_instance: instance,
  kind: "challenge",
  challenge: CHALLENGE.challenge,
} satisfies Static<typeof AuthResolveRequest>;

export const AUTH_RESOLVE_CHALLENGE_RESPONSE = {
  ok: true,
  request_id,
  kind: "challenge",
} satisfies Static<typeof AuthResolveResponse>;
