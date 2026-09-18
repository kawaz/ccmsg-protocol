import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { Endpoint, InstanceId, Origin, Timestamp } from "../identifiers.ts";

/** A value that is nothing but bytes to everyone who handles it: a token, a
 * challenge, a credential id, a signature. Spelled base64url without padding so
 * one encoding covers the values this contract issues and the ones the browser
 * hands over, and so a value survives a URL, a header and a cookie unaltered. */
export const Base64Url = Type.String({
  $id: "Base64Url",
  minLength: 1,
  pattern: "^[A-Za-z0-9_-]+$",
});
export type Base64Url = Static<typeof Base64Url>;

/** Who a person is: sixteen random bytes the instance that registered them
 * settled on once, and never anything else after.
 *
 * This is the WebAuthn user handle itself rather than a name derived beside it.
 * The same value keys the person's records, is stored in the authenticator, and
 * comes back as an assertion's `user_handle` — one spelling, because every use
 * of it is a string comparison and a second copy of one fact is only a thing
 * that can disagree. Two values for one person would be two accounts in their
 * authenticator, which no instance could reach in to merge.
 *
 * It names a person and nothing about where they connected. An instance, an
 * endpoint and a mesh are all things a person may have or reach, and none of
 * them is who they are.
 *
 * Sixteen bytes is stated by the pattern rather than left to the issuer, this
 * being the one canonical form of an identity: twenty-two base64url characters,
 * whose last one carries the four bits that have nowhere to go and so is one of
 * `A`, `Q`, `g`, `w`. Anything else is either a different length or a second
 * spelling of the same bytes, and a record keyed by one of those would be a
 * person no assertion could ever find — the authenticator answers with the
 * bytes it was given, and every comparison here is of the string. */
export const UserId = Type.String({
  $id: "UserId",
  pattern: "^[A-Za-z0-9_-]{21}[AQgw]$",
});
export type UserId = Static<typeof UserId>;

/** How long a challenge is good for. Short because a challenge is consumed
 * within one interaction at a keyboard; the window is only what covers the
 * person reaching for their authenticator. */
export const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** How long a registration URL is good for. Longer than a challenge: the
 * person has to carry the URL from a terminal to a browser first. */
export const REGISTER_TTL_MS = 10 * 60 * 1000;

/** How long a token family's tombstone is kept. A family expires on its own
 * with the refresh token, so the mark only has to outlive the longest one.
 *
 * A credential's tombstone has no counterpart here on purpose: it is kept
 * without end, because a peer returning from a partition longer than any
 * retention would otherwise carry the removed credential back as news. The same
 * holds of an ownership's — a granting brought back would be an instance
 * someone was let into again. Neither is a door closed for good: a credential id
 * and a granting's id are both new every time, so registering again and being
 * made an owner again write keys no tombstone stands on. */
export const FAMILY_TOMBSTONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// --- challenge -------------------------------------------------------------

export const AuthChallengeArgs = Type.Object({});
export type AuthChallengeArgs = Static<typeof AuthChallengeArgs>;

/** A challenge and who issued it.
 *
 * The issuer travels beside the value rather than inside it because the
 * instance that receives the answer is not necessarily the one that issued it:
 * behind a load balancer either may be reached, so the receiver reads the
 * issuer, asks it to consume the challenge (`auth.resolve`), and verifies the
 * assertion itself. An issuer a caller made up names an instance that knows no
 * such challenge, which is a refusal and not a way in. */
export const AuthChallenge = Type.Object(
  {
    /** At least 16 bytes of randomness, good once. */
    challenge: Base64Url,
    /** The instance holding it, which alone can consume it. */
    issuer: InstanceId,
    expires_at: Timestamp,
  },
  { $id: "AuthChallenge" },
);
export type AuthChallenge = Static<typeof AuthChallenge>;

export const AuthChallengeResult = AuthChallenge;
export type AuthChallengeResult = Static<typeof AuthChallengeResult>;

export const AuthChallengeRequest = request("auth.challenge", AuthChallengeArgs);
export const AuthChallengeResponse = response("auth.challenge", AuthChallengeResult);

// --- enrolment URLs --------------------------------------------------------

/** What the URL a person is sent authorizes: making the user, or adding an
 * instance to one that exists.
 *
 * The two are told apart here rather than by which fields happen to be set,
 * because they are answered by different ceremonies — a creation makes a
 * credential, an addition asserts with one that exists — and an op whose effect
 * is read off the shape of its arguments is authorization written outside the
 * table that decides it. */
