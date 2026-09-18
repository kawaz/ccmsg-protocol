import { type Static, Type } from "@sinclair/typebox";

/** A session id: the uuid Claude Code gives its own session. Globally unique,
 * so it names a session across the whole mesh without an instance prefix. */
export const Sid = Type.String({
  $id: "Sid",
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
});
export type Sid = Static<typeof Sid>;

/** Who sent a message: a session, or the person at the web UI.
 *
 * A person has no sid — the `user` role greets without one — so the sender of a
 * message cannot be a `Sid` alone. The literal is spelled out rather than left
 * as an absent field, because a reader has to tell "a person sent this" from "a
 * session sent this and the id was lost". Every session id remains a valid
 * sender, so a reader that only knew sids keeps working.
 *
 * There is one person per instance to a session's eye, so the literal carries
 * no id of its own; which browser it was is not a thing this contract names. */
export const Sender = Type.Union([Sid, Type.Literal("user")], { $id: "Sender" });
export type Sender = Static<typeof Sender>;

/** The sender that is the person rather than a session. */
export const USER_SENDER = "user" as const;

/** An instance id: an opaque random value an instance issues for itself once
 * and keeps for its life, held in its state directory.
 *
 * It names the instance and nothing else — where to reach it is the `Endpoint`
 * below, which may change without this changing. Everything that has to survive
 * an instance moving is keyed by this: `mid`, the store's keys, the issuer of a
 * credential record, a token family and a challenge.
 *
 * Hexadecimal of a fixed width, because the value appears inside composed
 * strings (`mid`) and in the store's keys, where a character that means
 * something to a reader of those — a separator, a case fold — would make two
 * ids that differ compare equal. The display name lives in config, never on
 * the wire. */
export const InstanceId = Type.String({
  $id: "InstanceId",
  pattern: "^[0-9a-f]{32}$",
});
export type InstanceId = Static<typeof InstanceId>;

/** A host name as a browser serializes one: lowercase labels, no uppercase, no
 * userinfo and no empty label — each of those is either a second spelling of
 * one host or a string no URL parser will take. */
const HOST_NAME = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*";

/** A host: a name as above, or an address literal in its brackets (no zone id,
 * which no URL parser takes). */
const HOST = `(?:${HOST_NAME}|\\[[0-9a-f:.]+\\])`;

/** A port in range, 1 to 65535. */
const PORT =
  "(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])";

/** A scheme and authority, with the scheme's own port left unspelled — a
 * browser omits it, so writing it would be a second name for one place. `tail`
 * closes the pattern: the end of the string for an origin, a path for a base
 * URL, and it is what the lookaheads read to know a port ended. */
function port(its: string): string {
  return `(?::(?!${its}(?:/|$))${PORT})?`;
}

function authority(tail: string): string {
  return `^(?:https://${HOST}${port("443")}|http://${HOST}${port("80")})${tail}`;
}

/** A base URL: an authority as above, then a path that ends in a slash and
 * carries no query or fragment. */
const BASE_URL = authority("(?:/[^?#\\s]*)?/$");

/** An origin a WebAuthn ceremony can be held at: `https` on a host that is a
 * domain, or `http` on one of the loopback names a browser trusts. The
 * lookahead is what keeps an IPv4 literal out, a bracketed IPv6 one being
 * outside `HOST_NAME` already. */
const CEREMONY_ORIGIN =
  `^(?:https://(?!\\d{1,3}(?:\\.\\d{1,3}){3}(?::|$))${HOST_NAME}${port("443")}` +
  `|http://(?:localhost|127\\.0\\.0\\.1|\\[::1\\])${port("80")})$`;

/** Where an instance is published: the base URL everything it serves hangs
 * under, ending in a slash and naming no route of its own.
 *
 * The routes are below it and are not part of it — `<endpoint>ws` for the
 * WebSocket, `<endpoint>mesh/…`, `<endpoint>auth/…`, `<endpoint>webhook/…`. All
 * of them keep the endpoint's own scheme: a WebSocket starts as an HTTP request
 * that upgrades, so there is no second spelling of the URL and nothing to
 * rewrite. Naming the base rather than one of
 * them is what lets a transport be added or replaced without the value that
 * identifies where an instance lives changing with it, and what lets the HTTP
 * routes be spelled without stripping a suffix off first.
 *
 * Compared as a whole string, path included (one origin
 * may host several instances, so an origin-level comparison would confuse
 * them). Every part of it is held to one spelling for that comparison's sake:
 * the trailing slash is required, so `/ccmsg` and `/ccmsg/` are not two
 * endpoints; the host is lowercase and the scheme's own port is left out, as a
 * browser would write them; an internationalized host is spelled in punycode,
 * which is what the wire carries anyway.
 *
 * Apart from `InstanceId` because the two answer different questions and change
 * on different occasions. This is what a peer dials, what the TLS certificate
 * is checked against and what the mesh handshake's `iss` / `aud` are compared
 * as — trust is rooted in the URL and nowhere else. Which instance answers
 * there is the id, which the handshake states and which an alias or a move does
 * not alter. */
