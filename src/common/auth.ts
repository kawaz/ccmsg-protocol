import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { Endpoint, InstanceId, Timestamp } from "../identifiers.ts";

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
 * retention would otherwise carry the removed credential back as news. */
export const FAMILY_TOMBSTONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Who a person is to this cluster. Issued when the registration URL is made
 * (`<unit>-<counter>` by default) and carried by every record they own. */
export const Subject = Type.String({ $id: "Subject", minLength: 1, maxLength: 128 });
export type Subject = Static<typeof Subject>;

// --- challenge -------------------------------------------------------------

export const AuthChallengeArgs = Type.Object({});
export type AuthChallengeArgs = Static<typeof AuthChallengeArgs>;

/** A challenge and who issued it.
 *
 * The issuer travels beside the value rather than inside it because the
 * instance that receives the answer is not necessarily the one that issued it:
 * behind a load balancer either may be reached, so the receiver reads the
 * issuer, asks it to consume the challenge (`auth_resolve`), and verifies the
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

export const AuthChallengeRequest = request("auth_challenge", AuthChallengeArgs);
export const AuthChallengeResponse = response("auth_challenge", AuthChallengeResult);

// --- registration ----------------------------------------------------------

/** What the registration URL carries, as the instance that issued it reads it
 * back. On the wire between a browser and an instance the whole of it is one
 * opaque string; this shape is what `auth_resolve` answers with, so the two
 * instances involved agree on what was authorized.
 *
 * Its integrity rests on a secret made for this one registration and held only
 * in the issuing instance's memory. Nothing outlives the window: a restart
 * loses the secret, and the remedy is to issue another URL rather than to keep
 * a key that could sign anything later. */
export const RegisterClaims = Type.Object(
  {
    /** The instance that issued the URL and holds the secret. */
    iss: InstanceId,
    sub: Subject,
    /** The instance's name as a person operates it, for display. */
    unit: Type.String({ minLength: 1 }),
    /** The endpoint the credential is being registered for. The base URL: the
     * registration is posted to `<endpoint>auth/register`, and the cookie set
     * for it hangs under the same prefix. */
    endpoint: Endpoint,
    /** The WebAuthn relying party: a domain, not an origin. Either the
     * endpoint's host or a registrable suffix of it. */
    rp_id: Type.String({ minLength: 1 }),
    expires_at: Timestamp,
    /** Names this registration, so it can be spent once. */
    jti: Type.String({ minLength: 1 }),
    /** The WebAuthn user handle for this subject: sixteen random bytes the
     * issuing instance settles on once per `sub`. The page creates the
     * credential against it, the record keeps it, and an assertion that names a
     * handle is held to it. It is here rather than left to the page because the
     * authenticator stores it beyond this instance's reach — a second value for
     * one person would be a second account on their device. */
    user_id: Base64Url,
    /** What the administrator who issued the URL wrote down about who it was
     * for. Their words, not the holder's — the label the person gives their
     * own device is `device_label` on the record, and the two are worth telling
     * apart when a list is read back later. */
    issued_label: Type.Optional(Type.String({ maxLength: 128 })),
  },
  { $id: "RegisterClaims" },
);
export type RegisterClaims = Static<typeof RegisterClaims>;

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
  /** The registration URL's token, opaque to the caller and to any instance
   * but its issuer. */
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
   * the registration URL and the one receiving this may all be different.
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
 * the cookie exists to have. */