export const EnrollPurpose = Type.Union([Type.Literal("create_user"), Type.Literal("add_owner")], {
  $id: "EnrollPurpose",
});
export type EnrollPurpose = Static<typeof EnrollPurpose>;

/** What every enrolment URL carries, whichever of the two it is. */
const ENROLL_CLAIMS_FIELDS = {
  /** The instance that issued the URL and holds the secret. */
  iss: InstanceId,
  /** The instance the person will own once this is spent. The issuer's own:
   * an instance hands out the right to enter itself, and nothing here lets
   * one instance open a door into another. */
  instance: InstanceId,
  /** Where the person is being sent, and so the only place the ceremony may
   * be held: the `clientDataJSON.origin` is compared with this, the `Origin`
   * header with this, and the relying party is this origin's host.
   *
   * An origin rather than a URL because that is the size of everything
   * compared against it, and because there is nothing else to say: **the person
   * is sent to the root of this origin**. Nothing under it is named, since
   * nothing under it can be told apart — a browser writes no path into an
   * `Origin` header or a `clientDataJSON`, so two paths here would be one place
   * to every check made. */
  origin: Origin,
  /** Where the page posts what it made: the base URL the `auth` routes hang
   * under.
   *
   * **A destination and not a binding.** The page has to send its answer
   * somewhere, and a URL a person carries from a terminal has no other way to
   * say where. Nothing on the receiving side compares this with anything —
   * not with its own endpoint, not with the issuer's. It may be the address
   * of a load balancer with several instances behind it, and whichever of
   * them the answer lands on completes the enrolment: it checks the ceremony
   * itself and asks the issuer only for what the issuer alone holds. Having
   * nothing to compare here is the point rather than an omission. */
  endpoint: Endpoint,
  expires_at: Timestamp,
  /** Names this enrolment, so it can be spent once. */
  jti: Type.String({ minLength: 1 }),
  /** What the administrator who issued the URL wrote down about who it was
   * for. Their words, not the holder's — the label the person gives their
   * own device is `device_label` on the record, and the two are worth telling
   * apart when a list is read back later. */
  issued_label: Type.Optional(Type.String({ maxLength: 128 })),
} as const;

/** What an enrolment URL carries, as the instance that issued it reads it back.
 * On the wire between a browser and an instance the whole of it is one opaque
 * string; this shape is what `auth.resolve` answers with, so the two instances
 * involved agree on what was authorized.
 *
 * Its integrity rests on a secret made for this one enrolment and held only in
 * the issuing instance's memory. Nothing outlives the window: a restart loses
 * the secret, and the remedy is to issue another URL rather than to keep a key
 * that could sign anything later.
 *
 * A union on `purpose` rather than one shape with an optional `user`, because
 * the two purposes do not carry the same claims and a schema that accepted
 * either field with either purpose would leave the issuing and the receiving
 * instance free to read one value two ways. The correlation is the claim. */
export const EnrollClaims = Type.Union(
  [
    Type.Object({
      ...ENROLL_CLAIMS_FIELDS,
      purpose: Type.Literal("create_user"),
      /** The user handle the credential will be created against.
       *
       * The issuer settles it rather than the page because the authenticator
       * keeps it beyond any instance's reach — a second value for one person
       * would be a second account on their device that nothing here could
       * undo. */
      user: UserId,
    }),
    Type.Object({
      ...ENROLL_CLAIMS_FIELDS,
      purpose: Type.Literal("add_owner"),
      /** Named here only to be refused. Who arrives is what the assertion
       * says, so a handle stated up front would be a name the ceremony was
       * never held to — and a claim that is merely unread is one an issuer and
       * a receiver can still disagree about. */
      user: Type.Optional(Type.Never()),
    }),
  ],
  { $id: "EnrollClaims" },
);
export type EnrollClaims = Static<typeof EnrollClaims>;

// --- making a user ---------------------------------------------------------

/** What `navigator.credentials.create()` produced, in this contract's spelling.
 * The browser's own field names are camelCase; they are written snake_case here
 * like every other field on this wire, and the client that speaks to the
 * authenticator is what maps between the two. */
export const RegistrationCredential = Type.Object(
  {
    id: Base64Url,
    raw_id: Base64Url,
    client_data_json: Base64Url,
    /** Attestation is `none`, so what this carries is the authenticator data
     * and the public key, not a statement about the hardware. */
    attestation_object: Base64Url,
  },
  { $id: "RegistrationCredential" },
);
export type RegistrationCredential = Static<typeof RegistrationCredential>;

