import { type Static, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";

/** Translates a batch of texts on the instance's host.
 *
 * The reply comes back when the whole batch is done, which can be seconds. An
 * empty batch is not a probe for whether translation is available — that is the
 * capability's job, and asking the question twice is what the capability set
 * was introduced to end. */
export const TranslateRunArgs = Type.Object({
  texts: Type.Array(Type.String()),
});
export type TranslateRunArgs = Static<typeof TranslateRunArgs>;

/** One text's outcome. A batch succeeds as a whole while individual texts may
 * not, so the failure lives per item rather than failing the op. */
export const TranslateResult = Type.Union(
  [
    Type.Object({ ok: Type.Literal(true), text: Type.String() }),
    Type.Object({ ok: Type.Literal(false), error: Type.String() }),
  ],
  { $id: "TranslateResult" },
);
export type TranslateResult = Static<typeof TranslateResult>;

export const TranslateRunResult = Type.Object({
  /** One per requested text, in the order they were sent. */
  results: Type.Array(TranslateResult),
});
export type TranslateRunResult = Static<typeof TranslateRunResult>;

export const TranslateRunRequest = request("translate.run", TranslateRunArgs);
export const TranslateRunResponse = response("translate.run", TranslateRunResult);
