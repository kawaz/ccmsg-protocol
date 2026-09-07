import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { InstanceId, Sid, Timestamp } from "../identifiers.ts";
import { upstream } from "../upstream.ts";

// ---------------------------------------------------------------------------
// quota
// ---------------------------------------------------------------------------

/** Asks the gateway what quota each credential has left.
 *
 * The instance fetches rather than the client: the gateway is an internal
 * address a browser could not reach anyway, and routing the call keeps that
 * address out of the browser entirely. The reply takes as long as the fetch. */
export const LlmUsageReadArgs = Type.Object({
  /** Have the gateway ask upstream instead of answering from its cache. Only a
   * probe carries the per-credential limits, and it is the only request that
   * can spend upstream rate limit — an account already limited answers a probe
   * with a refusal that arrives as that credential's error. So this belongs to
   * a deliberate action and never to polling. */
  refresh: Type.Optional(Type.Boolean()),
});
export type LlmUsageReadArgs = Static<typeof LlmUsageReadArgs>;

/** One rolling quota window of one credential. */
export const LlmUsageWindow = Type.Object(
  {
    /** Share of the window's quota already spent, from 0 to 1. Values above 1
     * happen and are not clamped. */
    utilization: Type.Number(),
    /** The provider's verdict for the window. An open set, kept as sent: an
     * unknown verdict has to reach the screen as itself rather than be
     * flattened into a wrong one. */
    status: Type.String(),
    /** When the window's counter rolls over. */
    reset_at: Type.Optional(Timestamp),
    /** How long the window is. The provider states it rather than leaving it to
     * be read out of the window's name, because a name can describe a slot
     * whose length differs between providers. Absent means unknown. */
    window_secs: Type.Optional(Type.Integer({ minimum: 0 })),
    /** The reading predates the reset, so it is not current consumption. Without
     * this, a week-old figure over 100% reads as a credential that is out of
     * quota right now. */
    expired: Type.Optional(Type.Boolean()),
  },
  {
    $id: "LlmUsageWindow",
    ...upstream("llm-gateway", "one quota window as the provider states it"),
  },
);
export type LlmUsageWindow = Static<typeof LlmUsageWindow>;

/** Extra-credit spending, which belongs to the credential rather than to any
 * one window: a credential can be out of credits with every window still
 * allowed. */
export const LlmUsageOverage = Type.Object(
  {
    status: Type.String(),
    disabled_reason: Type.Optional(Type.String()),
  },
  { $id: "LlmUsageOverage" },
);
export type LlmUsageOverage = Static<typeof LlmUsageOverage>;

/** One reading of a credential's quota. It can lag the reply that carries it by
 * minutes when the gateway has seen no traffic on that credential, which is why
 * it states when it was taken. */
export const LlmUsageSnapshot = Type.Object(
  {
    observed_at: Type.Optional(Timestamp),
    overage: Type.Optional(LlmUsageOverage),
    /** Window name to window, names as the provider gives them. A map rather
     * than named fields so a provider that starts reporting a third window
     * appears without a change here. */
    windows: Type.Record(Type.String(), LlmUsageWindow),
  },
  { $id: "LlmUsageSnapshot" },
);
export type LlmUsageSnapshot = Static<typeof LlmUsageSnapshot>;

