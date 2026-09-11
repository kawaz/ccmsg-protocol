import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { InstanceId, Timestamp } from "../identifiers.ts";

export const InstancePingArgs = Type.Object({});
export type InstancePingArgs = Static<typeof InstancePingArgs>;

/** How the answering daemon process is running.
 *
 * This is about one process, which is why the op is instance-local: the health
 * of the cluster is `hello`'s `instances[]`, not a ping fanned out. */
export const InstancePingResult = Type.Object({
  instance: InstanceId,
  version: Type.String(),
  pid: Type.Integer({ minimum: 1 }),
  started_at: Timestamp,
  /** Connected clients right now. */
  clients: Type.Integer({ minimum: 0 }),
  /** The interpreter and entry script the daemon runs from. Which plugin cache
   * the entry script sits in is what tells two same-host instances apart when
   * one is running a stale build. */
  exe: Type.Optional(Type.String()),
  script: Type.Optional(Type.String()),
  /** Bound HTTP/WS addresses as `host:port`; empty when HTTP is off. */
  http: Type.Array(Type.String()),
  /** The daemon's current view of the host link. */
  network: Type.Union([
    Type.Literal("off"),
    Type.Literal("unknown"),
    Type.Literal("online"),
    Type.Literal("offline"),
  ]),
});
export type InstancePingResult = Static<typeof InstancePingResult>;

export const InstancePingRequest = request("instance.ping", InstancePingArgs);
export const InstancePingResponse = response("instance.ping", InstancePingResult);
