import type { TSchema } from "@sinclair/typebox";
import { describe, expect, test } from "bun:test";
import { OP_NAMES, opErrors } from "../src/attributes.ts";
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
  UserId,
  REGISTER_TTL_MS,
} from "../src/common/auth.ts";
import {
  HelloInstanceRequest,
  HelloSessionRequest,
  HelloSessionResponse,
  HelloUserRequest,
} from "../src/common/hello.ts";
import { Endpoint, InstanceId, Origin } from "../src/identifiers.ts";
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
import { ERROR_CODES } from "../src/errors.ts";
import {
  AUTH_CHALLENGE_ENROLL_REQUEST,
  AUTH_RECORDS_FAMILY_FRAME,
  AUTH_RECORDS_TOMBSTONE_FRAME,
  AUTH_REGISTER_REQUEST,
  AUTH_RESOLVE_ADD_OWNER_RESPONSE,
  AUTH_RESOLVE_ALIVE_REQUEST,
  AUTH_RESOLVE_ALIVE_RESPONSE,
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
  FILE_READ_BEYOND_END_REQUEST,
  FILE_READ_BEYOND_END_RESPONSE,
  FILE_READ_BINARY_REQUEST,
  FILE_READ_BINARY_RESPONSE,
  FILE_READ_PAST_END_REQUEST,
  FILE_READ_PAST_END_RESPONSE,
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
    [
      "asking whether an enrolment URL is still good",
      AuthResolveRequest,
      AUTH_RESOLVE_ALIVE_REQUEST,
    ],
    ["what asking that answers", OP_SCHEMAS["auth.resolve"].response, AUTH_RESOLVE_ALIVE_RESPONSE],
    [
      "a challenge asked for by a page opened from an enrolment URL",
      OP_SCHEMAS["auth.challenge"].request,
      AUTH_CHALLENGE_ENROLL_REQUEST,
    ],
    ["a forwarded send", MessageSendRequest, MESSAGE_SEND_FORWARDED_REQUEST],
    ["a send nobody took", MessageSendResponse, MESSAGE_SEND_HELD_RESPONSE],
    ["messages that have left an inbox", InboxFrame, INBOX_REMOVED_FRAME],
    ["a transcript's opening frame", TOPIC_SCHEMAS.transcript, TRANSCRIPT_SIZE_FRAME],
    ["a token family", AuthRecordsFrame, AUTH_RECORDS_FAMILY_FRAME],
    ["a removal", AuthRecordsFrame, AUTH_RECORDS_TOMBSTONE_FRAME],
    [
      "a range of a file that reads as binary",
      OP_SCHEMAS["file.read"].request,
      FILE_READ_BINARY_REQUEST,
    ],
    ["the bytes it answers", OP_SCHEMAS["file.read"].response, FILE_READ_BINARY_RESPONSE],
    ["a range that runs past the end", OP_SCHEMAS["file.read"].request, FILE_READ_PAST_END_REQUEST],
    ["the part that overlaps", OP_SCHEMAS["file.read"].response, FILE_READ_PAST_END_RESPONSE],
    ["a range wholly past the end", OP_SCHEMAS["file.read"].request, FILE_READ_BEYOND_END_REQUEST],
    ["the nothing it answers", OP_SCHEMAS["file.read"].response, FILE_READ_BEYOND_END_RESPONSE],
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

  test("a sign-out names the family with the cookie and nothing in the body", () => {
    // Stating the token would be a shape only a caller that had read it could
    // fill, and the reply carries no body because what it is for — the family
    // revoked, the cookie expired — happens beside it.
    const { request_id: _id, op: _op, ...args } = OP_FIXTURES["auth.signout"].request;
    expect(args).toEqual({});
    const { ok: _ok, request_id: _rid, ...body } = OP_FIXTURES["auth.signout"].response;
    expect(body).toEqual({});
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
    for (const { body } of credentialRecords()) expect(body).not.toHaveProperty("endpoint");
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
    // What multiplies the credentials is the origins, never the instances: the
    // fixtures own more instances than that person has passkeys, and the
    // passkeys are one per origin exactly.
    const credentials = credentialRecords().filter((r) => r.body.user === FIXTURE_IDS.user);
    expect(new Set(credentials.map((r) => r.body.origin)).size).toBe(credentials.length);
    expect(credentials.length).toBeLessThan(
      owned.length * new Set(credentials.map((r) => r.body.origin)).size,
    );
  });

  test("a granting may be of a peer rather than of the instance that holds it", () => {
    // Being made an owner of every instance at once is the ordinary case, and
    // it cannot mean going to each machine in turn. What replicates is a
    // record, and the frame carrying one need not be the granted instance's.
    const frame = TOPIC_FIXTURES["auth.records"];
    expect(frame.instance).toBe(INSTANCE);
    expect(ownershipRecords().map((record) => record.body.instance)).toContain(OTHER_INSTANCE);
  });

  test("who put a granting there is a person or an instance, and says which", () => {
    // The first granting of every instance is made from a terminal, where
    // there is no person to name — so a field that could only hold a user id
    // would be empty in exactly the place a list is first read.
    const authors = ownershipRecords().map((record) => record.body.granted_by);
    expect(authors.map((by) => by?.kind).sort()).toEqual(["instance", "user", "user"]);
    for (const by of authors) {
      if (by?.kind === "instance") expect(isValid(InstanceId, by.instance)).toBe(true);
      if (by?.kind === "user") expect(isValid(UserId, by.user)).toBe(true);
    }
    // A bare id says neither which of the two it is nor which field to read.
    const record = ownershipRecords()[0];
    expect(
      isValid(AuthRecordsFrame, frameOf(record, { ...record.body, granted_by: FIXTURE_IDS.user })),
    ).toBe(false);
    expect(
      isValid(
        AuthRecordsFrame,
        frameOf(record, { ...record.body, granted_by: { kind: "user", instance: INSTANCE } }),
      ),
    ).toBe(false);
  });

  test("one instance may be owned by more than one person", () => {
    const owners = ownershipRecords().filter(
      (record) => record.body.instance === FIXTURE_IDS.other_instance,
    );
    expect(new Set(owners.map((record) => record.body.user)).size).toBe(2);
  });

  test("an ownership is keyed by the instance, the person and the granting", () => {
    for (const record of ownershipRecords()) {
      expect(record.key).toBe(
        `ownership/${record.body.instance}/${record.body.user}/${record.body.grant}`,
      );
      expect(record.body).not.toHaveProperty("endpoint");
    }
  });

  test("an instance given up can be taken again, the granting being what is keyed", () => {
    // A tombstone refuses every later write to its key and is kept without end.
    // Were the key the pair alone, the first removal would be final and nothing
    // could undo it — so what a removal ends is one granting.
    const records = AUTH_RECORDS_TOMBSTONE_FRAME.data.records;
    const removed = records.find((record) => record.key.startsWith("ownership/"));
    const regranted = records.find(
      (record) => record.body.kind === "ownership" && record.key.startsWith("ownership/"),
    );
    expect(removed?.body.kind).toBe("tombstone");
    expect(regranted?.body.kind).toBe("ownership");
    const pair = (key: string) => key.split("/").slice(0, 3).join("/");
    expect(pair(regranted!.key)).toBe(pair(removed!.key));
    expect(regranted!.key).not.toBe(removed!.key);
    expect(regranted!.updated_at).toBeGreaterThan(removed!.updated_at);
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

  test("a user id is sixteen bytes and has one spelling", () => {
    // The identity's canonical form: twenty-two base64url characters, the last
    // carrying the four bits with nowhere to go. A record keyed by anything
    // else is a person no assertion could find, the authenticator answering
    // with the bytes it was given.
    for (const id of [FIXTURE_IDS.user, FIXTURE_IDS.other_user]) {
      expect(isValid(UserId, id)).toBe(true);
      expect(id).toHaveLength(22);
    }
    for (const id of [
      // Fifteen bytes and seventeen bytes.
      "d2hvLWlzLXRoaXMtdXNlc",
      "d2hvLWlzLXRoaXMtdXNlcgg",
      // Eighteen bytes: base64url, and past what this contract issues.
      "d2hvLWlzLXRoaXMtcGVyc29u",
      // Sixty-five characters, which no user handle may be.
      "a".repeat(65),
      // A second spelling of the same sixteen bytes: the unused bits set.
      "d2hvLWlzLXRoaXMtdXNlch",
      // Not base64url at all, and the empty string.
      "who-is-this-user!!!!!!",
      "",
    ]) {
      expect(isValid(UserId, id)).toBe(false);
    }
  });

  test("a user id that is not the canonical form is refused wherever it stands", () => {
    // Not only on the user record: the same value keys a credential, an
    // ownership and a family, and answers an assertion.
    const record = credentialRecords()[0];
    expect(
      isValid(AuthRecordsFrame, frameOf(record, { ...record.body, user: "not-base64url!" })),
    ).toBe(false);
    const request = OP_FIXTURES["auth.assert"].request;
    expect(
      isValid(AuthAssertRequest, {
        ...request,
        credential: { ...request.credential, user_handle: "d2hvLWlzLXRoaXMtdXNlc" },
      }),
    ).toBe(false);
  });

  test("the two purposes carry different claims, and no other combination passes", () => {
    // The correlation is the claim. A schema that took either field with
    // either purpose would leave the issuing and the receiving instance free
    // to read one URL two ways.
    const { user: _dropped, ...withoutUser } = AUTH_RESOLVE_RESPONSE.claims;
    const withUser = AUTH_RESOLVE_ADD_OWNER_RESPONSE.claims;
    expect(isValid(AuthResolveResponse, AUTH_RESOLVE_RESPONSE)).toBe(true);
    expect(isValid(AuthResolveResponse, AUTH_RESOLVE_ADD_OWNER_RESPONSE)).toBe(true);
    // create_user without the handle it settles.
    expect(isValid(AuthResolveResponse, { ...AUTH_RESOLVE_RESPONSE, claims: withoutUser })).toBe(
      false,
    );
    // add_owner naming somebody the assertion has not named yet.
    expect(
      isValid(AuthResolveResponse, {
        ...AUTH_RESOLVE_ADD_OWNER_RESPONSE,
        claims: { ...withUser, user: FIXTURE_IDS.user },
      }),
    ).toBe(false);
  });

  test("an origin has to be somewhere a ceremony could be held", () => {
    // The authenticator's conditions rather than this contract's taste: a
    // secure context, and a relying party that is a domain. An endpoint is
    // neither a page nor a relying party, so it is held to none of it.
    for (const origin of [
      "http://example.com",
      "http://ui.example.ts.net",
      "https://192.0.2.1",
      "https://198.51.100.9:8443",
      "https://[::1]",
      "http://127.0.0.2",
    ]) {
      expect(isValid(Origin, origin)).toBe(false);
    }
    // The development exception, and only on the loopback names.
    for (const origin of ["http://localhost", "http://localhost:5173", "http://[::1]:8080"]) {
      expect(isValid(Origin, origin)).toBe(true);
    }
    for (const origin of ["https://xn--r8jz45g.xn--zckzah", "https://ui.example.test:8443"]) {
      expect(isValid(Origin, origin)).toBe(true);
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

  test("the name a person is called travels apart from the note about who the URL was for", () => {
    // The page has to name the account before anything is created and has no
    // other way to learn it, so the URL carries a starting point; the person in
    // front of the browser is who settles it, and that is what `auth.register`
    // sends back. The administrator's note about who the URL was handed to is a
    // different thing and stays one — a single value would show an operator's
    // private memo to the person as their own name.
    expect(AUTH_RESOLVE_RESPONSE.claims.display_name).toBe("kawaz");
    expect(AUTH_RESOLVE_RESPONSE.claims.issued_label).toBe("for kawaz");
    expect(AUTH_REGISTER_REQUEST.display_name).toBe("kawaz");
    // Both are optional: a URL made without a name is answered by whatever the
    // instance calls a person it was told nothing about.
    const { display_name: _dropped, ...unnamed } = AUTH_RESOLVE_RESPONSE.claims;
    expect(isValid(AuthResolveResponse, { ...AUTH_RESOLVE_RESPONSE, claims: unnamed })).toBe(true);
    const { display_name: _unsaid, ...silent } = AUTH_REGISTER_REQUEST;
    expect(isValid(AuthRegisterRequest, silent)).toBe(true);
    // A name is a string a person reads, not an id: nothing here is keyed by it.
    expect(
      isValid(AuthRegisterRequest, { ...AUTH_REGISTER_REQUEST, display_name: "x".repeat(129) }),
    ).toBe(false);
  });

  test("the URL names every instance it hands over, and both purposes may", () => {
    // The set is decided at the terminal that made the URL and travels with it,
    // because behind a load balancer the ceremony lands wherever it lands — an
    // instance writing the grantings it happened to know of would answer a
    // different question than the one that was asked. Carried by an addition as
    // well as by a creation: both hand instances over, and only who arrives
    // differs.
    expect(AUTH_RESOLVE_RESPONSE.claims.instances).toEqual([
      FIXTURE_IDS.instance,
      FIXTURE_IDS.other_instance,
    ]);
    expect(AUTH_RESOLVE_ADD_OWNER_RESPONSE.claims.instances).toEqual([FIXTURE_IDS.other_instance]);
    // Absent is the issuer's own instance alone, which `instance` already says.
    const { instances: _dropped, ...withoutInstances } = AUTH_RESOLVE_RESPONSE.claims;
    expect(
      isValid(AuthResolveResponse, { ...AUTH_RESOLVE_RESPONSE, claims: withoutInstances }),
    ).toBe(true);
    // Instance ids, not endpoints: a granting names the instance, and an
    // address is not one (DR-0018).
    expect(
      isValid(AuthResolveResponse, {
        ...AUTH_RESOLVE_RESPONSE,
        claims: { ...AUTH_RESOLVE_RESPONSE.claims, instances: [FIXTURE_IDS.hosting_endpoint] },
      }),
    ).toBe(false);
  });

  test("a removal says when and nothing else — its key says what", () => {
    const tombstones = AUTH_RECORDS_TOMBSTONE_FRAME.data.records.filter(
      (record) => record.body.kind === "tombstone",
    );
    for (const record of tombstones) {
      expect(Object.keys(record.body).sort()).not.toContain("user");
      expect(Object.keys(record.body).sort()).not.toContain("sub");
    }
    // A credential's and an ownership's are kept without end; a family's is
    // dropped once no refresh token could still arrive.
    const kept = tombstones.filter((record) => !("expires_at" in record.body));
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

  test("letting go names what is removed and never whose it is", () => {
    // The caller is who the connection settled, so an op that took a user
    // would be a shape for removing somebody else's.
    const ownership = OP_FIXTURES["auth.ownership.remove"].request;
    const credential = OP_FIXTURES["auth.credential.remove"].request;
    expect(Object.keys(ownership).sort()).toEqual(["instance", "op", "request_id"]);
    expect(Object.keys(credential).sort()).toEqual(["credential_id", "op", "request_id"]);
    for (const request of [ownership, credential]) expect(request).not.toHaveProperty("user");
  });

  test("removing what the call is being made with is refused by a code of its own", () => {
    for (const op of ["auth.ownership.remove", "auth.credential.remove"] as const) {
      expect(opErrors(op)).toContain("auth_in_use");
      // Not a question of standing: it is the caller's to remove from anywhere
      // else, so this is apart from `forbidden`.
      expect(ERROR_CODES).toContain("auth_in_use");
    }
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

  test("a challenge is asked for with nothing, or with the URL being answered", () => {
    // The token is what a page opened from an enrolment URL adds, and its
    // absence is the ordinary sign-in rather than a field left out.
    const { request_id: _id, op: _op, ...args } = OP_FIXTURES["auth.challenge"].request;
    expect(args).toEqual({});
    expect(isValid(OP_SCHEMAS["auth.challenge"].request, AUTH_CHALLENGE_ENROLL_REQUEST)).toBe(true);
  });

  test("asking whether an enrolment URL is still good states the token and nothing else", () => {
    // No digits: nothing here is authorized by them, and an attempt counted
    // against the URL for a question that spends nothing would let a page
    // exhaust an enrolment by being opened.
    const { token: _dropped, ...rest } = AUTH_RESOLVE_ALIVE_REQUEST;
    expect(isValid(AuthResolveRequest, rest)).toBe(false);
    expect(AUTH_RESOLVE_ALIVE_REQUEST).not.toHaveProperty("code");
    // And its answer carries nothing: what was asked is answered by the call
    // not having been refused.
    const { ok: _ok, request_id: _rid, kind: _kind, ...body } = AUTH_RESOLVE_ALIVE_RESPONSE;
    expect(body).toEqual({});
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
