import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import type { Capability, Role } from "../identifiers.ts";

/** Topics naming one thing for the whole instance. */
export const PLAIN_TOPICS = [
  "inbox",
  "notify",
  "peers",
  "agents",
  "session_errors",
  "llm_requests",
  "llm_status",
] as const;

/** Topics naming one session, written `<topic>:<sid>`. */
export const SESSION_SCOPED_TOPICS = ["session_status", "transcript"] as const;

/** Topics naming one namespace, written `<topic>:<ns>`. The parameter is a name
 * its users choose rather than an identifier this contract issues, so it is
 * spelled apart from the session-scoped topics above. */
export const NAMESPACE_SCOPED_TOPICS = ["kv"] as const;

/** What a namespace may be called. Kept to an identifier because the name
 * appears inside a topic name, where a separator or a space would make the two
 * halves impossible to tell apart. */
export const NAMESPACE_PATTERN = "[a-z][a-z0-9_]{0,63}";

export type PlainTopic = (typeof PLAIN_TOPICS)[number];
export type SessionScopedTopic = (typeof SESSION_SCOPED_TOPICS)[number];
export type NamespaceScopedTopic = (typeof NAMESPACE_SCOPED_TOPICS)[number];
export type TopicName =
  | PlainTopic
  | `${SessionScopedTopic}:${string}`
  | `${NamespaceScopedTopic}:${string}`;

export const Topic = Type.String({
  $id: "Topic",
  pattern: [
    "^(?:",
    PLAIN_TOPICS.join("|"),
    `|(?:${SESSION_SCOPED_TOPICS.join("|")}):[0-9a-f-]{36}`,
    `|(?:${NAMESPACE_SCOPED_TOPICS.join("|")}):${NAMESPACE_PATTERN}`,
    ")$",
  ].join(""),
});

export interface TopicAttributes {
  readonly roles: readonly Role[];
  readonly capability?: Capability;
}

/** Who may subscribe to what. The same question the op table answers for ops:
 * a subscribe from a role outside the set answers `forbidden`, and one naming
 * a capability the instance lacks answers `capability_unavailable`. */
export const TOPIC_ATTRIBUTES = {
  inbox: { roles: ["session", "user"] },
  notify: { roles: ["session", "user"] },
  peers: { roles: ["session", "user"] },
  agents: { roles: ["user"] },
  session_errors: { roles: ["user"] },
  llm_requests: { roles: ["user"], capability: "llm_events" },
  llm_status: { roles: ["user"], capability: "llm_status" },
  session_status: { roles: ["user"] },
  transcript: { roles: ["user"] },
  kv: { roles: ["user"] },
} as const satisfies Record<
  PlainTopic | SessionScopedTopic | NamespaceScopedTopic,
  TopicAttributes
>;

export type TopicKind = PlainTopic | SessionScopedTopic | NamespaceScopedTopic;

/** The part of a topic name before any `:` — the key into TOPIC_ATTRIBUTES. */
export function topicKind(topic: string): TopicKind | undefined {
  const head = topic.split(":", 1)[0] as TopicKind;
  return head in TOPIC_ATTRIBUTES ? head : undefined;
}

export const TopicSubscribeArgs = Type.Object({ topic: Topic });
export type TopicSubscribeArgs = Static<typeof TopicSubscribeArgs>;

/** The reply only acknowledges the subscription. The value itself arrives as
 * the first frame, marked `snapshot: true`, so a subscriber has one code path
 * for the current value and for every change after it. */
export const TopicSubscribeResult = Type.Object({ topic: Topic });
export type TopicSubscribeResult = Static<typeof TopicSubscribeResult>;

export const TopicSubscribeRequest = request("topic_subscribe", TopicSubscribeArgs);
export const TopicSubscribeResponse = response("topic_subscribe", TopicSubscribeResult);

export const TopicUnsubscribeArgs = Type.Object({ topic: Topic });
export type TopicUnsubscribeArgs = Static<typeof TopicUnsubscribeArgs>;

export const TopicUnsubscribeResult = Type.Object({ topic: Topic });
export type TopicUnsubscribeResult = Static<typeof TopicUnsubscribeResult>;

export const TopicUnsubscribeRequest = request("topic_unsubscribe", TopicUnsubscribeArgs);
export const TopicUnsubscribeResponse = response("topic_unsubscribe", TopicUnsubscribeResult);
