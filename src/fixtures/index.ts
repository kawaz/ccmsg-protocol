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
  hello: { request: common.HELLO_REQUEST, response: common.HELLO_RESPONSE },
  instance_ping: {
    request: common.INSTANCE_PING_REQUEST,
    response: common.INSTANCE_PING_RESPONSE,
  },
  instance_shutdown: {
    request: common.INSTANCE_SHUTDOWN_REQUEST,
    response: common.INSTANCE_SHUTDOWN_RESPONSE,
  },
  session_stopping: {
    request: common.SESSION_STOPPING_REQUEST,
    response: common.SESSION_STOPPING_RESPONSE,
  },
  topic_subscribe: {
    request: common.TOPIC_SUBSCRIBE_REQUEST,
    response: common.TOPIC_SUBSCRIBE_RESPONSE,
  },
  topic_unsubscribe: {
    request: common.TOPIC_UNSUBSCRIBE_REQUEST,
    response: common.TOPIC_UNSUBSCRIBE_RESPONSE,
  },
  auth_challenge: {
    request: common.AUTH_CHALLENGE_REQUEST,
    response: common.AUTH_CHALLENGE_RESPONSE,
  },
  auth_register: {
    request: common.AUTH_REGISTER_REQUEST,
    response: common.AUTH_REGISTER_RESPONSE,
  },
  auth_assert: { request: common.AUTH_ASSERT_REQUEST, response: common.AUTH_ASSERT_RESPONSE },
  auth_refresh_token: {
    request: common.AUTH_REFRESH_TOKEN_REQUEST,
    response: common.AUTH_REFRESH_TOKEN_RESPONSE,
  },
  auth_refresh: { request: common.AUTH_REFRESH_REQUEST, response: common.AUTH_REFRESH_RESPONSE },
  auth_resolve: { request: common.AUTH_RESOLVE_REQUEST, response: common.AUTH_RESOLVE_RESPONSE },
  auth_rotate: { request: common.AUTH_ROTATE_REQUEST, response: common.AUTH_ROTATE_RESPONSE },

  message_send: {
    request: messaging.MESSAGE_SEND_REQUEST,
    response: messaging.MESSAGE_SEND_RESPONSE,
  },
  say_post: { request: messaging.SAY_POST_REQUEST, response: messaging.SAY_POST_RESPONSE },
  say_mark_read: {
    request: messaging.SAY_MARK_READ_REQUEST,
    response: messaging.SAY_MARK_READ_RESPONSE,
  },
  notify_send: { request: messaging.NOTIFY_SEND_REQUEST, response: messaging.NOTIFY_SEND_RESPONSE },

  session_kill: { request: control.SESSION_KILL_REQUEST, response: control.SESSION_KILL_RESPONSE },
  session_rename: {
    request: control.SESSION_RENAME_REQUEST,
    response: control.SESSION_RENAME_RESPONSE,
  },
  session_env_read: {
    request: control.SESSION_ENV_READ_REQUEST,
    response: control.SESSION_ENV_READ_RESPONSE,
  },
  session_search: {
    request: control.SESSION_SEARCH_REQUEST,
    response: control.SESSION_SEARCH_RESPONSE,
  },
  session_dump_write: {
    request: control.SESSION_DUMP_WRITE_REQUEST,
    response: control.SESSION_DUMP_WRITE_RESPONSE,
  },
  dump_presets_read: {
    request: control.DUMP_PRESETS_READ_REQUEST,
    response: control.DUMP_PRESETS_READ_RESPONSE,
  },
  transcript_read: {
    request: control.TRANSCRIPT_READ_REQUEST,
    response: control.TRANSCRIPT_READ_RESPONSE,
  },
  transcript_items_read: {
    request: control.TRANSCRIPT_ITEMS_READ_REQUEST,
    response: control.TRANSCRIPT_ITEMS_READ_RESPONSE,
  },
  session_fork_origin: {
    request: control.SESSION_FORK_ORIGIN_REQUEST,
    response: control.SESSION_FORK_ORIGIN_RESPONSE,
  },
  session_last_live_remove: {
    request: control.SESSION_LAST_LIVE_REMOVE_REQUEST,
    response: control.SESSION_LAST_LIVE_REMOVE_RESPONSE,
  },

  dir_list: { request: control.DIR_LIST_REQUEST, response: control.DIR_LIST_RESPONSE },
  file_read: { request: control.FILE_READ_REQUEST, response: control.FILE_READ_RESPONSE },
  file_write: { request: control.FILE_WRITE_REQUEST, response: control.FILE_WRITE_RESPONSE },
  file_create: { request: control.FILE_CREATE_REQUEST, response: control.FILE_CREATE_RESPONSE },
  file_edit: { request: control.FILE_EDIT_REQUEST, response: control.FILE_EDIT_RESPONSE },
  file_delete: { request: control.FILE_DELETE_REQUEST, response: control.FILE_DELETE_RESPONSE },
  file_find: { request: control.FILE_FIND_REQUEST, response: control.FILE_FIND_RESPONSE },
  file_stat_batch: {
    request: control.FILE_STAT_BATCH_REQUEST,
    response: control.FILE_STAT_BATCH_RESPONSE,
  },
  dir_tree: { request: control.DIR_TREE_REQUEST, response: control.DIR_TREE_RESPONSE },

  launcher_config_read: {
    request: control.LAUNCHER_CONFIG_READ_REQUEST,
    response: control.LAUNCHER_CONFIG_READ_RESPONSE,
  },
  launcher_run: { request: control.LAUNCHER_RUN_REQUEST, response: control.LAUNCHER_RUN_RESPONSE },
  sandbox_grant: {
    request: control.SANDBOX_GRANT_REQUEST,
    response: control.SANDBOX_GRANT_RESPONSE,
  },
  sandbox_revoke: {
    request: control.SANDBOX_REVOKE_REQUEST,
    response: control.SANDBOX_REVOKE_RESPONSE,
  },
  translate_run: {
    request: control.TRANSLATE_RUN_REQUEST,
    response: control.TRANSLATE_RUN_RESPONSE,
  },
  llm_usage_read: {
    request: control.LLM_USAGE_READ_REQUEST,
    response: control.LLM_USAGE_READ_RESPONSE,
  },
  llm_stats_read: {
    request: control.LLM_STATS_READ_REQUEST,
    response: control.LLM_STATS_READ_RESPONSE,
  },

  kv_read: { request: control.KV_READ_REQUEST, response: control.KV_READ_RESPONSE },
  kv_write: { request: control.KV_WRITE_REQUEST, response: control.KV_WRITE_RESPONSE },
  kv_delete: { request: control.KV_DELETE_REQUEST, response: control.KV_DELETE_RESPONSE },
} as const satisfies Record<OpName, OpFixture>;

/** A representative frame for every topic, each one the snapshot a subscriber
 * opens with or a change of the same shape. */
export const TOPIC_FIXTURES = {
  inbox: topics.INBOX_FRAME,
  notify: topics.NOTIFY_FRAME,
  peers: topics.PEERS_FRAME,
  instances: topics.INSTANCES_FRAME,
  agents: topics.AGENTS_FRAME,
  session_status: topics.SESSION_STATUS_FRAME,
  transcript: topics.TRANSCRIPT_FRAME,
  transcript_items: topics.TRANSCRIPT_ITEMS_FRAME,
  session_errors: topics.SESSION_ERRORS_FRAME,
  llm_requests: topics.LLM_REQUESTS_FRAME,
  llm_status: topics.LLM_STATUS_FRAME,
  kv: topics.KV_FRAME,
  auth_records: topics.AUTH_RECORDS_FRAME,
} as const satisfies Record<TopicKind, unknown>;