export const AuthSession = Type.Object(
  {
    sub: Subject,
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

export const AuthRegisterRequest = request("auth_register", AuthRegisterArgs);
export const AuthRegisterResponse = response("auth_register", AuthRegisterResult);

// --- assertion -------------------------------------------------------------

/** What `navigator.credentials.get()` produced. `user_handle` is what a
 * resident credential answers with when the person named no account, so a
 * signed-in subject can be found without the browser having been told one. */
export const AssertionCredential = Type.Object(
  {
    raw_id: Base64Url,
    client_data_json: Base64Url,
    authenticator_data: Base64Url,
    signature: Base64Url,
    user_handle: Type.Optional(Base64Url),
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

export const AuthAssertRequest = request("auth_assert", AuthAssertArgs);
export const AuthAssertResponse = response("auth_assert", AuthAssertResult);

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
 * it. What is left is why the caller is asking, which nothing is decided by. */
export const AuthRefreshTokenArgs = Type.Object({
  /** What prompted this refresh, as the client knows it: the page was loaded
   * again, the access token was about to expire, or a dropped connection is
   * being remade. A hint kept on the family (`last_refresh`) for a person
   * reading their own sessions back — a run of `reconnect` at an hour they were
   * asleep is something to recognise. The value is the caller's word and is
   * never checked, so nothing may turn on it; an unstated reason is as valid a
   * refresh as any. */
  reason: Type.Optional(AuthRefreshReason),
});
export type AuthRefreshTokenArgs = Static<typeof AuthRefreshTokenArgs>;

export const AuthRefreshTokenResult = AuthSession;
export type AuthRefreshTokenResult = Static<typeof AuthRefreshTokenResult>;

export const AuthRefreshTokenRequest = request("auth_refresh_token", AuthRefreshTokenArgs);
export const AuthRefreshTokenResponse = response("auth_refresh_token", AuthRefreshTokenResult);

// --- extending a live connection ------------------------------------------

/** Carries a token got from `auth_refresh_token`, on the connection whose life
 * it extends. Apart from that op because they answer different questions: one
 * mints, this one moves a live connection's deadline, and a client that had to
 * reconnect to use a fresh token would blink every few hours for no reason. */
export const AuthRefreshArgs = Type.Object({ access_token: Base64Url });
export type AuthRefreshArgs = Static<typeof AuthRefreshArgs>;

export const AuthRefreshResult = Type.Object({
  /** The connection's new deadline, as `hello` first stated it. */
  auth_expires_at: Timestamp,
});
export type AuthRefreshResult = Static<typeof AuthRefreshResult>;

export const AuthRefreshRequest = request("auth_refresh", AuthRefreshArgs);
export const AuthRefreshResponse = response("auth_refresh", AuthRefreshResult);

// --- between instances -----------------------------------------------------

/** Asks the instance that issued something to check it and spend it.
 *
 * Two things are only knowable at their issuer: a registration URL, whose
 * secret never left it, and a challenge, which is good once and so has to be
 * spent somewhere single. Everything else about the exchange — the WebAuthn
 * verification, the record lookup — the receiving instance does itself. */
export const AuthResolveArgs = Type.Union(
  [
    Type.Object({
      kind: Type.Literal("register"),
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

/** What was authorized, for a registration; nothing beyond the acknowledgement
 * for a challenge, whose whole answer is that it was unspent and now is not. */
export const AuthResolveResult = Type.Union(
  [
    Type.Object({ kind: Type.Literal("register"), claims: RegisterClaims }),
    Type.Object({ kind: Type.Literal("challenge") }),
  ],
  { $id: "AuthResolveResult" },
);
export type AuthResolveResult = Static<typeof AuthResolveResult>;

export const AuthResolveRequest = request("auth_resolve", AuthResolveArgs);
export const AuthResolveResponse = response("auth_resolve", AuthResolveResult);

/** Rotates a token family at the one instance allowed to write it.
 *
 * A family is written by its `iss` alone. Two instances rotating one family in
 * parallel would merge by last write and lose a generation, which reads exactly
 * like a stolen token being replayed — so the rotation is forwarded rather than
 * done where the request landed. */
export const AuthRotateArgs = Type.Object({
  refresh_token: Base64Url,
  /** What the receiving instance observed of the caller, carried to the issuer
   * for `last_refresh`. The person is at the other end of the receiver's
   * connection, not the issuer's, so these are only knowable there; forwarded
   * without them, a rotation would be remembered as a time and nothing else.
   *
   * Stated by the receiver and never checked by the issuer — the same standing
   * as the values on a rotation that was not forwarded, which the client and
   * its connection are equally the only source of. Nothing may be decided by
   * them. */
  reason: Type.Optional(AuthRefreshReason),
  ip: Type.Optional(Type.String({ minLength: 1, maxLength: 45 })),
  user_agent: Type.Optional(Type.String({ maxLength: 512 })),
});
export type AuthRotateArgs = Static<typeof AuthRotateArgs>;

/** Both halves, unlike the person-facing ops: the instance that asked for the
 * rotation is the one that has to put the new refresh token in a cookie. */
export const AuthRotateResult = Type.Object({
  sub: Subject,
  access: Type.Object({ value: Base64Url, expires_at: Timestamp }),
  refresh: Type.Object({ value: Base64Url, expires_at: Timestamp }),
});
export type AuthRotateResult = Static<typeof AuthRotateResult>;

export const AuthRotateRequest = request("auth_rotate", AuthRotateArgs);
export const AuthRotateResponse = response("auth_rotate", AuthRotateResult);

// --- the replicated records ------------------------------------------------

/** A registered passkey, as every instance in the cluster holds it.
 *
 * Complete once it is written: the instance that registered it is not asked
 * about it again, which is what lets a person authenticate anywhere in the
 * cluster while the instance they registered at is down. */
export const CredentialRecord = Type.Object(
  {
    kind: Type.Literal("credential"),
    sub: Subject,
    /** The credential's id as the authenticator names it, which is also what an
     * assertion is looked up by. */
    credential_id: Base64Url,
    /** The public key, COSE-encoded. */
    public_key: Base64Url,
    /** The `user_id` of the registration's claims, which is what the credential
     * was created against and what an assertion naming a handle is checked
     * against. */
    user_handle: Base64Url,
    /** The endpoint this credential was registered for, as the registration's
     * claims stated it.
     *
     * What the credential is good for, and the whole of it: an assertion is
     * accepted only where the origin matches and the request's path falls under
     * this base URL. `https://h.example/` and `https://h.example/personal/` are
     * two endpoints and take two registrations, even on one host and one
     * relying party — the RP ID says which domain an authenticator will answer
     * for, which is a coarser thing than which instance a person has been
     * admitted to. Binding to the base URL rather than the origin is what keeps
     * one instance's credential from being a way into its neighbour. */
    endpoint: Endpoint,
    /** The relying party this credential was created under, as the claims of
     * the registration that made it stated. Written by the registration and not
     * derived later: a passkey only answers for the domain it was made under,
     * so an assertion's `rpIdHash` is checked against this and not against
     * whatever the endpoint being reached happens to be. Absent only on a
     * record written before the field existed. */
    rp_id: Type.Optional(Type.String({ minLength: 1 })),
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
    /** The label the administrator put on the registration URL, carried over
     * from the claims it was spent against. */
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
  },
  { $id: "CredentialRecord" },
);
export type CredentialRecord = Static<typeof CredentialRecord>;

/** One person's tokens, in the generation that stands and the one before it.
 *
 * The previous generation is kept so that a reply lost on the way — the client
 * rotated, the answer never arrived, it retries — is answered rather than read
 * as a replay. Anything older than that is a stolen value being reused, and it
 * fails the whole family. */
export const TokenFamily = Type.Object(
  {
    kind: Type.Literal("token_family"),
    sub: Subject,
    /** The instance that minted the family and the only one that may write it. */
    iss: InstanceId,
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
     * longer, which fails the whole family.
     *
     * Written by the `iss` alone, like the rest of the family, and replicated,
     * so the memory survives that instance restarting and holds wherever the
     * reused value is presented. */
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
 * bring back what a person revoked. */
export const AuthTombstone = Type.Object(
  {
    kind: Type.Literal("tombstone"),
    sub: Subject,
    deleted_at: Timestamp,
    /** When the mark itself may be dropped. Absent on a credential's, which is
     * kept without end because the credential it refuses has none either. */
    expires_at: Type.Optional(Timestamp),
  },
  { $id: "AuthTombstone" },
);
export type AuthTombstone = Static<typeof AuthTombstone>;

/** One entry of the replicated set, under the key it is matched by. */
export const AuthRecord = Type.Object(
  {
    /** What this entry is, cluster-wide. Two instances writing one key hold the
     * same thing, and the later `updated_at` is what stands. */
    key: Type.String({ minLength: 1, maxLength: 256 }),
    updated_at: Timestamp,
    body: Type.Union([CredentialRecord, TokenFamily, AuthTombstone]),
  },
  { $id: "AuthRecord" },
);
export type AuthRecord = Static<typeof AuthRecord>;

/** The `auth_records` topic: how credentials and token families reach every
 * instance.
 *
 * Apart from the store because of who may read it. The store is the person's to
 * read and write, and these are secrets that authenticate them — a token read
 * out of the store would be the person's session, and a credential written into
 * it would be a new way in. Only instances subscribe, and a relay carries the
 * frames as the instance it is rather than on a person's behalf. */
export const AuthRecordsFrame = topicFrame(
  "auth_records",
  Type.Object({ records: Type.Array(AuthRecord) }),
);
