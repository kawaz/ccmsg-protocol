import type { TSchema } from "@sinclair/typebox";
import { describe, expect, test } from "bun:test";
import { OP_NAMES } from "../src/attributes.ts";
import {
  AUTH_CHALLENGE_TTL_MS,
  AuthAssertRequest,
  AuthChallengeResponse,
  AuthRecordsFrame,
  AuthEnrollRequest,
  AuthRegisterRequest,
  AuthResolveRequest,
  AuthResolveResponse,
  FAMILY_TOMBSTONE_RETENTION_MS,
  REGISTER_TTL_MS,
} from "../src/common/auth.ts";
import {
  HelloInstanceRequest,
  HelloSessionRequest,
  HelloSessionResponse,
  HelloUserRequest,
} from "../src/common/hello.ts";
import { Endpoint, Origin } from "../src/identifiers.ts";
import { InstancePingResponse } from "../src/common/ping.ts";
import { SessionStoppingRequest, SessionStoppingResponse } from "../src/common/shutdown.ts";
import { TopicSubscribeRequest, TopicUnsubscribeRequest } from "../src/common/topics.ts";
import { InstancesFrame } from "../src/control/instances.ts";
import {
  LAST_LIVE_RETENTION_MS,
  liveness,
  type PeerInfo,
  PeersFrame,
} from "../src/control/peers.ts";
import { ErrorResponse, MAX_FRAME_BYTES } from "../src/envelope.ts";
import {
  AUTH_RECORDS_FAMILY_FRAME,
  AUTH_RECORDS_TOMBSTONE_FRAME,
  AUTH_RESOLVE_ADD_OWNER_RESPONSE,
  AUTH_RESOLVE_CHALLENGE_REQUEST,
  AUTH_RESOLVE_CHALLENGE_RESPONSE,
  AUTH_RESOLVE_RESPONSE,
  ERROR_RESPONSE,
  ERROR_RESPONSE_UNIDENTIFIED,
  FIXTURE_IDS,
  FIXTURE_NOW,
  HELLO_INSTANCE_REQUEST,
  HELLO_USER_REQUEST,
  INBOX_REMOVED_FRAME,
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

const {
  sid: SID,
  instance: INSTANCE,
  other_instance: OTHER_INSTANCE,
  endpoint: INSTANCE_ENDPOINT,
} = FIXTURE_IDS;

/** The credential records of the replicated set, in the order they are written.
 * The set holds several kinds now, so a fixture that is about credentials picks
 * them out rather than indexing into the whole. */
function credentialRecords() {
  return TOPIC_FIXTURES["auth.records"].data.records.flatMap((record) =>
    record.body.kind === "credential" ? [{ ...record, body: record.body }] : [],
  );
}

function ownershipRecords() {
  return TOPIC_FIXTURES["auth.records"].data.records.flatMap((record) =>
    record.body.kind === "ownership" ? [{ ...record, body: record.body }] : [],
  );
}

/** The replicated set's frame carrying one record, for a check that one field
 * is what makes a record valid. */
function frameOf(record: { key: string; updated_at: number }, body: unknown) {
  return { ...TOPIC_FIXTURES["auth.records"], data: { records: [{ ...record, body }] } };
}

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
    ["messages that have left an inbox", InboxFrame, INBOX_REMOVED_FRAME],
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
    expect(isValid(PeersFrame, { ...peersFrame, data: { peers: [rest] } })).toBe(true);
    expect(liveness({ ...rest }, FIXTURE_NOW)).toBe("disappeared");
  });

  test("a lost session is a row of the same list, matched by the same pair", () => {
    // What moves it there are its own fields, so a client that already holds
    // the row updates it rather than moving it between two lists.
    expect(lost.runs).toEqual([]);
    expect(liveness(lost, FIXTURE_NOW)).toBe("paused");
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

  test("an entry that states no runs at all is refused", () => {
    // Empty is how a row says nothing is running it; absent would leave a
    // reader unable to tell that from an instance that did not look.
    const { runs: _dropped, ...rest } = peer;
    expect(isValid(PeersFrame, { ...peersFrame, data: { peers: [rest] } })).toBe(false);
  });

  test("a standing for the fold outside the list is refused", () => {
    expect(
      isValid(PeersFrame, {
        ...peersFrame,
        data: { peers: [{ ...peer, session_status: "stale" }] },
      }),
    ).toBe(false);
  });

  test("a busy session carries when inference last ran, not a flag", () => {
    // Busy is an attribute of the row: the session is running and busy at once,
    // and a client reads recency against its own threshold.
    expect(isValid(PeersFrame, peersFrame)).toBe(true);
    expect(liveness(peer, FIXTURE_NOW)).toBe("alive");
    expect(typeof peer.gateway_active_at).toBe("number");
  });

  test("two runs of one session freeze its fold and are told apart by their pids", () => {
    const [duplicated] = PEERS_CHANGE_FRAME.data.peers;
    if ("removed" in duplicated) throw new Error("the first changed row is a row, not a removal");
    expect(duplicated.runs.map((run) => run.pid)).toEqual([4821, 9022]);
    expect(duplicated.session_status).toBe("frozen");
    expect(liveness(duplicated, FIXTURE_NOW)).toBe("duplicated");
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

  test("an enrolment answered by an assertion still carries the typed code", () => {
    // What the assertion proves is who is here; what the digits prove is that
    // they asked for this instance. Neither stands in for the other.
    const { code: _dropped, ...rest } = OP_FIXTURES["auth.enroll"].request;
    expect(isValid(AuthEnrollRequest, rest)).toBe(false);
  });

  test("an enrolment names no device — no credential is made by it", () => {
    expect(OP_FIXTURES["auth.enroll"].request).not.toHaveProperty("device_label");
  });

  test("a credential names the one origin it may be used at, and cannot leave it out", () => {
    const record = credentialRecords()[0];
    const { origin: _dropped, ...body } = record.body;
    expect(isValid(AuthRecordsFrame, { ...frameOf(record, body) })).toBe(false);
  });

  test("a credential says nothing about which instance its holder may enter", () => {
    // The whole of this decision: an endpoint appears nowhere on a credential,
    // and being admitted is what the ownership records answer.
    for (const { body } of credentialRecords()) {
      expect(body).not.toHaveProperty("endpoint");
      expect(body).not.toHaveProperty("webui");
      expect(body).not.toHaveProperty("rp_id");
      expect(body).not.toHaveProperty("user_handle");
    }
    expect(AUTH_RESOLVE_RESPONSE.claims).not.toHaveProperty("rp_id");
  });

  test("the two credentials differ in whether their origin is the endpoints' site", () => {
    // What decides the shape of the refresh cookie, so the fixtures carry one
    // of each: an origin that shares the endpoints' registrable domain, and one
    // that does not.
    const [crossSite, sameSite] = credentialRecords();
    // The endpoints are published under one registrable domain; an origin is on
    // their site when its host ends there. (Spelled out rather than computed:
    // the rule is the public suffix list, which this contract does not carry.)
    const endpointSite = "example.ts.net";
    expect(new URL(INSTANCE_ENDPOINT).host.endsWith(`.${endpointSite}`)).toBe(true);
    expect(new URL(crossSite.body.origin).host.endsWith(`.${endpointSite}`)).toBe(false);
    expect(new URL(sameSite.body.origin).host.endsWith(`.${endpointSite}`)).toBe(true);
    expect(crossSite.body.credential_id).not.toBe(sameSite.body.credential_id);
  });

  test("an origin is a scheme and an authority, and a base URL is not one", () => {
    const record = credentialRecords()[0];
    for (const origin of [
      // A path, a trailing slash, a query, a fragment: none of them is anything
      // a browser writes into an `Origin` header.
      "https://ui.example.test/",
      "https://ui.example.test/ccmsg/",
      "https://ui.example.test?x=1",
      "https://ui.example.test#top",
      "wss://ui.example.test",
      // A second spelling of one site is a record that never matches it.
      "https://UI.EXAMPLE.TEST",
      "https://ui.example.test:443",
      "http://ui.example.test:80",
      "https://user@ui.example.test",
      "https://ui.example.test:99999",
      "https://-bad.example",
      "https://a..example",
    ]) {
      expect(isValid(Origin, origin)).toBe(false);
      expect(isValid(AuthRecordsFrame, frameOf(record, { ...record.body, origin }))).toBe(false);
    }
  });

  test("every origin the fixtures name is one the schema takes", () => {
    for (const origin of [FIXTURE_IDS.origin, FIXTURE_IDS.same_site_origin]) {
      expect(isValid(Origin, origin)).toBe(true);
      // An endpoint is a base URL and an origin is not: neither type takes the
      // other's values, which is why neither is read off the other.
      expect(isValid(Endpoint, origin)).toBe(false);
    }
    expect(isValid(Origin, INSTANCE_ENDPOINT)).toBe(false);
  });

  test("a person is one user however many instances they own", () => {
    const owned = ownershipRecords().filter((record) => record.body.user === FIXTURE_IDS.user);
    expect(owned.length).toBeGreaterThan(1);
    expect(new Set(owned.map((record) => record.body.instance)).size).toBe(owned.length);
    // And one credential per origin, not per instance.
    expect(credentialRecords().length).toBeLessThan(owned.length * credentialRecords().length + 1);
    for (const { body } of credentialRecords()) expect(body.user).toBe(FIXTURE_IDS.user);
  });

  test("one instance may be owned by more than one person", () => {
    const owners = ownershipRecords().filter(
      (record) => record.body.instance === FIXTURE_IDS.other_instance,
    );
    expect(new Set(owners.map((record) => record.body.user)).size).toBe(2);
  });

  test("an ownership is keyed by the instance and the person, and says nothing more", () => {
    for (const record of ownershipRecords()) {
      expect(record.key).toBe(`ownership/${record.body.instance}/${record.body.user}`);
      expect(record.body).not.toHaveProperty("endpoint");
    }
  });

  test("a token family states the origin its connections are held to", () => {
    const [record] = AUTH_RECORDS_FAMILY_FRAME.data.records;
    const { origin: _dropped, ...body } = record.body;
    expect(
      isValid(AuthRecordsFrame, {
        ...AUTH_RECORDS_FAMILY_FRAME,
        data: { records: [{ ...record, body }] },
      }),
    ).toBe(false);
  });

  test("a family names the person, never a subject an instance made up", () => {
    const [record] = AUTH_RECORDS_FAMILY_FRAME.data.records;
    expect(record.body.user).toBe(FIXTURE_IDS.user);
    expect(record.body).not.toHaveProperty("sub");
  });

  test("an enrolment URL names where the person goes and where the page posts", () => {
    for (const field of ["origin", "endpoint", "purpose", "instance"] as const) {
      const { [field]: _dropped, ...claims } = AUTH_RESOLVE_RESPONSE.claims;
      expect(isValid(AuthResolveResponse, { ...AUTH_RESOLVE_RESPONSE, claims })).toBe(false);
    }
  });

  test("the address a URL posts to is nobody's own — it is never compared", () => {
    // The fixtures send both purposes to the address in front of the instances,
    // which is not the issuer's endpoint. Whichever instance behind it receives
    // the answer completes the enrolment.
    for (const response of [AUTH_RESOLVE_RESPONSE, AUTH_RESOLVE_ADD_OWNER_RESPONSE]) {
      expect(response.claims.endpoint).toBe(FIXTURE_IDS.hosting_endpoint);
      expect(response.claims.endpoint).not.toBe(INSTANCE_ENDPOINT);
      expect(isValid(AuthResolveResponse, response)).toBe(true);
    }
  });

  test("only the URL that makes a person names one", () => {
    // A creation settles the user handle before the authenticator ever sees it;
    // an addition learns who arrived from the assertion, so naming anyone up
    // front would be a claim the ceremony was not held to.
    expect(AUTH_RESOLVE_RESPONSE.claims.purpose).toBe("create_user");
    expect(AUTH_RESOLVE_RESPONSE.claims.user).toBe(FIXTURE_IDS.user);
    expect(AUTH_RESOLVE_ADD_OWNER_RESPONSE.claims.purpose).toBe("add_owner");
    expect(AUTH_RESOLVE_ADD_OWNER_RESPONSE.claims).not.toHaveProperty("user");
  });

  test("a removal says when and nothing else — its key says what", () => {
    for (const record of AUTH_RECORDS_TOMBSTONE_FRAME.data.records) {
      expect(record.body.kind).toBe("tombstone");
      expect(record.body).not.toHaveProperty("sub");
      expect(record.body).not.toHaveProperty("user");
    }
    // A credential's and an ownership's are kept without end; a family's is
    // dropped once no refresh token could still arrive.
    const kept = AUTH_RECORDS_TOMBSTONE_FRAME.data.records.filter(
      (record) => !("expires_at" in record.body),
    );
    expect(kept.map((record) => record.key.split("/")[0])).toEqual(["credential", "ownership"]);
  });

  test("an account is read back as the person, their passkeys and their instances", () => {
    const reply = OP_FIXTURES["auth.account.read"].response;
    expect(reply.user.user).toBe(FIXTURE_IDS.user);
    // The public keys are how an assertion is checked and are no part of this.
    for (const credential of reply.credentials) {
      expect(credential).not.toHaveProperty("public_key");
      expect(credential.user).toBe(FIXTURE_IDS.user);
    }
    expect(reply.instances.map((entry) => entry.instance)).toEqual([INSTANCE, OTHER_INSTANCE]);
  });

  test("rotating a family is not an op — every owned instance writes it", () => {
    expect(OP_NAMES).not.toContain("auth.rotate");
    expect(OP_NAMES).toContain("auth.enroll");
    expect(OP_NAMES).toContain("auth.account.read");
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
          records: [{ key: "k", updated_at: 1, body: { kind: "password", user: "x" } }],
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
    const senders = TOPIC_FIXTURES.inbox.data.flatMap((element) =>
      "removed" in element ? [] : [element.from],
    );
    expect(senders).toContain("user");
  });

  test("a message that left the inbox names the mid it is matched by, and why", () => {
    const [delivered] = INBOX_REMOVED_FRAME.data;
    expect(delivered).toEqual({ mid: delivered.mid, removed: true, reason: "delivered" });
  });

  test("a removal without its reason is refused — waiting and abandoned would look alike", () => {
    const [{ mid }] = INBOX_REMOVED_FRAME.data;
    expect(isValid(InboxFrame, { ...INBOX_REMOVED_FRAME, data: [{ mid, removed: true }] })).toBe(
      false,
    );
  });

  test("a removal that is not marked is refused — an absence would say nothing", () => {
    const [{ mid }] = INBOX_REMOVED_FRAME.data;
    expect(
      isValid(InboxFrame, { ...INBOX_REMOVED_FRAME, data: [{ mid, reason: "delivered" }] }),
    ).toBe(false);
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
