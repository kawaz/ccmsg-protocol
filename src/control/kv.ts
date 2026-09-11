import { type Static, Type } from "@sinclair/typebox";
import { NAMESPACE_PATTERN } from "../common/topics.ts";
import { request, response, topicFrame } from "../envelope.ts";
import { Timestamp } from "../identifiers.ts";

/** Which namespace a key lives in. Namespaces do not nest and carry no meaning
 * here: they keep one user of this store from colliding with another. */
export const Namespace = Type.String({ $id: "Namespace", pattern: `^${NAMESPACE_PATTERN}$` });
export type Namespace = Static<typeof Namespace>;

/** What names a value within its namespace.
 *
 * Unlike a namespace, a key may hold text a person typed, so it is bounded and
 * kept free of control characters rather than shaped into an identifier. Any
 * structure within a key — a prefix naming which machine a value belongs to,
 * say — is its user's convention, and this contract reads none of it. */
export const KvKey = Type.String({
  $id: "KvKey",
  minLength: 1,
  maxLength: 256,
  pattern: "^[^\\u0000-\\u001f]+$",
});
export type KvKey = Static<typeof KvKey>;

/** A stored value. Any JSON: what a value means belongs to whoever writes and
 * reads it, and a store that understood its contents would have to be changed
 * every time one of them did. */
export const KvValue = Type.Unknown({ $id: "KvValue" });

/** Reads one value.
 *
 * The whole of what this store promises is that a key is unique within its
 * namespace. Instances mirror it between themselves, and when two of them hold
 * different values for one key the later `updated_at` is the one that stands —
 * so the value read here is the newest the answering instance knows of, not
 * necessarily the newest anywhere. */
export const KvReadArgs = Type.Object({ ns: Namespace, key: KvKey });
export type KvReadArgs = Static<typeof KvReadArgs>;

export const KvReadResult = Type.Object({
  value: KvValue,
  /** When the value was written, which is also what settles a disagreement
   * between two instances. */
  updated_at: Timestamp,
});
export type KvReadResult = Static<typeof KvReadResult>;

export const KvReadRequest = request("kv.read", KvReadArgs);
export const KvReadResponse = response("kv.read", KvReadResult);

/** Writes one value, replacing whatever the key held. */
export const KvWriteArgs = Type.Object({
  ns: Namespace,
  key: KvKey,
  value: KvValue,
  /** When the value was written. A caller states it when the write it is
   * reporting happened at some other time than this call — which is what lets a
   * value written while an instance was unreachable arrive later without
   * pretending to be newer than it is. Absent, the answering instance stamps it
   * with the present. */
  updated_at: Type.Optional(Timestamp),
});
export type KvWriteArgs = Static<typeof KvWriteArgs>;

export const KvWriteResult = Type.Object({
  /** What the entry now carries, whether it was given or stamped. */
  updated_at: Timestamp,
});
export type KvWriteResult = Static<typeof KvWriteResult>;

export const KvWriteRequest = request("kv.write", KvWriteArgs);
export const KvWriteResponse = response("kv.write", KvWriteResult);

/** Removes one key. A key that was not there is no error: the caller wanted the
 * namespace to be without it, and it is. */
export const KvDeleteArgs = Type.Object({ ns: Namespace, key: KvKey });
export type KvDeleteArgs = Static<typeof KvDeleteArgs>;

export const KvDeleteResult = Type.Object({});
export type KvDeleteResult = Static<typeof KvDeleteResult>;

export const KvDeleteRequest = request("kv.delete", KvDeleteArgs);
export const KvDeleteResponse = response("kv.delete", KvDeleteResult);

/** One entry, in a snapshot or in the change that produced it. */
export const KvEntry = Type.Object(
  {
    key: KvKey,
    /** Absent exactly when the entry is a removal, which is the only case with
     * no value to state. */
    value: Type.Optional(KvValue),
    updated_at: Timestamp,
    /** Marks a removal. Absent means the entry is there to be read, so a
     * snapshot never carries it. */
    deleted: Type.Optional(Type.Literal(true)),
  },
  { $id: "KvEntry" },
);
export type KvEntry = Static<typeof KvEntry>;

/** The `kv:<ns>` topic, which is how a change one client makes reaches the
 * others while they are looking at it.
 *
 * Snapshot and change are the same shape: the snapshot is every entry the
 * namespace holds, and a later frame is the entries that changed. A removal
 * travels as an entry marked deleted rather than as an absence, since an
 * absence in a list of changes would say nothing. */
export const KvFrame = topicFrame("kv", Type.Object({ entries: Type.Array(KvEntry) }));
