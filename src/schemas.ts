import type { TSchema } from "@sinclair/typebox";
import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import type { OpName } from "./attributes.ts";
import {
  AuthAssertRequest,
  AuthAssertResponse,
  AuthChallengeRequest,
  AuthChallengeResponse,
  AuthRecordsFrame,
  AuthExtendRequest,
  AuthExtendResponse,
  AuthTokenRefreshRequest,
  AuthTokenRefreshResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResolveRequest,
  AuthResolveResponse,
  AuthRotateRequest,
  AuthRotateResponse,
} from "./common/auth.ts";
import {
  HelloInstanceRequest,
  HelloInstanceResponse,
  HelloSessionRequest,
  HelloSessionResponse,
  HelloUserRequest,
  HelloUserResponse,
} from "./common/hello.ts";
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
  FileStatRequest,
  FileStatResponse,
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
import { InstancesFrame } from "./control/instances.ts";
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
  SessionForkOriginReadRequest,
  SessionForkOriginReadResponse,
  SessionKillRequest,
  SessionKillResponse,
  SessionForgetRequest,
  SessionForgetResponse,
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
  SayUnreadClearRequest,
  SayUnreadClearResponse,
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
  "hello.session": { request: HelloSessionRequest, response: HelloSessionResponse },
  "hello.user": { request: HelloUserRequest, response: HelloUserResponse },
  "hello.instance": { request: HelloInstanceRequest, response: HelloInstanceResponse },
  "instance.ping": { request: InstancePingRequest, response: InstancePingResponse },
  "instance.shutdown": { request: InstanceShutdownRequest, response: InstanceShutdownResponse },
  "session.stopping": { request: SessionStoppingRequest, response: SessionStoppingResponse },
  "topic.subscribe": { request: TopicSubscribeRequest, response: TopicSubscribeResponse },
  "topic.unsubscribe": { request: TopicUnsubscribeRequest, response: TopicUnsubscribeResponse },
  "auth.challenge": { request: AuthChallengeRequest, response: AuthChallengeResponse },
  "auth.register": { request: AuthRegisterRequest, response: AuthRegisterResponse },
  "auth.assert": { request: AuthAssertRequest, response: AuthAssertResponse },
  "auth.token.refresh": { request: AuthTokenRefreshRequest, response: AuthTokenRefreshResponse },
  "auth.extend": { request: AuthExtendRequest, response: AuthExtendResponse },
  "auth.resolve": { request: AuthResolveRequest, response: AuthResolveResponse },
  "auth.rotate": { request: AuthRotateRequest, response: AuthRotateResponse },
  "message.send": { request: MessageSendRequest, response: MessageSendResponse },
  "say.post": { request: SayPostRequest, response: SayPostResponse },
  "say.unread.clear": { request: SayUnreadClearRequest, response: SayUnreadClearResponse },
  "notify.send": { request: NotifySendRequest, response: NotifySendResponse },

  "session.kill": { request: SessionKillRequest, response: SessionKillResponse },
  "session.rename": { request: SessionRenameRequest, response: SessionRenameResponse },
  "session.env.read": { request: SessionEnvReadRequest, response: SessionEnvReadResponse },
  "session.search": { request: SessionSearchRequest, response: SessionSearchResponse },
  "session.dump.write": { request: SessionDumpWriteRequest, response: SessionDumpWriteResponse },
  "dump.presets.read": { request: DumpPresetsReadRequest, response: DumpPresetsReadResponse },
  "transcript.read": { request: TranscriptReadRequest, response: TranscriptReadResponse },
  "transcript.items.read": {
    request: TranscriptItemsReadRequest,
    response: TranscriptItemsReadResponse,
  },
  "session.fork.origin.read": {
    request: SessionForkOriginReadRequest,
    response: SessionForkOriginReadResponse,
  },
  "session.forget": {
    request: SessionForgetRequest,
    response: SessionForgetResponse,
  },

  "dir.list": { request: DirListRequest, response: DirListResponse },
  "file.read": { request: FileReadRequest, response: FileReadResponse },
  "file.write": { request: FileWriteRequest, response: FileWriteResponse },
  "file.create": { request: FileCreateRequest, response: FileCreateResponse },
  "file.edit": { request: FileEditRequest, response: FileEditResponse },
  "file.delete": { request: FileDeleteRequest, response: FileDeleteResponse },
  "file.find": { request: FileFindRequest, response: FileFindResponse },
  "file.stat": { request: FileStatRequest, response: FileStatResponse },
  "dir.tree": { request: DirTreeRequest, response: DirTreeResponse },

  "launcher.config.read": {
    request: LauncherConfigReadRequest,
    response: LauncherConfigReadResponse,
  },
  "launcher.run": { request: LauncherRunRequest, response: LauncherRunResponse },
  "sandbox.grant": { request: SandboxGrantRequest, response: SandboxGrantResponse },
  "sandbox.revoke": { request: SandboxRevokeRequest, response: SandboxRevokeResponse },
  "translate.run": { request: TranslateRunRequest, response: TranslateRunResponse },
  "llm.usage.read": { request: LlmUsageReadRequest, response: LlmUsageReadResponse },
  "llm.stats.read": { request: LlmStatsReadRequest, response: LlmStatsReadResponse },

  "kv.read": { request: KvReadRequest, response: KvReadResponse },
  "kv.write": { request: KvWriteRequest, response: KvWriteResponse },
  "kv.delete": { request: KvDeleteRequest, response: KvDeleteResponse },
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
  instances: InstancesFrame,
  agents: AgentsFrame,
  "session.status": SessionStatusFrame,
  transcript: TranscriptFrame,
  "transcript.items": TranscriptItemsFrame,
  "session.errors": SessionErrorsFrame,
  "llm.requests": LlmRequestsFrame,
  "llm.status": LlmStatusFrame,
  kv: KvFrame,
  "auth.records": AuthRecordsFrame,
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
