import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** One boundary a piece of transcript crossed on its way to being shown.
 *
 * The instance can time the part of the path it performs itself and nothing
 * after; a client reports the rest so one trace covers the whole way from file
 * to screen. The stages are named for what happens at them rather than for who
 * does it, so a second kind of client can post the same shape. */
export const TracePoint = Type.Object(
  {
    at: Timestamp,
    /** Whether the stage took the data in or handed it on. */
    edge: Type.Union([Type.Literal("in"), Type.Literal("out")]),
    kind: Type.Union([
      /** The frame arrived on the connection. */
      Type.Literal("receive"),
      /** It reached the client's own state. */
      Type.Literal("store"),
      /** It became visible. */
      Type.Literal("render"),
    ]),
  },
  { $id: "TracePoint" },
);
export type TracePoint = Static<typeof TracePoint>;

/** Hands the client's side of a transcript delivery back for the record. */
export const TraceWriteArgs = Type.Object({
  sid: Sid,
  /** The byte range this delivery carried, and the size it was measured
   * against, so a trace lines up with the transcript reads around it. */
  start: Type.Integer({ minimum: 0 }),
  end: Type.Integer({ minimum: 0 }),
  size: Type.Integer({ minimum: 0 }),
  /** This delivery was one the client chose to time; most are not, and a trace
   * that does not say so would read as a complete record of every delivery. */
  sampled: Type.Boolean(),
  /** How long the client's own part took. */
  elapsed_ms: Type.Integer({ minimum: 0 }),
  points: Type.Array(TracePoint),
});
export type TraceWriteArgs = Static<typeof TraceWriteArgs>;

export const TraceWriteResult = Type.Object({
  sid: Sid,
  /** How many points were recorded. The instance caps a batch, so a client that
   * sent more learns its extras were dropped. */
  written: Type.Integer({ minimum: 0 }),
});
export type TraceWriteResult = Static<typeof TraceWriteResult>;

export const TraceWriteRequest = request("trace_write", TraceWriteArgs);
export const TraceWriteResponse = response("trace_write", TraceWriteResult);