export const AuthRegisterArgs = Type.Object({
  /** The enrolment URL's token, opaque to the caller and to any instance but
   * its issuer. */
  token: Type.String({ minLength: 1 }),
  /** The six digits the command line showed when the URL was made, typed in by
   * the person registering. It is not in the URL and never travels with it, so
   * a leaked URL is not a registration: the two halves reach the browser by
   * different routes, and only someone who was shown the terminal has both. */
  code: Type.String({ pattern: "^[0-9]{6}$" }),
  /** What the person calls the device they are registering, for their own use
   * when they later read back a list of several. Nothing is decided by it. */
  device_label: Type.Optional(Type.String({ maxLength: 128 })),
  /** The challenge this registration answers, with the instance that can spend
   * it — the same pairing an assertion carries, and for the same reason: the
   * value also sits inside `client_data_json`, but who may consume it does not,
   * and behind a load balancer the instance that issued it, the one that made
   * the enrolment URL and the one receiving this may all be different.
   *
   * Omitting it leaves the receiver with a value and no issuer, so it can only
   * be honoured where the receiver itself holds the challenge; anywhere else
   * the registration is refused rather than guessed at. */
  challenge: Type.Optional(AuthChallenge),
  credential: RegistrationCredential,
});
export type AuthRegisterArgs = Static<typeof AuthRegisterArgs>;

/** What a person holds after they are authenticated.
 *
 * Only the access token is stated. The refresh token is set as a cookie by the
 * carrier that ran the op, so putting it here too would be a second copy of a
 * secret in a place the browser's script can read — which is the one property
 * the cookie exists to have. That holds however far the page is from the
 * endpoint: a cookie the page's own site cannot reach is sent from a site it
 * does not own only as a partitioned one, which keeps a session taken at one
 * site from being carried to another. That partition is by site, where a
 * credential is by origin, so it is the `Origin` held against this family's
 * `origin` that keeps a session to the one place it was made — the cookie's
 * partition answers for sites and nothing finer. Sending it at all across sites
 * takes a browser that partitions cookies, which is a premise of this contract
 * rather than a case it accommodates: one that does not is not an environment
 * this is spoken over. */
export const AuthSession = Type.Object(
  {
    user: UserId,
    /** The access token and when it stops being accepted. It is presented on
     * the WebSocket handshake, and a connection lives until this instant unless
     * it is renewed on the connection itself. */
    access: Type.Object({ value: Base64Url, expires_at: Timestamp }),
  },
  { $id: "AuthSession" },
);
export type AuthSession = Static<typeof AuthSession>;

export const AuthRegisterResult = AuthSession;
export type AuthRegisterResult = Static<typeof AuthRegisterResult>;

export const AuthRegisterRequest = request("auth.register", AuthRegisterArgs);
export const AuthRegisterResponse = response("auth.register", AuthRegisterResult);

// --- assertion -------------------------------------------------------------

/** What `navigator.credentials.get()` produced. `user_handle` is what a
 * resident credential answers with when the person named no account, so the
 * person can be found without the browser having been told who they are. */
export const AssertionCredential = Type.Object(
  {
    raw_id: Base64Url,
    client_data_json: Base64Url,
    authenticator_data: Base64Url,
    signature: Base64Url,
    user_handle: Type.Optional(UserId),
  },
  { $id: "AssertionCredential" },
);
export type AssertionCredential = Static<typeof AssertionCredential>;

export const AuthAssertArgs = Type.Object({
  credential: AssertionCredential,
  /** The challenge this assertion answers, with the instance that can spend
   * it. The value also sits inside `client_data_json`; it is stated here so the
   * receiver knows who to ask before it parses anything the browser sent. */
  challenge: AuthChallenge,
});
export type AuthAssertArgs = Static<typeof AuthAssertArgs>;

export const AuthAssertResult = AuthSession;
export type AuthAssertResult = Static<typeof AuthAssertResult>;

export const AuthAssertRequest = request("auth.assert", AuthAssertArgs);
export const AuthAssertResponse = response("auth.assert", AuthAssertResult);

// --- adding an instance to a user ------------------------------------------

/** Adds one instance to the user the assertion names.
 *
 * Apart from `auth.assert` because it answers a different question. An
 * assertion says who is here; this says that the person in front of the
 * authenticator decided, now, to take an instance as theirs — and only the six
 * digits shown at that instance's terminal can say the second thing. Folding it
 * into the assertion as optional arguments would be an op whose effect changes
 * with which fields are present, which is authorization decided outside the
 * table.
 *
 * No credential is created: the person already has one, and an instance is not
 * something a passkey is made for. */
