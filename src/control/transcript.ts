import { type Static, Type } from "@sinclair/typebox";
import { request, response, topicFrame } from "../envelope.ts";
import { Sid } from "../identifiers.ts";

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

export const TranscriptReadRequest = request("transcript_read", TranscriptReadArgs);
export const TranscriptReadResponse = response("transcript_read", TranscriptReadResult);

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
