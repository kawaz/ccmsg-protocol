import type { TSchema } from "@sinclair/typebox";
import { TypeCompiler, type TypeCheck } from "@sinclair/typebox/compiler";
import type { OpName } from "./attributes.ts";
import { HelloRequest, HelloResponse } from "./common/hello.ts";
import { InstancePingRequest, InstancePingResponse } from "./common/ping.ts";
import { InstanceShutdownRequest, InstanceShutdownResponse } from "./common/shutdown.ts";
import {
  TopicSubscribeRequest,
  TopicSubscribeResponse,
  TopicUnsubscribeRequest,
  TopicUnsubscribeResponse,
} from "./common/topics.ts";
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

/** The schema pair for each op that has one.
 *
 * The op attribute table lists every op; this lists the ones whose arguments
 * and reply are written down so far. The control plane's 25 ops are named in
 * the table and land here as they are specified. */
export const OP_SCHEMAS: Partial<Record<OpName, OpSchemas>> = {
  hello: { request: HelloRequest, response: HelloResponse },
  instance_ping: { request: InstancePingRequest, response: InstancePingResponse },
  instance_shutdown: { request: InstanceShutdownRequest, response: InstanceShutdownResponse },
  topic_subscribe: { request: TopicSubscribeRequest, response: TopicSubscribeResponse },
  topic_unsubscribe: { request: TopicUnsubscribeRequest, response: TopicUnsubscribeResponse },
  message_send: { request: MessageSendRequest, response: MessageSendResponse },
  say_post: { request: SayPostRequest, response: SayPostResponse },
  say_mark_read: { request: SayMarkReadRequest, response: SayMarkReadResponse },
  notify_send: { request: NotifySendRequest, response: NotifySendResponse },
};

/** The frame schema for each topic that carries one. */
export const TOPIC_SCHEMAS = {
  inbox: InboxFrame,
  notify: NotifyFrame,
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