export const AuthEnrollArgs = Type.Object({
  /** The enrolment URL's token, as `auth.register` carries one. */
  token: Type.String({ minLength: 1 }),
  /** The six digits, required here exactly as they are for a registration. What
   * the assertion proves is that this is the person; what the digits prove is
   * that they are the one asking for this instance. Without them a synced
   * passkey left unattended is enough for someone else to hand themselves an
   * instance in the person's name. */
  code: Type.String({ pattern: "^[0-9]{6}$" }),
  challenge: AuthChallenge,
  credential: AssertionCredential,
});
export type AuthEnrollArgs = Static<typeof AuthEnrollArgs>;

export const AuthEnrollResult = AuthSession;
export type AuthEnrollResult = Static<typeof AuthEnrollResult>;

export const AuthEnrollRequest = request("auth.enroll", AuthEnrollArgs);
export const AuthEnrollResponse = response("auth.enroll", AuthEnrollResult);

// --- refreshing a token pair ----------------------------------------------

/** Why a client asked for a fresh pair. Stated by the caller and never checked,
 * so nothing may be decided by it; it is kept only to be recognised later by
 * the person whose sessions they are. */
export const AuthRefreshReason = Type.Union(
  [Type.Literal("reload"), Type.Literal("expiring"), Type.Literal("reconnect")],
  { $id: "AuthRefreshReason" },
);
export type AuthRefreshReason = Static<typeof AuthRefreshReason>;

/** The refresh token is not among the arguments: it is a cookie the carrier
 * already holds, and a caller that could state it is a caller that could read
 * it. What is left is why the caller is asking, which nothing is decided by.
 *
 * Answered wherever it lands. The family is replicated and every instance its
 * owner owns may write it, so a rotation is not carried anywhere. Two instances
 * rotating one family at once is a collision the losing value does not survive:
 * it is a value the family retired, which is indistinguishable from a replay,
 * and the contract has nothing that would tell the two apart. The person signs
 * in again, which costs one verification and keeps replay detection as sharp as
 * it was. */
export const AuthTokenRefreshArgs = Type.Object({
  /** What prompted this refresh, as the client knows it: the page was loaded
   * again, the access token was about to expire, or a dropped connection is
   * being remade. A hint kept on the family (`last_refresh`) for a person
   * reading their own sessions back — a run of `reconnect` at an hour they were
   * asleep is something to recognise. The value is the caller's word and is
   * never checked, so nothing may turn on it; an unstated reason is as valid a
   * refresh as any. */
  reason: Type.Optional(AuthRefreshReason),
});
export type AuthTokenRefreshArgs = Static<typeof AuthTokenRefreshArgs>;

export const AuthTokenRefreshResult = AuthSession;
export type AuthTokenRefreshResult = Static<typeof AuthTokenRefreshResult>;

export const AuthTokenRefreshRequest = request("auth.token.refresh", AuthTokenRefreshArgs);
export const AuthTokenRefreshResponse = response("auth.token.refresh", AuthTokenRefreshResult);

// --- extending a live connection ------------------------------------------

/** Carries a token got from `auth.token.refresh`, on the connection whose life
 * it extends. Apart from that op because they answer different questions: one
 * mints, this one moves a live connection's deadline, and a client that had to
 * reconnect to use a fresh token would blink every few hours for no reason. */
export const AuthExtendArgs = Type.Object({ access_token: Base64Url });
export type AuthExtendArgs = Static<typeof AuthExtendArgs>;

export const AuthExtendResult = Type.Object({
  /** The connection's new deadline, as the greeting first stated it. */
  auth_expires_at: Timestamp,
});
export type AuthExtendResult = Static<typeof AuthExtendResult>;

export const AuthExtendRequest = request("auth.extend", AuthExtendArgs);
export const AuthExtendResponse = response("auth.extend", AuthExtendResult);

// --- between instances -----------------------------------------------------

/** Asks the instance that issued something to check it and spend it.
 *
 * Two things are only knowable at their issuer: an enrolment URL, whose secret
 * never left it, and a challenge, which is good once and so has to be spent
 * somewhere single. Everything else about the exchange — the WebAuthn
 * verification, the record lookup, writing what was authorized — the receiving
 * instance does itself.
 *
 * One kind covers both enrolments rather than one each. What is checked is the
 * same in both — the token, the digits, the count of attempts against them —
 * and what tells them apart is in the claims that come back. */
