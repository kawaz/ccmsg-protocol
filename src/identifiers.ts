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

/** A host as a browser serializes one: lowercase labels, or an address literal
 * in its brackets. No uppercase, no userinfo, no empty label and no zone id —
 * every one of those is either a second spelling of one host or a string no URL
 * parser will take. */
const HOST =
  "(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\\[[0-9a-f:.]+\\])";

/** A port in range, 1 to 65535. */
const PORT =
  "(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])";

/** A scheme and authority, with the scheme's own port left unspelled — a
 * browser omits it, so writing it would be a second name for one place. `tail`
 * closes the pattern: the end of the string for an origin, a path for a base
 * URL, and it is what the lookaheads read to know a port ended. */
function authority(tail: string): string {
  const port = (its: string) => `(?::(?!${its}(?:/|$))${PORT})?`;
  return `^(?:https://${HOST}${port("443")}|http://${HOST}${port("80")})${tail}`;
}

/** A base URL: an authority as above, then a path that ends in a slash and
 * carries no query or fragment. */
const BASE_URL = authority("(?:/[^?#\\s]*)?/$");

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

/** Where the web UI is published: the base URL a person opens it at, ending in
 * a slash and naming no route of its own (`https://ui.example/ccmsg/`).
 *
 * The counterpart of `Endpoint` on the other side of the wire. An endpoint says
 * where an instance is dialed; this says where the page doing the dialing came
 * from, and one of each is what a credential is made against. Spelled to the
 * same rule as an endpoint, path and trailing slash included, because it is the
 * same kind of value: a base URL that something is published under, of which
 * several may share one host.
 *
 * What is compared against a browser's `Origin` is narrower than this — the
 * scheme and authority alone, which `originOf` derives. The URL is what is
 * stored because it is what a person is sent to and what an operator
 * configures; the origin is read off it whenever a header has to be matched,
 * rather than being kept beside it as a second field that could disagree. */
export const WebUi = Type.String({ $id: "WebUi", pattern: BASE_URL });
export type WebUi = Static<typeof WebUi>;

/** Where a page was served from: a scheme and an authority and nothing else,
 * spelled as a browser spells it in the `Origin` header and in a credential's
 * `clientDataJSON` — no path, no trailing slash.
 *
 * Apart from `Endpoint` because the two are units of different size and answer
 * different questions. An endpoint says which instance a person is admitted to
 * and is compared with its path; an origin says which site the page in front of
 * them came from, which is all the browser's same-origin rules know about and
 * all a page's own script cannot lie about. One site may be the page for many
 * endpoints, and one origin may carry many instances, so neither is derivable
 * from the other.
 *
 * Held to the one spelling a browser serializes: a lowercase scheme, a
 * lowercase host, and a port only where it is not the scheme's own. No
 * userinfo, no path, no trailing slash, nothing else a URL may carry.
 *
 * The narrowness is the point rather than pedantry. Every use of this value is
 * a whole-string comparison — against an `Origin` header, against a
 * `clientDataJSON.origin`, against the members of a CORS answer — so a second
 * spelling of one site would be a record that never matches the site it names,
 * or an allowed origin that quietly admits nothing. */
export const Origin = Type.String({ $id: "Origin", pattern: authority("$") });
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
