import type { OpName } from "../attributes.ts";
import type { TopicKind } from "../common/topics.ts";
import * as common from "./common.ts";
import * as control from "./control.ts";
import * as messaging from "./messaging.ts";
import * as topics from "./topics.ts";

export * from "./common.ts";
export * from "./control.ts";
export * from "./envelope.ts";
export * from "./ids.ts";
export * from "./messaging.ts";
export * from "./topics.ts";

/** One request and one reply, as they travel. */
export interface OpFixture {
  readonly request: unknown;
  readonly response: unknown;
}

/** A representative frame for every op in the contract.
 *
 * These are the contract's own examples of its wire: an implementation checks
 * itself against them rather than writing its own copy of what a frame looks
 * like, which is the same reason the schemas live here and not in each
 * implementation. Every one of them passes the op's schema, which the
 * contract's tests hold it to. */
export const OP_FIXTURES = {
  "hello.session": { request: common.HELLO_SESSION_REQUEST, response: common.HELLO_RESPONSE },
  "hello.user": { request: common.HELLO_USER_REQUEST, response: common.HELLO_RESPONSE },
  "hello.instance": {
    request: common.HELLO_INSTANCE_REQUEST,
    response: common.HELLO_RESPONSE,
  },
  "instance.ping": {
    request: common.INSTANCE_PING_REQUEST,
    response: common.INSTANCE_PING_RESPONSE,
  },
  "instance.shutdown": {
    request: common.INSTANCE_SHUTDOWN_REQUEST,
    response: common.INSTANCE_SHUTDOWN_RESPONSE,
  },
  "session.stopping": {
    request: common.SESSION_STOPPING_REQUEST,
    response: common.SESSION_STOPPING_RESPONSE,
  },
  "topic.subscribe": {
    request: common.TOPIC_SUBSCRIBE_REQUEST,
    response: common.TOPIC_SUBSCRIBE_RESPONSE,
  },
  "topic.unsubscribe": {
    request: common.TOPIC_UNSUBSCRIBE_REQUEST,
    response: common.TOPIC_UNSUBSCRIBE_RESPONSE,
  },
  "auth.challenge": {
    request: common.AUTH_CHALLENGE_REQUEST,
    response: common.AUTH_CHALLENGE_RESPONSE,
  },
  "auth.register": {
    request: common.AUTH_REGISTER_REQUEST,
    response: common.AUTH_REGISTER_RESPONSE,
  },
  "auth.assert": { request: common.AUTH_ASSERT_REQUEST, response: common.AUTH_ASSERT_RESPONSE },
  "auth.token.refresh": {
    request: common.AUTH_TOKEN_REFRESH_REQUEST,
    response: common.AUTH_TOKEN_REFRESH_RESPONSE,
  },
  "auth.extend": { request: common.AUTH_EXTEND_REQUEST, response: common.AUTH_EXTEND_RESPONSE },
  "auth.resolve": { request: common.AUTH_RESOLVE_REQUEST, response: common.AUTH_RESOLVE_RESPONSE },
  "auth.rotate": { request: common.AUTH_ROTATE_REQUEST, response: common.AUTH_ROTATE_RESPONSE },

  "message.send": {
    request: messaging.MESSAGE_SEND_REQUEST,
    response: messaging.MESSAGE_SEND_RESPONSE,
  },
  "say.post": { request: messaging.SAY_POST_REQUEST, response: messaging.SAY_POST_RESPONSE },
  "say.unread.clear": {
    request: messaging.SAY_UNREAD_CLEAR_REQUEST,
    response: messaging.SAY_UNREAD_CLEAR_RESPONSE,
  },
  "notify.send": {
    request: messaging.NOTIFY_SEND_REQUEST,
    response: messaging.NOTIFY_SEND_RESPONSE,
  },

  "session.kill": {
    request: control.SESSION_KILL_REQUEST,
    response: control.SESSION_KILL_RESPONSE,
  },
  "session.rename": {
    request: control.SESSION_RENAME_REQUEST,
    response: control.SESSION_RENAME_RESPONSE,
  },
  "session.env.read": {
    request: control.SESSION_ENV_READ_REQUEST,
    response: control.SESSION_ENV_READ_RESPONSE,
  },
  "session.search": {
    request: control.SESSION_SEARCH_REQUEST,
    response: control.SESSION_SEARCH_RESPONSE,
  },
  "session.dump.write": {
    request: control.SESSION_DUMP_WRITE_REQUEST,
    response: control.SESSION_DUMP_WRITE_RESPONSE,
  },
  "dump.presets.read": {
    request: control.DUMP_PRESETS_READ_REQUEST,
    response: control.DUMP_PRESETS_READ_RESPONSE,
  },
  "transcript.read": {
    request: control.TRANSCRIPT_READ_REQUEST,
    response: control.TRANSCRIPT_READ_RESPONSE,
  },
  "transcript.items.read": {
    request: control.TRANSCRIPT_ITEMS_READ_REQUEST,
    response: control.TRANSCRIPT_ITEMS_READ_RESPONSE,
  },
  "session.fork.origin.read": {
    request: control.SESSION_FORK_ORIGIN_READ_REQUEST,
    response: control.SESSION_FORK_ORIGIN_READ_RESPONSE,
  },
  "session.forget": {
    request: control.SESSION_FORGET_REQUEST,
    response: control.SESSION_FORGET_RESPONSE,
  },

  "dir.list": { request: control.DIR_LIST_REQUEST, response: control.DIR_LIST_RESPONSE },
  "file.read": { request: control.FILE_READ_REQUEST, response: control.FILE_READ_RESPONSE },
  "file.write": { request: control.FILE_WRITE_REQUEST, response: control.FILE_WRITE_RESPONSE },
  "file.create": { request: control.FILE_CREATE_REQUEST, response: control.FILE_CREATE_RESPONSE },
  "file.edit": { request: control.FILE_EDIT_REQUEST, response: control.FILE_EDIT_RESPONSE },
  "file.delete": { request: control.FILE_DELETE_REQUEST, response: control.FILE_DELETE_RESPONSE },
  "file.find": { request: control.FILE_FIND_REQUEST, response: control.FILE_FIND_RESPONSE },
  "file.stat": {
    request: control.FILE_STAT_REQUEST,
    response: control.FILE_STAT_RESPONSE,
  },
  "dir.tree": { request: control.DIR_TREE_REQUEST, response: control.DIR_TREE_RESPONSE },

  "launcher.config.read": {
    request: control.LAUNCHER_CONFIG_READ_REQUEST,
    response: control.LAUNCHER_CONFIG_READ_RESPONSE,
  },
  "launcher.run": {
    request: control.LAUNCHER_RUN_REQUEST,
    response: control.LAUNCHER_RUN_RESPONSE,
  },
  "sandbox.grant": {
    request: control.SANDBOX_GRANT_REQUEST,
    response: control.SANDBOX_GRANT_RESPONSE,
  },
  "sandbox.revoke": {
    request: control.SANDBOX_REVOKE_REQUEST,
    response: control.SANDBOX_REVOKE_RESPONSE,
  },
  "translate.run": {
    request: control.TRANSLATE_RUN_REQUEST,
    response: control.TRANSLATE_RUN_RESPONSE,
  },
  "llm.usage.read": {
    request: control.LLM_USAGE_READ_REQUEST,
    response: control.LLM_USAGE_READ_RESPONSE,
  },
  "llm.stats.read": {
    request: control.LLM_STATS_READ_REQUEST,
    response: control.LLM_STATS_READ_RESPONSE,
  },

  "kv.read": { request: control.KV_READ_REQUEST, response: control.KV_READ_RESPONSE },
  "kv.write": { request: control.KV_WRITE_REQUEST, response: control.KV_WRITE_RESPONSE },
  "kv.delete": { request: control.KV_DELETE_REQUEST, response: control.KV_DELETE_RESPONSE },
} as const satisfies Record<OpName, OpFixture>;

/** A representative frame for every topic, each one the snapshot a subscriber
 * opens with or a change of the same shape. */
export const TOPIC_FIXTURES = {
  inbox: topics.INBOX_FRAME,
  notify: topics.NOTIFY_FRAME,
  peers: topics.PEERS_FRAME,
  instances: topics.INSTANCES_FRAME,
  agents: topics.AGENTS_FRAME,
  "session.status": topics.SESSION_STATUS_FRAME,
  transcript: topics.TRANSCRIPT_FRAME,
  "transcript.items": topics.TRANSCRIPT_ITEMS_FRAME,
  "session.errors": topics.SESSION_ERRORS_FRAME,
  "llm.requests": topics.LLM_REQUESTS_FRAME,
  "llm.status": topics.LLM_STATUS_FRAME,
  kv: topics.KV_FRAME,
  "auth.records": topics.AUTH_RECORDS_FRAME,
} as const satisfies Record<TopicKind, unknown>;