export const AuthResolveArgs = Type.Union(
  [
    Type.Object({
      kind: Type.Literal("claims"),
      token: Type.String({ minLength: 1 }),
      /** The digits the person typed, forwarded unchecked. The issuer holds
       * both the code and the count of attempts against it, so it is the only
       * one that can refuse a wrong one and retire the URL after enough of
       * them; a receiver that judged the code itself would let an attacker
       * spread guesses across instances without any of them counting. */
      code: Type.String({ pattern: "^[0-9]{6}$" }),
    }),
    Type.Object({ kind: Type.Literal("challenge"), challenge: Base64Url }),
  ],
  { $id: "AuthResolveArgs" },
);
export type AuthResolveArgs = Static<typeof AuthResolveArgs>;

/** What was authorized, for an enrolment; nothing beyond the acknowledgement
 * for a challenge, whose whole answer is that it was unspent and now is not. */
export const AuthResolveResult = Type.Union(
  [
    Type.Object({ kind: Type.Literal("claims"), claims: EnrollClaims }),
    Type.Object({ kind: Type.Literal("challenge") }),
  ],
  { $id: "AuthResolveResult" },
);
export type AuthResolveResult = Static<typeof AuthResolveResult>;

export const AuthResolveRequest = request("auth.resolve", AuthResolveArgs);
export const AuthResolveResponse = response("auth.resolve", AuthResolveResult);

// --- the replicated records ------------------------------------------------

/** A person, as every instance in the mesh holds them.
 *
 * The root of everything else here: credentials answer for this user, families
 * belong to it, and ownerships say which instances it may enter. It is keyed by
 * a value the authenticator also holds, so the person on a device and the
 * person in these records are the same one by construction. */
export const UserRecord = Type.Object(
  {
    kind: Type.Literal("user"),
    user: UserId,
    /** What the person calls themselves, for their own sake when they read
     * their account back or when several people share an instance.
     *
     * A hint like the labels on a credential: nothing is admitted, refused or
     * matched by it, and the contract says nothing about what it may contain.
     * The identity is the id beside it, which no display name ever stands in
     * for. */
    display_name: Type.Optional(Type.String({ maxLength: 128 })),
    created_at: Timestamp,
  },
  { $id: "UserRecord" },
);
export type UserRecord = Static<typeof UserRecord>;

/** The fields of a credential that are a person's to read: everything but the
 * public key, which is how an assertion is checked and nothing a list needs. */
const CREDENTIAL_PUBLIC_FIELDS = {
  kind: Type.Literal("credential"),
  user: UserId,
  /** The credential's id as the authenticator names it, which is also what an
   * assertion is looked up by. */
  credential_id: Base64Url,
  /** The one place a ceremony with this credential may be held.
   *
   * Registration and assertion alike are held to it: the `clientDataJSON.origin`
   * has to equal this, the `Origin` header has to equal this, and the relying
   * party is this origin's host so that the authenticator's own binding says
   * the same thing rather than something wider. That last part is this
   * contract's rule and not WebAuthn's — a passkey is bound to a relying party,
   * which may be a suffix of the host, so the authenticator alone would answer
   * for every origin under that suffix.
   *
   * It says nothing about which instance the holder may enter. That is the
   * ownership record's answer, and keeping the two apart is what lets one
   * credential work against every instance a person owns and against a load
   * balancer in front of them. A person using web UIs at two origins holds two
   * credentials; using three instances behind one origin holds one. */
  origin: Origin,
  /** The authenticator's counter, when it keeps one. Synced passkeys report
   * zero forever, so only a pair of non-zero readings says anything, and a
   * reading below the last one is a refusal. */
  sign_count: Type.Optional(Type.Integer({ minimum: 0 })),
  /** The BE flag of the authenticator data at registration: whether this
   * credential is one the authenticator may back up, which in practice is
   * what separates a passkey synced across a person's devices from one that
   * lives on the single device it was made on.
   *
   * A hint and nothing else, like the address and the user agent beside it:
   * nothing is admitted or refused by it. It is here so the person reading
   * their own list can tell "this is my iCloud passkey, it is on every device
   * I own" from "this is the key on the stick in my drawer" — which decides
   * what removing the line actually costs them. */
  backup_eligible: Type.Optional(Type.Boolean()),
  /** The BS flag of the same authenticator data: whether the credential was
   * backed up at that moment. Read beside `backup_eligible` — eligible and
   * not yet backed up is an ordinary state on a device that has just made the
   * key, and it too decides nothing. */
  backup_state: Type.Optional(Type.Boolean()),
  /** The label the administrator put on the enrolment URL, carried over from
   * the claims it was spent against. */
  issued_label: Type.Optional(Type.String({ maxLength: 128 })),
  /** The label the person put on this device as they registered it. */
  device_label: Type.Optional(Type.String({ maxLength: 128 })),
  registered_at: Timestamp,
  /** Where the registration came from and what browser sent it.
   *
   * None of this authenticates anything, and nothing is ever admitted or
   * refused by it — an address is trivially chosen by whoever is making the
   * request. They are here to be recognised by the one person reading their
   * own list: an address that is their home provider's and a browser that is
   * the one they use is how they place a line as theirs, or fail to, which is
   * the whole reason to keep it. The same holds of the pair below. */
  registered_ip: Type.Optional(Type.String({ minLength: 1, maxLength: 45 })),
  registered_user_agent: Type.Optional(Type.String({ maxLength: 512 })),
  /** When this credential last answered a challenge, and from where. A
   * credential the person no longer recognises is one they remove. */
  last_used_at: Type.Optional(Timestamp),
  last_used_ip: Type.Optional(Type.String({ minLength: 1, maxLength: 45 })),
  last_used_user_agent: Type.Optional(Type.String({ maxLength: 512 })),
} as const;

