import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";

export const InstanceShutdownArgs = Type.Object({});
export type InstanceShutdownArgs = Static<typeof InstanceShutdownArgs>;

/** Answered before the process goes down, so the caller learns the request was
 * accepted rather than inferring it from the socket closing. */
export const InstanceShutdownResult = Type.Object({});
export type InstanceShutdownResult = Static<typeof InstanceShutdownResult>;

export const InstanceShutdownRequest = request("instance_shutdown", InstanceShutdownArgs);
export const InstanceShutdownResponse = response("instance_shutdown", InstanceShutdownResult);
