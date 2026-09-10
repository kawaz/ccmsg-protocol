import type { TSchema } from "@sinclair/typebox";
import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import type { OpName } from "./attributes.ts";
import {
  AuthAssertRequest,
  AuthAssertResponse,
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthRecordsFrame,
  AuthRefreshRequest,
  AuthRefreshResponse,
  AuthRefreshTokenRequest,
  AuthRefreshTokenResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResolveRequest,
  AuthResolveResponse,
  AuthRotateRequest,
  AuthRotateResponse,
} from "./common/auth.ts";
import { HelloRequest, HelloResponse } from "./common/hello.ts";
import { InstancePingRequest, InstancePingResponse } from "./common/ping.ts";
import {
  InstanceShutdownRequest,
  InstanceShutdownResponse,
  SessionStoppingRequest,
  SessionStoppingResponse,
} from "./common/shutdown.ts";
import {
  TopicSubscribeRequest,
  TopicSubscribeResponse,
  TopicUnsubscribeRequest,
  TopicUnsubscribeResponse,
} from "./common/topics.ts";
import { AgentsFrame } from "./control/agents.ts";
import { DumpPresetsReadRequest, DumpPresetsReadResponse } from "./control/dump.ts";
import {
  DirListRequest,
  DirListResponse,
  DirTreeRequest,
  DirTreeResponse,
  FileCreateRequest,
  FileCreateResponse,
  FileDeleteRequest,
  FileDeleteResponse,
  FileEditRequest,
  FileEditResponse,
  FileFindRequest,
  FileFindResponse,
  FileReadRequest,
  FileReadResponse,
  FileStatBatchRequest,
  FileStatBatchResponse,
  FileWriteRequest,
  FileWriteResponse,
} from "./control/files.ts";
import {
  KvDeleteRequest,
  KvDeleteResponse,
  KvFrame,
  KvReadRequest,
  KvReadResponse,
  KvWriteRequest,
  KvWriteResponse,
} from "./control/kv.ts";
import {
  LauncherConfigReadRequest,
  LauncherConfigReadResponse,
  LauncherRunRequest,
  LauncherRunResponse,
} from "./control/launcher.ts";
import {
  LlmRequestsFrame,
  LlmStatsReadRequest,
  LlmStatsReadResponse,
  LlmStatusFrame,
  LlmUsageReadRequest,
  LlmUsageReadResponse,
} from "./control/llm.ts";
import { PeersFrame } from "./control/peers.ts";
import {
  SandboxGrantRequest,
  SandboxGrantResponse,
  SandboxRevokeRequest,
  SandboxRevokeResponse,
} from "./control/sandbox.ts";
import { SessionErrorsFrame } from "./control/session-errors.ts";
import { SessionStatusFrame } from "./control/session-status.ts";
import {
  SessionDumpWriteRequest,
  SessionDumpWriteResponse,
  SessionEnvReadRequest,
  SessionEnvReadResponse,
  SessionForkOriginRequest,
  SessionForkOriginResponse,
  SessionKillRequest,
  SessionKillResponse,
  SessionLastLiveRemoveRequest,
  SessionLastLiveRemoveResponse,
  SessionRenameRequest,
  SessionRenameResponse,
  SessionSearchRequest,
  SessionSearchResponse,
} from "./control/session.ts";
import {
  TranscriptFrame,
  TranscriptItemsFrame,
  TranscriptItemsReadRequest,
  TranscriptItemsReadResponse,
  TranscriptReadRequest,
  TranscriptReadResponse,
} from "./control/transcript.ts";
import { TranslateRunRequest, TranslateRunResponse } from "./control/translate.ts";
import { InboxFrame, MessageSendRequest, MessageSendResponse } from "./messaging/message.ts";
import { NotifyFrame, NotifySendRequest, NotifySendResponse } from "./messaging/notify.ts";
import {
  SayMarkReadRequest,
  SayMarkReadResponse,
  SayPostRequest,
  SayPostResponse,
} from "./messaging/say.ts";

export interface OpSchemas {
  readonly request: TSchema;
  readonly response: TSchema;
}

/** The schema pair for every op.
 *
 * The op attribute table says who may call an op and where it runs; this says
 * what it takes and what it answers. The two are checked against each other:
 * an op in one and not the other is a hole in the contract, not a stage of it. */