/** A credential as a person reads it back: what an instance holds, less the
 * public key. */
export const CredentialRecordPublic = Type.Object(CREDENTIAL_PUBLIC_FIELDS, {
  $id: "CredentialRecordPublic",
});
export type CredentialRecordPublic = Static<typeof CredentialRecordPublic>;

/** A registered passkey, as every instance in the mesh holds it.
 *
 * Complete once it is written: the instance that registered it is not asked
 * about it again, which is what lets a person authenticate at any instance they
 * own while the one they registered at is down. */
export const CredentialRecord = Type.Object(
  {
    ...CREDENTIAL_PUBLIC_FIELDS,
    /** The public key, COSE-encoded. */
    public_key: Base64Url,
  },
  { $id: "CredentialRecord" },
);
export type CredentialRecord = Static<typeof CredentialRecord>;

/** That one person owns one instance, which is the whole of what admits them to
 * it.
 *
 * A record rather than something read off the mesh. Belonging to a mesh admits
 * nobody: if it did, adding an instance would widen every person's reach at
 * once and there would be no way to take one instance back. Here, granting and
 * revoking are each one line, and neither says anything about how the instances
 * are wired to each other.
 *
 * Several people may own one instance and one person may own several. Which
 * endpoint a request arrived at is not part of this and is not compared with
 * anything: an instance reached through a load balancer it shares with its
 * peers admits the same people as one reached directly. */
export const OwnershipRecord = Type.Object(
  {
    kind: Type.Literal("ownership"),
    user: UserId,
    instance: InstanceId,
    /** Names this granting, and nothing else. Random, settled when the record
     * is written, and never reused.
     *
     * It is in the key (`ownership/<instance>/<user>/<grant>`) so that giving an
     * instance up and taking it again are two records rather than one key
     * written twice. A tombstone refuses every later write to its key and is
     * kept without end, so a key made only of the instance and the person would
     * make the first removal final: the person could never be an owner of that
     * instance again, and nothing here could undo it. With this, the removal
     * ends one granting and a later one begins another.
     *
     * What answers "does this person own this instance" is therefore not one
     * record but whether any granting for the pair is still alive. */
    grant: Base64Url,
    granted_at: Timestamp,
    /** Who added this owner, when an owner did rather than the command line. A
     * hint, as the labels are: it decides nothing, and it is here so that a
     * person reading a list of several owners can see how each came to be
     * there. */
    granted_by: Type.Optional(UserId),
  },
  { $id: "OwnershipRecord" },
);
export type OwnershipRecord = Static<typeof OwnershipRecord>;

/** One person's tokens, in the generation that stands and the one before it.
 *
 * The previous generation is kept so that a reply lost on the way — the client
 * rotated, the answer never arrived, it retries — is answered rather than read
 * as a replay. Anything older than that is a stolen value being reused, and it
 * fails the whole family. */
