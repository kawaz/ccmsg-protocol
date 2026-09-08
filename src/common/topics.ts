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

/** How a subscriber folds a frame into what it already holds.
 *
 * Snapshot and delta share one payload type, which leaves one question the
 * shape cannot answer: what a later frame does to the value before it. Stating
 * it here means the daemon and the web UI fold the same way instead of each
 * keeping its own table of which topic behaves how. */
export const TOPIC_GRANULARITIES = [
  /** The frame is the whole value; it replaces everything held. */
  "whole",
  /** The frame is the whole of what its `instance` knows; it replaces that
   * instance's entries and leaves every other instance's alone. What the
   * subscriber holds is the union across instances. */
  "per_instance_whole",
  /** The frame carries the elements that changed, keyed by their own id.
   * Elements it does not mention are untouched, so a removal has to be a
   * marked element rather than an absence. */
  "element",
  /** The frame carries what has been added since the last one; the subscriber
   * appends and never rewrites what it already has. */
  "append",
  /** The frame is an occurrence, not a value. Nothing is held, so there is
   * nothing to snapshot: subscribing yields the next occurrence, never a
   * current state. */
  "event",
] as const;

export type TopicGranularity = (typeof TOPIC_GRANULARITIES)[number];

export interface TopicAttributes {
  readonly roles: readonly Role[];
  readonly capability?: Capability;
  /** How a later frame relates to the value already held. Every topic but an
   * `event` one opens with a `snapshot: true` frame. */
  readonly granularity: TopicGranularity;
}

/** Who may subscribe to what, and how the frames fold. The same question the
 * op table answers for ops: a subscribe from a role outside the set answers
 * `forbidden`, and one naming a capability the instance lacks answers
 * `capability_unavailable`. */
export const TOPIC_ATTRIBUTES = {
  inbox: { roles: ["session", "user"], granularity: "element" },
  notify: { roles: ["session", "user"], granularity: "event" },
  peers: { roles: ["session", "user"], granularity: "per_instance_whole" },
  agents: { roles: ["user"], granularity: "per_instance_whole" },
  session_errors: { roles: ["user"], granularity: "per_instance_whole" },
  llm_requests: {
    roles: ["user"],
    capability: "llm_events",
    granularity: "per_instance_whole",
  },
  llm_status: { roles: ["user"], capability: "llm_status", granularity: "per_instance_whole" },
  // One session lives on one instance, so its status has no other instance's
  // half to leave alone: the frame is simply the whole of it.
  session_status: { roles: ["user"], granularity: "whole" },
  transcript: { roles: ["user"], granularity: "append" },
  kv: { roles: ["user"], granularity: "element" },
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

/** How the frames of a topic name fold, taken from the name a subscriber
 * actually uses — `session_status:<sid>` rather than the kind behind it.
 * `undefined` for a name this generation does not define. */
export function topicGranularity(topic: string): TopicGranularity | undefined {
  const kind = topicKind(topic);
  return kind === undefined ? undefined : TOPIC_ATTRIBUTES[kind].granularity;
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