/** A named limit the provider enforces beside the rolling windows. */
export const LlmUsageLimit = Type.Object(
  {
    /** Which limit this is, in the provider's vocabulary. An open set. */
    kind: Type.String(),
    /** Share spent, as a percentage from 0 to 100 — deliberately not the same
     * unit as a window's utilization, because this is the provider's own figure
     * and the wire stays a faithful copy of it. */
    percent: Type.Number(),
    /** The provider's own verdict. An open set. */
    severity: Type.String(),
    /** Absent for a limit with no scheduled reset. */
    resets_at: Type.Optional(Timestamp),
    /** The model family a scoped limit applies to, as a display name. */
    model: Type.Optional(Type.String()),
    /** The provider is currently counting against this limit. Not a statement
     * that it is blocking anything: an idle limit can sit near its ceiling and
     * an active one near zero. */
    is_active: Type.Optional(Type.Boolean()),
    /** How long the limit's period is, as the provider states it rather than as
     * inferred from its kind. Absent means unknown. */
    window_secs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { $id: "LlmUsageLimit" },
);
export type LlmUsageLimit = Static<typeof LlmUsageLimit>;

/** How the credential's own authentication is holding up. Separate from its
 * quota readings: a credential whose login has expired still has its last
 * snapshot, and nothing in that snapshot says why the numbers stopped moving. */
export const LlmUsageAuth = Type.Object(
  {
    /** An open set. Anything unfamiliar means there is nothing to announce, not
     * that something is wrong. */
    status: Type.String(),
    /** What to do about it, in the gateway's words. Present when the status is
     * not a healthy one. */
    reason: Type.Optional(Type.String()),
    observed_at: Type.Optional(Timestamp),
    /** Where a person can log in again. Absolute: the gateway states a path,
     * since it does not know the address it is published under, and the instance
     * resolves it against the endpoint it fetched — resolving it a second time
     * against a client's own address would point at the wrong host. Present only
     * for a credential a browser can actually re-authenticate. */
    login_url: Type.Optional(Type.String()),
  },
  { $id: "LlmUsageAuth" },
);
export type LlmUsageAuth = Static<typeof LlmUsageAuth>;

export const LlmUsageCredential = Type.Object(
  {
    name: Type.String(),
    /** What kind of credential it is. An open set. */
    type: Type.Optional(Type.String()),
    /** Whether quota is knowable for this credential at all: observed, not
     * applicable, or dependent on something further upstream. An open set. */
    support: Type.String(),
    /** Absent means nothing is known about the authentication, never that it is
     * healthy. */
    auth: Type.Optional(LlmUsageAuth),
    /** Present when quota is observed for this credential. */
    snapshot: Type.Optional(LlmUsageSnapshot),
    /** In the provider's order. Absent means none were reported, which a client
     * shows as nothing rather than as a fault. */
    limits: Type.Optional(Type.Array(LlmUsageLimit)),
    /** Why the last refresh of this credential failed. Whatever snapshot sits
     * beside it is the last good reading, and its time says how old that is. */
    probe_error: Type.Optional(Type.String()),
  },
  { $id: "LlmUsageCredential" },
);
export type LlmUsageCredential = Static<typeof LlmUsageCredential>;

export const LlmUsageReadResult = Type.Object({
  /** When the gateway assembled the answer. */
  generated_at: Type.Optional(Timestamp),
  credentials: Type.Array(LlmUsageCredential),
});
export type LlmUsageReadResult = Static<typeof LlmUsageReadResult>;

export const LlmUsageReadRequest = request("llm_usage_read", LlmUsageReadArgs);
export const LlmUsageReadResponse = response("llm_usage_read", LlmUsageReadResult);

// ---------------------------------------------------------------------------
// spend
// ---------------------------------------------------------------------------

/** Asks the gateway what the host's credentials have cost, by day. */
export const LlmStatsReadArgs = Type.Object({
  /** How far back to ask for. The gateway narrows a request wider than its own
   * history, so asking for more than it holds is the supported way to say
   * "everything". Absent leaves the gateway's own default. */
  days: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type LlmStatsReadArgs = Static<typeof LlmStatsReadArgs>;

/** What one model cost on one day under one credential. Every counter is
 * optional and passed through as sent: which counters exist is the gateway's to
 * decide, and a missing one has to read as "not reported" rather than as a zero
 * something would then add up. */
export const LlmStatsModelUsage = Type.Object(
  {
    requests: Type.Optional(Type.Integer({ minimum: 0 })),
    input_tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    output_tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cache_creation_input_tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    cache_read_input_tokens: Type.Optional(Type.Integer({ minimum: 0 })),
    /** Spend in USD. */
    usd: Type.Optional(Type.Number()),
  },
  { $id: "LlmStatsModelUsage" },
);
export type LlmStatsModelUsage = Static<typeof LlmStatsModelUsage>;

/** One day's spend, by credential and then by model. */
export const LlmStatsDay = Type.Object(
  {
    credentials: Type.Record(Type.String(), Type.Record(Type.String(), LlmStatsModelUsage)),
    /** The gateway's own total, kept rather than recomputed: it is the
     * authoritative figure, and it can differ from the sum when the gateway
     * counts something it does not break out. */
    total_usd: Type.Optional(Type.Number()),
  },
  { $id: "LlmStatsDay" },
);
export type LlmStatsDay = Static<typeof LlmStatsDay>;

export const LlmStatsReadResult = Type.Object({
  generated_at: Type.Optional(Timestamp),
  /** Keyed `YYYY-MM-DD` in the gateway's own timezone. A day here means
   * whatever the gateway means by it; nothing reinterprets the dates. */
  days: Type.Record(Type.String(), LlmStatsDay),
});
export type LlmStatsReadResult = Static<typeof LlmStatsReadResult>;

export const LlmStatsReadRequest = request("llm_stats_read", LlmStatsReadArgs);
export const LlmStatsReadResponse = response("llm_stats_read", LlmStatsReadResult);

// ---------------------------------------------------------------------------
// live requests
// ---------------------------------------------------------------------------

/** How long a prompt cache window is assumed to last when an event states
 * neither its deadline nor where the request came from. Both sides count down
 * to the same instant, so the assumption has to be shared; whenever the gateway
 * states the real length, that wins over this. */
export const LLM_PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;

/** One request the gateway saw go upstream.
 *
 * The session id is the one the gateway read off the request, which is the same
 * identifier sessions are known by here — that shared key is what lets a client
 * put a countdown on a session. Requests the gateway could not attribute to a
 * session never appear. */
export const LlmRequestInfo = Type.Object(
  {
    /** When the upstream response headers arrived, which is when the prompt
     * cache starts running down — not when the request was sent. */
    received_at: Timestamp,
    sid: Sid,
    /** The instance whose gateway saw it. */
    instance: InstanceId,
    /** Names the conversation series: a session's subagents travel under the
     * same session id but a different series, and their caches are genuinely
     * separate, so a cache window belongs to the pair and never to the session
     * alone. Absent when the gateway reports none, which collapses those events
     * into one unnamed series per session. Series names are not unique across
     * sessions, which is the other half of why the pair is the key. */
    prefix: Type.Optional(Type.String()),
    /** True for the series the session's own turns keep warm, as opposed to a
     * subagent's. The instance decides it so that every client agrees on which
     * window is the session's. */
    main: Type.Boolean(),
    /** Whose turn issued the request, as the gateway read it. An open set; this
     * is one of the inputs to `main`, and `main` is the verdict clients read. */
    origin: Type.Optional(Type.String()),
    /** When this series' cache goes cold, as the gateway computed it. Absent
     * when the request cached nothing, in which case the window closed as it
     * opened. A keepalive arrives as another event on the same series, so a live
     * window's end keeps moving. */
    cache_expires_at: Type.Optional(Timestamp),
    /** The cache length the gateway asked for. */
    cache_ttl_secs: Type.Optional(Type.Integer({ minimum: 0 })),
    /** The gateway is holding off on keepalives for this series. Stated on
     * every event of a series the strategy covers, so absent means the series is
     * not one it keeps alive — never that keepalives are running. */
    cache_paused: Type.Optional(Type.Boolean()),
    /** The real request that began the current keepalive chain. The same value
     * on the request and on every keepalive's return, which is what makes it the
     * chain's fixed origin while the other instants walk forward. */
    cache_since_at: Type.Optional(Timestamp),
    /** Position in the chain: zero on the real request. */
    cache_count: Type.Optional(Type.Integer({ minimum: 0 })),
    /** When the gateway plans to send the next keepalive. Absent when it plans
     * none. */
    next_keepalive_at: Type.Optional(Timestamp),
    /** Where the chain is projected to end, and how many keepalives that takes.
     * A projection recomputed per event, so the newest event's value replaces
     * the previous one rather than being merged with it. */
    cache_until_at: Type.Optional(Timestamp),
    cache_until_count: Type.Optional(Type.Integer({ minimum: 0 })),
    /** Past this, keeping the cache warm costs more than rebuilding it. Omitted
     * for models whose price the gateway does not know. */
    cache_breakeven_until_at: Type.Optional(Timestamp),
    cache_breakeven_count: Type.Optional(Type.Integer({ minimum: 0 })),
    /** Present only on a keepalive's return trip, carrying how the gateway
     * judged it. Its absence is how an ordinary request is told apart. */
    keepalive: Type.Optional(Type.String()),
    ns: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    credential: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer()),
  },
  {
    $id: "LlmRequestInfo",
    ...upstream("llm-gateway", "one observed request, renamed and re-united from its event"),
  },
);
export type LlmRequestInfo = Static<typeof LlmRequestInfo>;

/** When the cache window one request opened closes.
 *
 * The instance prunes by it and clients draw to it, so the arithmetic lives
 * here once instead of once per side. A request that states where it came from
 * but names no deadline is the gateway saying it cached nothing; only an event
 * that states neither falls back to the assumed length. */
export function llmCacheWindowEndAt(info: {
  received_at: number;
  cache_expires_at?: number;
  origin?: string;
}): number {
  if (info.cache_expires_at !== undefined) return info.cache_expires_at;
  if (info.origin !== undefined) return info.received_at;
  return info.received_at + LLM_PROMPT_CACHE_TTL_MS;
}

/** The `llm_requests` topic: the newest request per conversation series, always
 * the whole unexpired set rather than the one that just arrived. A client that
 * starts listening mid-window still needs the countdown that began before it
 * was there, and one shape serves both that and the live update. An empty set
 * is a legitimate "no session has a warm cache". */
export const LlmRequestsFrame = topicFrame("llm_requests", Type.Array(LlmRequestInfo));

// ---------------------------------------------------------------------------
// upstream health
// ---------------------------------------------------------------------------

/** The gateway's display verdict, for one service and for the report as a
 * whole. Nothing recomputes it here: the gateway knows which of the two signals
 * below outweighs the other, and a second opinion would disagree with every
 * other reader of the same report. A value outside this set becomes `unknown`
 * rather than travelling, so a future vocabulary cannot arrive as a word
 * nothing can render. */
export const LlmStatusSeverity = Type.Union(
  [Type.Literal("ok"), Type.Literal("warning"), Type.Literal("critical"), Type.Literal("unknown")],
  { $id: "LlmStatusSeverity" },
);
export type LlmStatusSeverity = Static<typeof LlmStatusSeverity>;

/** What the provider's own status page says. A closed vocabulary; anything
 * else, including a page that could not be read, is `unknown`. */
export const LlmStatusOfficialState = Type.Union(
  [
    Type.Literal("operational"),
    Type.Literal("degraded"),
    Type.Literal("partial_outage"),
    Type.Literal("major_outage"),
    Type.Literal("maintenance"),
    Type.Literal("unknown"),
  ],
  { $id: "LlmStatusOfficialState" },
);
export type LlmStatusOfficialState = Static<typeof LlmStatusOfficialState>;

/** What the gateway itself saw. Deliberately worded apart from the official
 * vocabulary, so the two signals can never be mistaken for each other. */
export const LlmStatusObservedState = Type.Union(
  [Type.Literal("reachable"), Type.Literal("failing"), Type.Literal("unknown")],
  { $id: "LlmStatusObservedState" },
);
export type LlmStatusObservedState = Static<typeof LlmStatusObservedState>;

export const LlmStatusComponent = Type.Object(
  {
    id: Type.Optional(Type.String()),
    name: Type.String(),
    state: LlmStatusOfficialState,
  },
  { $id: "LlmStatusComponent" },
);
export type LlmStatusComponent = Static<typeof LlmStatusComponent>;

/** One unresolved incident from the provider's status page. Everything but the
 * title is optional — a line with a title alone is still worth showing. All of
 * it is the provider's prose, to be shown as text and never as markup. */
export const LlmStatusIncident = Type.Object(
  {
    id: Type.Optional(Type.String()),
    name: Type.String(),
    /** The provider's own workflow word. An open set, shown as it stands. */
    state: Type.Optional(Type.String()),
    impact: Type.Optional(Type.String()),
    created_at: Type.Optional(Timestamp),
    updated_at: Type.Optional(Timestamp),
    url: Type.Optional(Type.String()),
    latest_update: Type.Optional(Type.String()),
    /** Says the incident carries no component mapping, so it is shown for
     * reference and did not raise this service's severity. */
    scope: Type.Optional(Type.String()),
  },
  { $id: "LlmStatusIncident" },
);
export type LlmStatusIncident = Static<typeof LlmStatusIncident>;

export const LlmStatusOfficial = Type.Object(
  {
    state: LlmStatusOfficialState,
    /** How the gateway obtained it. */
    source: Type.Optional(Type.String()),
    /** The human-readable status page. */
    source_url: Type.Optional(Type.String()),
    observed_at: Type.Optional(Timestamp),
    /** The reading is older than the gateway's freshness bound: what is shown
     * is the last success, not a current reading. */
    stale: Type.Optional(Type.Boolean()),
    components: Type.Array(LlmStatusComponent),
    incidents: Type.Array(LlmStatusIncident),
    /** Why the last read failed. The previous good state is kept beside it
     * rather than replaced by the failure. */
    error: Type.Optional(Type.String()),
  },
  { $id: "LlmStatusOfficial" },
);
export type LlmStatusOfficial = Static<typeof LlmStatusOfficial>;

export const LlmStatusObserved = Type.Object(
  {
    state: LlmStatusObservedState,
    observed_at: Type.Optional(Timestamp),
    /** When the observation stops counting and the state falls back to
     * unknown. */
    expires_at: Type.Optional(Timestamp),
    last_success_at: Type.Optional(Timestamp),
    last_failure: Type.Optional(
      Type.Object({
        at: Type.Optional(Timestamp),
        /** What kind of failure it was. An open set. */
        kind: Type.Optional(Type.String()),
        /** The HTTP status, when the failure had one. */
        status: Type.Optional(Type.Integer()),
      }),
    ),
  },
  { $id: "LlmStatusObserved" },
);
export type LlmStatusObserved = Static<typeof LlmStatusObserved>;

/** One upstream service, with the two signals kept apart. Both may be absent —
 * a gateway can report a service it has neither read about nor exercised —
 * while the severity is always there, since that is what a display is chosen
 * from. */
export const LlmStatusService = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    severity: LlmStatusSeverity,
    /** Which configured routes draw on this service. */
    routes: Type.Array(Type.String()),
    official: Type.Optional(LlmStatusOfficial),
    observed: Type.Optional(LlmStatusObserved),
  },
  { $id: "LlmStatusService" },
);
export type LlmStatusService = Static<typeof LlmStatusService>;