export const TokenFamily = Type.Object(
  {
    kind: Type.Literal("token_family"),
    user: UserId,
    /** The instance that minted the family.
     *
     * A record of where it came from and not a restriction on who may write it:
     * any instance the person owns rotates the family where the request landed,
     * which is what keeps a refresh working while the minting instance is down.
     * Two of them rotating at once is a collision the losing generation does not
     * survive, and the client it belonged to signs in again. */
    iss: InstanceId,
    /** The origin of the page that authenticated, carried over from the
     * credential that answered.
     *
     * What a connection presenting one of these tokens is held to: the
     * handshake compares this with the `Origin` the browser states, and a page
     * from anywhere else is refused however good the token is — refused as an
     * upgrade that does not happen, there being no connection yet to answer an
     * error on. A handshake that states no `Origin` at all is refused the same
     * way: every gate has to be passed, and a caller with nothing to compare has
     * not passed this one. Without it a token that leaked would be usable from
     * any page at all, since it says who the person is and nothing about what is
     * holding it. It lives on the family rather than inside the token's own
     * spelling because every instance has the family and none of them has the
     * minting instance's reading of an opaque value. */
    origin: Origin,
    access: Type.Object({ value: Base64Url, expires_at: Timestamp }),
    refresh: Type.Object({ value: Base64Url, expires_at: Timestamp }),
    /** When the family was last rotated, and what the client said prompted it.
     *
     * The same kind of thing as a credential's `last_used_*`: a hint for the
     * one person reading their own sessions, never a reason to admit or refuse
     * anything. `reason` in particular is the caller's unchecked word. Only the
     * most recent rotation is kept — a family holds what stands now, and a log
     * of every generation would be a second store hidden inside a record that
     * travels to every instance. */
    last_refresh: Type.Optional(
      Type.Object({
        at: Timestamp,
        reason: Type.Optional(AuthRefreshReason),
        ip: Type.Optional(Type.String({ minLength: 1, maxLength: 45 })),
        user_agent: Type.Optional(Type.String({ maxLength: 512 })),
      }),
    ),
    /** The generation before the current one, while the grace for it lasts. */
    previous_refresh: Type.Optional(Type.Object({ value: Base64Url, expires_at: Timestamp })),
    /** What every generation retired before that was, kept only as a digest and
     * only until the value itself would have expired.
     *
     * Recognising a replay takes remembering the value, but holding it is what
     * the family is trying to protect — these travel to every instance, and a
     * retired token still inside its lifetime would be a live secret copied
     * around for no purpose it could serve. A digest answers the one question
     * asked of it, that a value presented now was once issued here and is no
     * longer, which fails the whole family. Matching one of these is the only
     * thing that does: a value this family knows nothing of was never issued by
     * it, and refusing the call is the whole of the answer.
     *
     * Written by whichever owned instance rotated, like the rest of the family,
     * and replicated, so the memory survives an instance restarting and holds
     * wherever the reused value is presented. */
    retired: Type.Optional(
      Type.Array(
        Type.Object({
          /** sha256 of the retired value, lowercase hex. */
          hash: Type.String({ pattern: "^[0-9a-f]{64}$" }),
          /** When the value would have expired, after which remembering it
           * refuses nothing that its own expiry would not. */
          expires_at: Timestamp,
        }),
      ),
    ),
  },
  { $id: "TokenFamily" },
);
export type TokenFamily = Static<typeof TokenFamily>;

/** A removal, which has to be a record of its own rather than an absence: an
 * instance that was partitioned still holds what was removed, and an absence in
 * a set of changes says nothing.
 *
 * A tombstone refuses every later write to its key, so a returning peer cannot
 * bring back what a person revoked. It names no subject of its own: the key it
 * arrives under says what was removed, and a field repeating it would be a
 * second answer able to disagree with the first. */
export const AuthTombstone = Type.Object(
  {
    kind: Type.Literal("tombstone"),
    deleted_at: Timestamp,
    /** When the mark itself may be dropped. Absent on a credential's and an
     * ownership's, which are kept without end because what they refuse has no
     * expiry of its own to fall back on. */
    expires_at: Type.Optional(Timestamp),
  },
  { $id: "AuthTombstone" },
);
export type AuthTombstone = Static<typeof AuthTombstone>;

/** One entry of the replicated set, under the key it is matched by.
 *
 * The keys are `user/<user>`, `credential/<credential_id>`,
 * `ownership/<instance>/<user>/<grant>` and `family/<id>`. What a key names is
 * what a tombstone under it removes — one granting rather than the pair, which
 * is what lets an instance be given up and taken again. */
export const AuthRecord = Type.Object(
  {
    /** What this entry is, mesh-wide. Two instances writing one key hold the
     * same thing, and the later `updated_at` is what stands. */
    key: Type.String({ minLength: 1, maxLength: 256 }),
    updated_at: Timestamp,
    body: Type.Union([UserRecord, CredentialRecord, OwnershipRecord, TokenFamily, AuthTombstone]),
  },
  { $id: "AuthRecord" },
);
export type AuthRecord = Static<typeof AuthRecord>;

// --- reading one's own account --------------------------------------------

export const AuthAccountReadArgs = Type.Object({});
export type AuthAccountReadArgs = Static<typeof AuthAccountReadArgs>;