export const OP_SCHEMAS: Record<OpName, OpSchemas> = {
  hello: { request: HelloRequest, response: HelloResponse },
  instance_ping: { request: InstancePingRequest, response: InstancePingResponse },
  instance_shutdown: { request: InstanceShutdownRequest, response: InstanceShutdownResponse },
  session_stopping: { request: SessionStoppingRequest, response: SessionStoppingResponse },
  topic_subscribe: { request: TopicSubscribeRequest, response: TopicSubscribeResponse },
  topic_unsubscribe: { request: TopicUnsubscribeRequest, response: TopicUnsubscribeResponse },
  auth_challenge: { request: AuthChallengeRequest, response: AuthChallengeResponse },
  auth_register: { request: AuthRegisterRequest, response: AuthRegisterResponse },
  auth_assert: { request: AuthAssertRequest, response: AuthAssertResponse },
  auth_refresh_token: { request: AuthRefreshTokenRequest, response: AuthRefreshTokenResponse },
  auth_refresh: { request: AuthRefreshRequest, response: AuthRefreshResponse },
  auth_resolve: { request: AuthResolveRequest, response: AuthResolveResponse },
  auth_rotate: { request: AuthRotateRequest, response: AuthRotateResponse },
  message_send: { request: MessageSendRequest, response: MessageSendResponse },
  say_post: { request: SayPostRequest, response: SayPostResponse },
  say_mark_read: { request: SayMarkReadRequest, response: SayMarkReadResponse },
  notify_send: { request: NotifySendRequest, response: NotifySendResponse },

  session_kill: { request: SessionKillRequest, response: SessionKillResponse },
  session_rename: { request: SessionRenameRequest, response: SessionRenameResponse },
  session_env_read: { request: SessionEnvReadRequest, response: SessionEnvReadResponse },
  session_search: { request: SessionSearchRequest, response: SessionSearchResponse },
  session_dump_write: { request: SessionDumpWriteRequest, response: SessionDumpWriteResponse },
  dump_presets_read: { request: DumpPresetsReadRequest, response: DumpPresetsReadResponse },
  transcript_read: { request: TranscriptReadRequest, response: TranscriptReadResponse },
  transcript_items_read: {
    request: TranscriptItemsReadRequest,
    response: TranscriptItemsReadResponse,
  },
  session_fork_origin: { request: SessionForkOriginRequest, response: SessionForkOriginResponse },
  session_last_live_remove: {
    request: SessionLastLiveRemoveRequest,
    response: SessionLastLiveRemoveResponse,
  },

  dir_list: { request: DirListRequest, response: DirListResponse },
  file_read: { request: FileReadRequest, response: FileReadResponse },
  file_write: { request: FileWriteRequest, response: FileWriteResponse },
  file_create: { request: FileCreateRequest, response: FileCreateResponse },
  file_edit: { request: FileEditRequest, response: FileEditResponse },
  file_delete: { request: FileDeleteRequest, response: FileDeleteResponse },
  file_find: { request: FileFindRequest, response: FileFindResponse },
  file_stat_batch: { request: FileStatBatchRequest, response: FileStatBatchResponse },
  dir_tree: { request: DirTreeRequest, response: DirTreeResponse },

  launcher_config_read: {
    request: LauncherConfigReadRequest,
    response: LauncherConfigReadResponse,
  },
  launcher_run: { request: LauncherRunRequest, response: LauncherRunResponse },
  sandbox_grant: { request: SandboxGrantRequest, response: SandboxGrantResponse },
  sandbox_revoke: { request: SandboxRevokeRequest, response: SandboxRevokeResponse },
  translate_run: { request: TranslateRunRequest, response: TranslateRunResponse },
  llm_usage_read: { request: LlmUsageReadRequest, response: LlmUsageReadResponse },
  llm_stats_read: { request: LlmStatsReadRequest, response: LlmStatsReadResponse },

  kv_read: { request: KvReadRequest, response: KvReadResponse },
  kv_write: { request: KvWriteRequest, response: KvWriteResponse },
  kv_delete: { request: KvDeleteRequest, response: KvDeleteResponse },
};

/** The frame schema for every topic.
 *
 * A topic's snapshot and its later frames share one schema, which is the point
 * of the form: a subscriber has one way to read the current value and every
 * change to it. */
export const TOPIC_SCHEMAS = {
  inbox: InboxFrame,
  notify: NotifyFrame,
  peers: PeersFrame,
  agents: AgentsFrame,
  session_status: SessionStatusFrame,
  transcript: TranscriptFrame,
  transcript_items: TranscriptItemsFrame,
  session_errors: SessionErrorsFrame,
  llm_requests: LlmRequestsFrame,
  llm_status: LlmStatusFrame,
  kv: KvFrame,
  auth_records: AuthRecordsFrame,
} as const;

const compiled = new WeakMap<TSchema, TypeCheck<TSchema>>();

/** A compiled validator for a schema, made once and reused. Validation is the
 * contract's own job: both sides check against these rather than each writing
 * their own field-by-field tests. */
export function validator<T extends TSchema>(schema: T): TypeCheck<T> {
  const hit = compiled.get(schema);
  if (hit) return hit as TypeCheck<T>;
  const made = TypeCompiler.Compile(schema);
  compiled.set(schema, made as TypeCheck<TSchema>);
  return made;
}

export function isValid<T extends TSchema>(schema: T, value: unknown): boolean {
  return validator(schema).Check(value);
}

/** The reasons a value fails a schema, as `path: message` lines. Suitable for
 * the `msg` of an `invalid_args` error. */
export function validationErrors<T extends TSchema>(schema: T, value: unknown): string[] {
  return [...validator(schema).Errors(value)].map((e) => `${e.path}: ${e.message}`);
}