/** The worst severity across services, with the breakdown that keeps "one
 * critical among many healthy" from reading as "everything is down". */
export const LlmStatusOverall = Type.Object(
  {
    severity: LlmStatusSeverity,
    /** Severity to how many services hold it. A map rather than named fields so
     * a future severity needs no change here. */
    service_counts: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
  },
  { $id: "LlmStatusOverall" },
);
export type LlmStatusOverall = Static<typeof LlmStatusOverall>;

/** The gateway's report on the services behind it.
 *
 * It has no op of its own: a client subscribes and receives the current report
 * as the snapshot, then a fresh one whenever the gateway reports trouble and
 * the instance re-reads. That moment is exactly when a display has to change
 * and the one moment a client cannot anticipate. */
export const LlmStatusReport = Type.Object(
  {
    /** The gateway's own version of this document's shape. Passed through
     * rather than gated on: every field degrades on its own, so a newer document
     * arrives as unknowns instead of as nothing. */
    schema_version: Type.Optional(Type.Integer({ minimum: 0 })),
    generated_at: Type.Optional(Timestamp),
    overall: LlmStatusOverall,
    services: Type.Array(LlmStatusService),
  },
  {
    $id: "LlmStatusReport",
    ...upstream("llm-gateway", "the gateway's upstream-service report, renamed only"),
  },
);
export type LlmStatusReport = Static<typeof LlmStatusReport>;

/** The `llm_status` topic. Whole-value: each frame replaces the last. */
export const LlmStatusFrame = topicFrame("llm_status", LlmStatusReport);