/** Who the caller is, what answers for them, and what they own — the three
 * things a person has, in one reply.
 *
 * One op rather than three because they are one picture: a person reading this
 * is deciding whether a line is theirs and whether to remove it, and a passkey
 * read apart from the instances it opens does not answer that. Named for the
 * account instead of for any of the three, so none of them reads as an
 * appendage of another.
 *
 * It answers about the caller and nobody else. There is no shape here for
 * reading another person's account: owning an instance with someone else does
 * not make either of them an administrator of the other. */
export const AuthAccountReadResult = Type.Object(
  {
    user: UserRecord,
    /** Every passkey that answers for this person, at every origin. Without the
     * public keys: a public key is how an assertion is verified and is of no
     * use to a person reading a list, and what a reply does not carry cannot be
     * read out of one. */
    credentials: Type.Array(CredentialRecordPublic),
    /** The instances this person owns, with where each is reached when it
     * publishes an address at all. The endpoint is stated for the person's sake
     * — an instance id names but does not locate — and it is read off the
     * instance rather than out of the ownership, which holds no address. */
    instances: Type.Array(
      Type.Object({
        instance: InstanceId,
        endpoint: Type.Optional(Endpoint),
        granted_at: Timestamp,
        granted_by: Type.Optional(UserId),
      }),
    ),
  },
  { $id: "AuthAccountReadResult" },
);
export type AuthAccountReadResult = Static<typeof AuthAccountReadResult>;

export const AuthAccountReadRequest = request("auth.account.read", AuthAccountReadArgs);
export const AuthAccountReadResponse = response("auth.account.read", AuthAccountReadResult);

// --- letting go of an instance and of a passkey ---------------------------

/** Gives up one instance: the ownership that admitted this person to it is
 * removed, and nothing else of theirs changes.
 *
 * Named by the instance alone. An ownership is keyed by the instance and the
 * person, and the person is the caller — there is no shape here for removing
 * somebody else's ownership, an instance's owners not being its administrators
 * of one another.
 *
 * Every granting of that instance to this person ends, there being no shape
 * here for giving up one of two grantings of the same thing. Being made an
 * owner again afterwards is a new granting and is not refused by what this
 * left behind.
 *
 * Removing the ownership of the instance the connection is on is refused
 * (`auth_in_use`). It is theirs to remove; asking from another instance they
 * own, or from the command line, is all it takes. */
export const AuthOwnershipRemoveArgs = Type.Object({ instance: InstanceId });
export type AuthOwnershipRemoveArgs = Static<typeof AuthOwnershipRemoveArgs>;

export const AuthOwnershipRemoveResult = Type.Object({});
export type AuthOwnershipRemoveResult = Static<typeof AuthOwnershipRemoveResult>;

export const AuthOwnershipRemoveRequest = request("auth.ownership.remove", AuthOwnershipRemoveArgs);
export const AuthOwnershipRemoveResponse = response(
  "auth.ownership.remove",
  AuthOwnershipRemoveResult,
);

/** Removes one passkey. The origin it was made at leaves the allowed set with
 * the last credential naming it, which is the only way an origin ever leaves.
 *
 * The credential this session authenticated with is refused (`auth_in_use`),
 * for the same reason an ownership underfoot is: a person removing the key they
 * are holding would be locking themselves out mid-sentence. Another passkey, or
 * another session, removes it. */
export const AuthCredentialRemoveArgs = Type.Object({ credential_id: Base64Url });
export type AuthCredentialRemoveArgs = Static<typeof AuthCredentialRemoveArgs>;

export const AuthCredentialRemoveResult = Type.Object({});
export type AuthCredentialRemoveResult = Static<typeof AuthCredentialRemoveResult>;

export const AuthCredentialRemoveRequest = request(
  "auth.credential.remove",
  AuthCredentialRemoveArgs,
);
export const AuthCredentialRemoveResponse = response(
  "auth.credential.remove",
  AuthCredentialRemoveResult,
);

/** The `auth.records` topic: how users, credentials, ownerships and token
 * families reach every instance.
 *
 * Apart from the store because of who may read it. The store is the person's to
 * read and write, and these are secrets that authenticate them — a token read
 * out of the store would be the person's session, and a credential or an
 * ownership written into it would be a new way in. Only instances subscribe,
 * and a relay carries the frames as the instance it is rather than on a
 * person's behalf. */
export const AuthRecordsFrame = topicFrame(
  "auth.records",
  Type.Object({ records: Type.Array(AuthRecord) }),
);