export const Endpoint = Type.String({ $id: "Endpoint", pattern: BASE_URL });
export type Endpoint = Static<typeof Endpoint>;

/** Where a page was served from: a scheme and an authority and nothing else,
 * spelled as a browser spells it in the `Origin` header and in a credential's
 * `clientDataJSON` — no path, no trailing slash.
 *
 * The one unit this contract holds a page to. A credential names one of these
 * and a token family carries it over; nothing finer exists to name, a browser
 * writing a path into neither header nor `clientDataJSON`. Serving two
 * instances under one origin at different paths is therefore not a shape this
 * contract has: the two would be one place to every check made here. Where that
 * separation is wanted, the hosts are what a browser tells apart.
 *
 * Apart from `Endpoint` because the two are units of different size and answer
 * different questions. An endpoint says where an instance is dialed; an origin
 * says which site the page in front of a person came from, which is all the
 * browser's same-origin rules know about and all a page's own script cannot lie
 * about. One site may be the page for many endpoints, and one origin may carry
 * many instances, so neither is derivable from the other — and which instance a
 * person may enter is answered by ownership rather than by either of them.
 *
 * Held to the one spelling a browser serializes: a lowercase scheme, a
 * lowercase host, and a port only where it is not the scheme's own. No
 * userinfo, no path, no trailing slash, nothing else a URL may carry.
 *
 * Held to somewhere a WebAuthn ceremony could actually be held, too, which is
 * narrower than what a URL parser takes and is the authenticator's rule rather
 * than this contract's taste. A ceremony needs a secure context, so the scheme
 * is `https` — with `http` on the loopback names browsers treat as trustworthy,
 * which is what makes a page runnable on a development machine. And a relying
 * party is a domain, so the host may not be an address literal: `https://198.51.100.9`
 * is a perfectly good origin that could never hold a passkey. Writing it into
 * the type rather than leaving it to the daemon is what keeps the relying party
 * total over the values a record may carry — an origin no ceremony could run at
 * would be a credential that could never have been made, accepted and
 * replicated before anything noticed.
 *
 * The narrowness is the point rather than pedantry. Every use of this value is
 * a whole-string comparison — against an `Origin` header, against a
 * `clientDataJSON.origin`, against the members of a CORS answer — so a second
 * spelling of one site would be a record that never matches the site it names,
 * or an allowed origin that quietly admits nothing. */
export const Origin = Type.String({ $id: "Origin", pattern: CEREMONY_ORIGIN });
export type Origin = Static<typeof Origin>;

/** A delivery-frame id: `<instance id>/<counter>`, numbered by the instance
 * that issued the frame. It exists so `reply_to` can point at one frame; it is
 * not a cursor and carries no ordering across instances. */
export const Mid = Type.String({
  $id: "Mid",
  pattern: "^[0-9a-f]{32}/\\d+$",
});
export type Mid = Static<typeof Mid>;

/** A terminal a run lives in: `<scheme>:<id>`, where the scheme says whose
 * handle the id is and the id is that system's own spelling.
 *
 * The scheme is what lets a client tell a handle it can open from one it
 * cannot: `hyoui:<id>` is a terminal the gateway named in `terminal_gateway`
 * serves, and `terminalUrl` composes the URL for it. A handle under any other
 * scheme travels unchanged and is opened only by a client that knows that
 * system — which is the point of naming the scheme rather than leaving a bare
 * id every reader would have to guess the owner of. */
export const TerminalId = Type.String({
  $id: "TerminalId",
  pattern: "^[a-z][a-z0-9_-]*:[^\\s]+$",
});
export type TerminalId = Static<typeof TerminalId>;

/** Who a connection speaks as. Settled once by the greeting that opened it —
 * `hello.session`, `hello.user` or `hello.instance`, the op being what says
 * which — and fixed for the connection's life; the op attribute table's
 * `roles` is checked against it.
 *
 * Once means once: a second greeting on a connection whose identity is
 * already settled is refused with `bad_request`, whether it is the same one
 * again or another. */
export const Role = Type.Union(
  [Type.Literal("session"), Type.Literal("user"), Type.Literal("instance")],
  { $id: "Role" },
);
export type Role = Static<typeof Role>;

/** A capability name. `hello` returns the set this instance has, and an op
 * whose `capability` is outside that set answers `capability_unavailable`. */
export const Capability = Type.Union(
  [
    Type.Literal("fork"),
    Type.Literal("launcher"),
    /** A gateway webhook source is configured, so request activity arrives to
     * be pushed on the `llm.requests` topic. */
    Type.Literal("llm_events"),
    Type.Literal("llm_stats"),
    Type.Literal("llm_status"),
    Type.Literal("llm_usage"),
    Type.Literal("sandbox"),
    Type.Literal("terminal"),
    Type.Literal("translate"),
  ],
  { $id: "Capability" },
);
export type Capability = Static<typeof Capability>;

/** A Unix-milliseconds timestamp. Every wire field naming a point in time is
 * this type and ends in `_at`; durations carry their unit instead (`*_ms` /
 * `*_secs`). */
export const Timestamp = Type.Integer({ $id: "Timestamp", minimum: 0 });
export type Timestamp = Static<typeof Timestamp>;
