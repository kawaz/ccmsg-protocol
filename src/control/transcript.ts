import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";
import { DumpIds, TranscriptItem, TranscriptItemId, TranscriptItemSelector } from "./dump.ts";

/** Reads a slice of a session's transcript.
 *
 * The caller never supplies a path — the file is the one the session announced,
 * or the one an id below it resolves to — so there is no traversal to defend
 * against. Paging is by byte offset aligned to line boundaries, which is what
 * lets a transcript of any size be read from its end backwards without ever
 * scanning it whole or building an index: read the tail, then ask again for
 * what began before the slice just read.
 *
 * The role decides how much is visible rather than whether the call is allowed:
 * a session reads its own transcript, a person reads any. */
export const TranscriptReadArgs = Type.Object({
  sid: Sid,
  /** Read lines ending at or before this offset. Absent starts at the end. */
  before: Type.Optional(Type.Integer({ minimum: 0 })),
  /** How much to return; the instance narrows this to its own limit. */
  max_bytes: Type.Optional(Type.Integer({ minimum: 1 })),
  /** Read an agent's transcript instead of the session's own. Validated
   * strictly, since it names a file. Not to be combined with `teammate`. */
  agent_id: Type.Optional(Type.String()),
  /** The workflow run that owns `agent_id`. Absent means the agent hangs
   * directly below the session. Meaningless on its own. */
  run_id: Type.Optional(Type.String()),
  /** Read a teammate's transcript, found by the name it is addressed by — the
   * name it carries in conversation cannot be used as a filename, so it is
   * resolved rather than substituted. Not to be combined with `agent_id`. */
  teammate: Type.Optional(Type.String()),
});
export type TranscriptReadArgs = Static<typeof TranscriptReadArgs>;

export const TranscriptReadResult = Type.Object({
  sid: Sid,
  /** Whole records as written, oldest first. The reader parses each. */
  lines: Type.Array(Type.String()),
  /** Offset of the first line returned. Pass it back as `before` to page
   * further back; zero means the beginning is included. */
  start: Type.Integer({ minimum: 0 }),
  /** Offset just past the last line returned. */
  end: Type.Integer({ minimum: 0 }),
  /** The transcript's size now. It grows while the session runs, so this is
   * also where a later read of what has since been appended starts. */
  size: Type.Integer({ minimum: 0 }),
});
export type TranscriptReadResult = Static<typeof TranscriptReadResult>;

export const TranscriptReadRequest = request("transcript.read", TranscriptReadArgs);
export const TranscriptReadResponse = response("transcript.read", TranscriptReadResult);

/** Reads a slice of a transcript as the items it was read into.
 *
 * The read above answers with the file's own lines, which leaves whoever asked
 * holding a harness's private format; this answers with what those lines were
 * classified as, so a client draws items and never learns how a record is
 * shaped. Both stay: the typed read is what a client works in, and the raw one
 * is how it fetches the record behind an item it wants to see verbatim, by the
 * `source` that item carries.
 *
 * The range is cut the way a dump's is — an instant or a record on either side
 * — and which end of it a limit keeps follows from which bound was given. A
 * lower bound reads forward from it and `next` names the continuation;
 * otherwise the read answers the range's last items and `prev` names the
 * continuation backwards, which is how a client that draws the newest items
 * first walks back through a transcript it never has to read whole. Asking
 * with no bound at all is the ordinary first read, and it answers the tail, as
 * the raw read with no `before` does; a client that wants the transcript from
 * its beginning says so with `since_at: 0`. The role decides how much is
 * visible, as it does for the raw read. */
export const TranscriptItemsReadArgs = Type.Object({
  sid: Sid,
  /** Read one agent below the session instead of the session itself. */
  agent_id: Type.Optional(Type.String()),
  /** Inclusive lower bound in time. */
  since_at: Type.Optional(Timestamp),
  /** Inclusive lower bound as a transcript record id, which cuts at that
   * record's position rather than at its clock. Give one lower bound only. */
  since_uuid: Type.Optional(Type.String()),
  /** Resume at this item, the one a previous reply named as `next`. Finer than
   * `since_uuid`, which would start again at the first item of a record whose
   * later items were already read. */
  since_id: Type.Optional(TranscriptItemId),
  until_at: Type.Optional(Timestamp),
  until_uuid: Type.Optional(Type.String()),
  /** Exclusive upper bound as an item id, the one a previous reply named as
   * `prev`. Finer than `until_uuid`, which would stop at a record whose earlier
   * items were already read. */
  until_id: Type.Optional(TranscriptItemId),
  /** Which item types to keep, applied left to right. Absent keeps everything
   * but the attachments, as a dump's absent selection does. */
  types: Type.Optional(Type.Array(TranscriptItemSelector)),
  /** How many items to answer with, taken from the range's start when a lower
   * bound was given and from its end otherwise; the instance narrows this to
   * its own limit. */
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type TranscriptItemsReadArgs = Static<typeof TranscriptItemsReadArgs>;

export const TranscriptItemsReadResult = Type.Object({
  /** Oldest first, as the transcript had them. */
  items: Type.Array(TranscriptItem),
  /** The first item left out after the ones answered, when a limit cut a
   * forward read short. Absent means nothing follows within the range. */
  next: Type.Optional(TranscriptItemId),
  /** The first item answered, when a limit left older ones inside the range
   * unread. Pass it back as `until_id` to read what came before. Absent means
   * the range reaches back to its start. */
  prev: Type.Optional(TranscriptItemId),
  /** The ids the answered items carried, gathered as a dump gathers them.
   * Absent when the caller did not ask the instance to collect them. */
  ids: Type.Optional(DumpIds),
});
export type TranscriptItemsReadResult = Static<typeof TranscriptItemsReadResult>;

export const TranscriptItemsReadRequest = request("transcript.items.read", TranscriptItemsReadArgs);
export const TranscriptItemsReadResponse = response(
  "transcript.items.read",
  TranscriptItemsReadResult,
);

/** The `transcript.items:<sid>` topic.
 *
 * What `transcript:<sid>` carries as appended bytes, carried as the items those
 * bytes were read as. A subscriber holds a list it only ever appends to, so the
 * opening frame is the tail of it — the last items the instance kept, in a
 * count it decides — and every frame after carries what has since been
 * classified. A client that wants further back asks for it by range rather than
 * waiting for a snapshot to grow.
 *
 * A record still being written is not classified until its line ends, which is
 * the same rule the raw topic sends whole lines under. */
export const TranscriptItemsFrame = topicFrame(
  "transcript.items",
  Type.Object({
    sid: Sid,
    items: Type.Array(TranscriptItem),
  }),
);

/** The `transcript:<sid>` topic.
 *
 * The one topic whose frames are not a whole value: a transcript is appended
 * to, and sending it entire on every line would be sending the whole file over
 * and over. The snapshot therefore states only where the file currently ends,
 * and each frame after it carries what was appended, with the offsets that
 * place it. Those offsets are the same ones a read pages by, so a client can
 * stitch what arrives live onto what it read without reading anything twice.
 *
 * Only complete lines are sent; a line still being written waits for its end. */
export const TranscriptFrame = topicFrame(
  "transcript",
  Type.Union([
    Type.Object({
      sid: Sid,
      /** Where the transcript ends as the subscription begins. What follows
       * starts here. */
      size: Type.Integer({ minimum: 0 }),
    }),
    Type.Object({
      sid: Sid,
      lines: Type.Array(Type.String()),
      start: Type.Integer({ minimum: 0 }),
      end: Type.Integer({ minimum: 0 }),
      size: Type.Integer({ minimum: 0 }),
    }),
  ]),
);
