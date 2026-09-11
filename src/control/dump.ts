import { type Static, type TSchema, Type } from "@sinclair/typebox";
import { request, response } from "../envelope.ts";
import { Sid, Timestamp } from "../identifiers.ts";

/** The vocabulary a transcript is read in: item types, the shape one item
 * takes, the ledger of ids they carry, and the named selections a person dumps
 * by.
 *
 * A transcript is a harness's own file format, appended to in whatever shape
 * that harness settles on. What travels between us is not that file but the
 * items it was read as, so the classifying — which line is which item — belongs
 * to whoever reads the file, and only the names it classifies into are written
 * down here. That split is what lets a harness change its file, or a second
 * harness be read at all, without the contract moving.
 *
 * A type name is `:`-separated and read left to right, so a prefix names
 * everything below it: `tool` is every tool, `message:user` is both directions
 * of what a person and a session said. Three families stay open, because their
 * last segment is a name someone else coins — a tool, an attachment kind, a
 * hook event — and closing them would turn every newcomer into `unknown`. */

/** A type name as written on the wire and in a selection.
 *
 * Segments after the first carry the spelling of whatever named them, which is
 * why they are not held to snake_case: `tool:Bash` and `hook:PreToolUse` are
 * the harness's words, and rewriting them would leave the reader unable to
 * match what it sees against what it ran. */
export const TranscriptItemType = Type.String({
  pattern: "^[a-z]+(?::[A-Za-z0-9_.-]+)*$",
  $id: "TranscriptItemType",
});
export type TranscriptItemType = Static<typeof TranscriptItemType>;

/** The type names that are fully spelled out here. The three open families
 * (`tool:<Name>`, `system:attachment:<kind>`, `hook:<Event>`) are not in the
 * list: their last segment is coined elsewhere, and a name absent from this
 * list is a newcomer rather than an error. */
export const TRANSCRIPT_ITEM_TYPES = [
  "message:user:in",
  "message:user:out",
  "message:parent:in",
  "message:parent:out",
  "message:sub:in",
  "message:sub:out",
  "message:team:in",
  "message:team:out",
  "message:session:in",
  "message:session:out",
  "thinking",
  "notice:slash",
  "notice:interrupt",
  "system:compact",
  "system:api-error",
  "system:task",
  "system:caveat",
  "system:resume",
  "system:unknown",
] as const;
export type KnownTranscriptItemType = (typeof TRANSCRIPT_ITEM_TYPES)[number];

/** One element of a selection: a type name, a prefix of one, either of those
 * negated with `-`, or `@name` standing for a preset expanded in place.
 *
 * Elements apply left to right, so an exclusion reaches whatever a prefix or an
 * expansion before it brought in. */
export const TranscriptItemSelector = Type.String({
  pattern: "^-?(?:@[A-Za-z0-9][A-Za-z0-9_-]*|[a-z]+(?::[A-Za-z0-9_.-]+)*)$",
  $id: "TranscriptItemSelector",
});
export type TranscriptItemSelector = Static<typeof TranscriptItemSelector>;

/** Where in the transcript the record an item was read from begins, and how far
 * it runs.
 *
 * An item is what a reader made of a record, and a reader is fallible: the one
 * question it cannot answer is what the record actually said. These two numbers
 * are that answer's address — `transcript_read` bounded to end at `offset +
 * bytes` and to carry `bytes` returns the record itself — which is what lets a
 * client show items and still let a person open the line behind one. Several
 * items read out of a single record share the address, so what comes back is
 * the record and not a slice of it. */
export const TranscriptItemSource = Type.Object(
  {
    offset: Type.Integer({ minimum: 0 }),
    bytes: Type.Integer({ minimum: 1 }),
  },
  { $id: "TranscriptItemSource" },
);
export type TranscriptItemSource = Static<typeof TranscriptItemSource>;

/** An item's own identity, `<uuid>:<index>` — the record it was read from and
 * where in that record it stood.
 *
 * The record's id alone does not identify an item: one assistant record becomes
 * the thinking, the text and each call it held, and a link that pointed by
 * `uuid` would name all of them at once. */
export const TranscriptItemId = Type.String({
  pattern: "^[^\\s:]+:(?:0|[1-9][0-9]*)$",
  $id: "TranscriptItemId",
});
export type TranscriptItemId = Static<typeof TranscriptItemId>;

/** What every item carries, whatever its type.
 *
 * `id` is what the links below point with — never a position in the array,
 * since a selection or a range decides which items exist in a given read — and
 * `uuid` stays beside it as the record the item came out of, which is what a
 * reader groups by when it wants the whole of one line. */
const BASE_FIELDS = {
  id: TranscriptItemId,
  uuid: Type.String({ minLength: 1 }),
  source: TranscriptItemSource,
  /** The item's own instant. A call and its result each keep their own. */
  at: Timestamp,
  /** Which turn of the session the item fell in, when the reader could place
   * it. Derived from the file and renumbered whenever it is read again, so it
   * is an attribute to show and never a way to cut a range. */
  turn: Type.Optional(Type.Integer({ minimum: 0 })),
};

/** A call and what came back are two items, not one.
 *
 * Some results arrive many turns later — an agent runs, a monitor waits — with
 * other items in between, so folding them into a single item would make the
 * reader decide which of the two instants the fold happens at. Two items each
 * keep their own, linked by id, and folding is left to whoever draws them.
 *
 * A link is written from the whole transcript and not from the slice it travels
 * in, so a `result_item` naming an item outside the range asked for is the
 * ordinary case rather than a broken pointer: the reader knows the id and can
 * ask for it. A `use` without one is a call that has not come back. */
const USE_FIELDS = {
  role: Type.Literal("use"),
  /** The result's id, once there is one. */
  result_item: Type.Optional(TranscriptItemId),
  /** The harness's own key for this call, which the result names back. */
  tool_use_id: Type.String(),
};

const RESULT_FIELDS = {
  role: Type.Literal("result"),
  /** The call this answers, when the reader saw it. A read that begins in the
   * middle of a file — a topic's seed, a transcript resumed from another file —
   * meets results whose call is behind where it started, and an id it never
   * read is one it cannot name. */
  parent_item: Type.Optional(TranscriptItemId),
  /** The harness's key for the call this answers, which the record carries
   * whether or not the call was read. A reader that has no `parent_item` joins
   * on this against the `tool_use_id` of the calls it holds. */
  parent_tool_use_id: Type.String(),
};

function item<T extends TSchema, F extends Record<string, TSchema>>(type: T, fields: F) {
  return Type.Object({ ...BASE_FIELDS, type, ...fields });
}

const Text = Type.String();

// --- message: who said what to whom, from the subject's side ---

/** The subject is a session by default, or one agent below it when the dump
 * names an agent, and `in` / `out` are read from wherever the subject stands.
 * What moves when the subject moves is who the counterpart is, not the names:
 * the same preset reads a session's talk with a person and an agent's talk with
 * whoever started it, which is what lets one be carried down a chain of agents.
 *
 * The counterpart is named by the kind of party it is — a person, the one above,
 * the throwaway agents below, a teammate that stays, another session — because a
 * dump is read to find out who was talking, and a subject's own position is the
 * one thing it cannot ask about itself. Hence `parent` rather than `user` for
 * the one above: an agent's parent is a session or another agent, and calling it
 * `user` would have a reader take a machine for a person.
 *
 * `message:user` is a person and nobody else. Both directions occur under a
 * session and under a teammate, which someone can type at directly; under a
 * throwaway agent neither does. A combination a subject is not expected to show
 * — `team` below an agent, say — is not refused: an unexpected line is still a
 * line, and it is emitted under the name it fits. */
const MessageUserIn = item(Type.Literal("message:user:in"), { text: Text });
const MessageUserOut = item(Type.Literal("message:user:out"), { text: Text });

/** What the one above said, and what was said back to it.
 *
 * An agent's first line is the brief it was started with, and its last is the
 * answer that brief is discharged by; in between it may hand its parent
 * something mid-flight. The answer is plain prose the harness collects, with no
 * call behind it, so `parent:out` is prose-or-call and not a call alone:
 * addressed to the parent is what the two forms have in common, and requiring a
 * `tool_use_id` would leave the one message an agent is certain to send
 * unnameable. */
const MessageParentIn = item(Type.Literal("message:parent:in"), {
  text: Text,
  /** The parent as the harness named it where this arrived — `main`, a lead's
   * name, the agent above. Left out when the record says only that it came from
   * above, which is the case for the brief an agent opens with. */
  from: Type.Optional(Type.String()),
  msg_id: Type.Optional(Type.String()),
});

/** Sent to the parent through a call, which the parent's own transcript has the
 * other half of. */
const MessageParentOutSent = item(Type.Literal("message:parent:out"), {
  ...USE_FIELDS,
  text: Text,
  /** The parent as the subject addressed it, in the harness's spelling. */
  to: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
});

/** Answered to the parent as prose — the agent's reply, final or interim. */
const MessageParentOutSaid = item(Type.Literal("message:parent:out"), { text: Text });

/** A teammate is an agent that was given a name and goes on standing, so what
 * passes between the subject and one is a correspondence rather than an errand:
 * a reply comes back as its own message, addressed and arriving whenever it is
 * written, and not as the answer to the call that sent it.
 *
 * That is the whole of what separates `team` from `sub`. A throwaway agent is
 * started, answers once and is done, which is why `sub:in` is the result of the
 * `sub:out` that started it. Here the two halves of a round trip are two
 * messages, and only the start of a teammate has a result to pair with. */
const MessageTeamOut = item(Type.Literal("message:team:out"), {
  ...USE_FIELDS,
  text: Text,
  /** The teammate addressed, by the name it stands under. */
  to: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  agent_id: Type.Optional(Type.String()),
  /** Present on the call that started the teammate, absent on the ones that
   * write to it afterwards. */
  subagent_type: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
});

/** A teammate writing to the subject, arriving under its own name whenever it
 * was written. */
const MessageTeamInSaid = item(Type.Literal("message:team:in"), {
  text: Text,
  from: Type.Optional(Type.String()),
  msg_id: Type.Optional(Type.String()),
});

/** A teammate's run ending, which answers the call that started it. */
const MessageTeamInDone = item(Type.Literal("message:team:in"), {
  ...RESULT_FIELDS,
  text: Text,
  agent_id: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  duration_ms: Type.Optional(Type.Integer({ minimum: 0 })),
});

const MessageSubOut = item(Type.Literal("message:sub:out"), {
  ...USE_FIELDS,
  prompt: Text,
  agent_id: Type.Optional(Type.String()),
  /** The agent definition asked for, in the harness's spelling. */
  subagent_type: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
});

const MessageSubIn = item(Type.Literal("message:sub:in"), {
  ...RESULT_FIELDS,
  text: Text,
  agent_id: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  duration_ms: Type.Optional(Type.Integer({ minimum: 0 })),
});

const MessageSessionOut = item(Type.Literal("message:session:out"), {
  text: Text,
  /** The addressee as the subject wrote it: a sid, or a name that was resolved
   * to one. Kept unresolved when that is all the transcript says. */
  to: Type.Optional(Type.String()),
  msg_id: Type.Optional(Type.String()),
  reply_to: Type.Optional(Type.String()),
});

const MessageSessionIn = item(Type.Literal("message:session:in"), {
  text: Text,
  from: Type.Optional(Type.String()),
  msg_id: Type.Optional(Type.String()),
});

const Thinking = item(Type.Literal("thinking"), { text: Text });

// --- notice: a person operated the harness ---

/** Kept apart from `system:*` because these explain a break in the
 * conversation: someone typed a command or stopped a turn. A reader skimming
 * for why the thread jumps needs them, and can skip what the harness injected
 * for its own reasons. */
const NoticeSlash = item(Type.Literal("notice:slash"), {
  command: Type.String(),
  args: Type.Optional(Type.String()),
  stdout: Type.Optional(Type.String()),
});
const NoticeInterrupt = item(Type.Literal("notice:interrupt"), {
  text: Type.Optional(Text),
});

// --- system: the harness talking in someone else's voice ---

const SystemCompact = item(Type.Literal("system:compact"), { text: Text });
const SystemApiError = item(Type.Literal("system:api-error"), { text: Text });
const SystemTask = item(Type.Literal("system:task"), {
  text: Text,
  /** The background task or monitor the event came from. */
  task_id: Type.Optional(Type.String()),
  event: Type.Optional(Type.String()),
});
const SystemCaveat = item(Type.Literal("system:caveat"), { text: Text });
const SystemResume = item(Type.Literal("system:resume"), { text: Text });

/** `system:attachment:<kind>` — the kind is the harness's own word for what it
 * attached, taken through unchanged so an attachment nobody has seen before
 * still arrives under its own name instead of collapsing into `unknown`. */
const SystemAttachment = item(Type.String({ pattern: "^system:attachment:[A-Za-z0-9_.-]+$" }), {
  attachment: Type.Record(Type.String(), Type.Unknown()),
});

/** What the reader could not place. It is still an item: a line that vanishes
 * silently is the one failure a dump cannot be read around. */
const SystemUnknown = item(Type.Literal("system:unknown"), {
  record: Type.Record(Type.String(), Type.Unknown()),
});

// --- hook: code the operator installed ---

/** `hook:<Event>` — the event alone, never the matcher. The name a hook runs
 * under is `PreToolUse:Bash`, whose `:` would read as a level of the hierarchy
 * and make `hook:PreToolUse` select nothing; the full name is a field instead,
 * and prefix selection keeps meaning what it says. */
const Hook = item(Type.String({ pattern: "^hook:[A-Za-z0-9_.-]+$" }), {
  /** The hook's full name, matcher included. */
  hook_name: Type.String(),
  outcome: Type.Union([
    Type.Literal("additionalContext"),
    Type.Literal("output"),
    Type.Literal("block"),
  ]),
  content: Type.Optional(Text),
  command: Type.Optional(Type.String()),
  exit_code: Type.Optional(Type.Integer()),
  stderr: Type.Optional(Type.String()),
  duration_ms: Type.Optional(Type.Integer({ minimum: 0 })),
  /** The call the hook fired around, for the events that have one. */
  tool_use_id: Type.Optional(Type.String()),
});

// --- tool: `tool:<Name>`, one item for the call and one for the result ---

const ToolType = Type.String({ pattern: "^tool:[A-Za-z0-9_.-]+$" });

function toolUse<N extends string, F extends Record<string, TSchema>>(name: N, fields: F) {
  return item(Type.Literal(`tool:${name}` as const), {
    ...USE_FIELDS,
    ...fields,
  });
}

function toolResult<N extends string, F extends Record<string, TSchema>>(name: N, fields: F) {
  return item(Type.Literal(`tool:${name}` as const), {
    ...RESULT_FIELDS,
    ...fields,
  });
}

const OptText = Type.Optional(Text);
const OptCount = Type.Optional(Type.Integer({ minimum: 0 }));

/** A tool nobody wrote fields for still arrives, carrying what it was called
 * with and what it answered. Fields are added to sharpen how a tool reads, not
 * to decide whether it is kept. */
const ToolUseGeneric = item(ToolType, {
  ...USE_FIELDS,
  input: Type.Record(Type.String(), Type.Unknown()),
});
const ToolResultGeneric = item(ToolType, {
  ...RESULT_FIELDS,
  result: Type.Record(Type.String(), Type.Unknown()),
});

const TOOL_ITEMS = [
  /** No exit code: what the harness records of a shell call is its output and
   * whether it was interrupted, so that is what a reader has to judge by. */
  toolUse("Bash", { command: Type.String(), description: OptText }),
  toolResult("Bash", {
    stdout: OptText,
    stderr: OptText,
    interrupted: Type.Optional(Type.Boolean()),
  }),
  toolUse("Read", {
    file_path: Type.String(),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: OptCount,
  }),
  toolResult("Read", { lines: OptCount, bytes: OptCount }),
  toolUse("Write", { file_path: Type.String(), lines: OptCount }),
  toolResult("Write", { ok: Type.Boolean() }),
  /** The bodies are counted rather than carried: an edit's two sides are the
   * file's content, and a dump that inlined them would be the file. */
  toolUse("Edit", {
    file_path: Type.String(),
    old_lines: OptCount,
    new_lines: OptCount,
  }),
  toolResult("Edit", { ok: Type.Boolean() }),
  toolUse("Grep", { pattern: Type.String(), path: OptText }),
  toolResult("Grep", { matches: OptCount }),
  toolUse("Glob", { pattern: Type.String(), path: OptText }),
  toolResult("Glob", { matches: OptCount }),
  toolUse("WebFetch", { url: Type.String(), prompt: OptText }),
  toolResult("WebFetch", { text: OptText }),
  toolUse("WebSearch", { query: Type.String() }),
  toolResult("WebSearch", { results: OptCount }),
  /** The same exchange `message:sub:*` carries, seen from the calling side:
   * this pair states that an agent was started and how it ended, and what it
   * answered stays with the message. */
  toolUse("Agent", {
    prompt: Type.String(),
    name: OptText,
    subagent_type: OptText,
    description: OptText,
  }),
  toolResult("Agent", { agent_id: OptText, status: OptText }),
  toolUse("SendMessage", { to: Type.String(), summary: OptText }),
  toolResult("SendMessage", { msg_id: OptText, routing: OptText }),
  toolUse("Monitor", {
    description: Type.String(),
    command: OptText,
    persistent: Type.Optional(Type.Boolean()),
    timeout_ms: Type.Optional(Type.Integer({ minimum: 0 })),
  }),
  toolResult("Monitor", { task_id: OptText }),
  toolUse("Skill", { skill: Type.String(), args: OptText }),
  toolResult("Skill", {
    agent_id: OptText,
    background: Type.Optional(Type.Boolean()),
    status: OptText,
  }),
  toolUse("TodoWrite", {
    todos: Type.Array(Type.Object({ content: Type.String(), status: Type.String() })),
  }),
  toolResult("TodoWrite", { ok: Type.Boolean() }),
  toolUse("TaskStop", { task_id: Type.String() }),
  toolResult("TaskStop", { ok: Type.Boolean() }),
  toolUse("CronCreate", { cron: Type.String(), prompt: OptText }),
  toolResult("CronCreate", { cron_id: OptText }),
];

/** One classified item.
 *
 * Items are finer than lines: one assistant record becomes the thinking, the
 * text and each tool call it held. A reader that does not recognise a record
 * still emits one — as a tool it has no fields for, an attachment under its own
 * kind, or `system:unknown` — so nothing in the file goes missing without
 * saying so. */
export const TranscriptItem = Type.Union(
  [
    MessageUserIn,
    MessageUserOut,
    MessageParentIn,
    MessageParentOutSent,
    MessageParentOutSaid,
    MessageSubOut,
    MessageSubIn,
    MessageTeamOut,
    MessageTeamInSaid,
    MessageTeamInDone,
    MessageSessionOut,
    MessageSessionIn,
    Thinking,
    NoticeSlash,
    NoticeInterrupt,
    SystemCompact,
    SystemApiError,
    SystemTask,
    SystemCaveat,
    SystemResume,
    SystemAttachment,
    SystemUnknown,
    Hook,
    ...TOOL_ITEMS,
    ToolUseGeneric,
    ToolResultGeneric,
  ],
  { $id: "TranscriptItem" },
);
export type TranscriptItem = Static<typeof TranscriptItem>;

/** What kind of thing an id names. An id says how to point at something, not
 * what a line is, which is why these are gathered rather than made types of
 * their own — the same agent would otherwise appear once as an item and again
 * as an id. */
export const DumpIdKind = Type.Union(
  [
    Type.Literal("agent"),
    Type.Literal("task"),
    Type.Literal("tool_use"),
    Type.Literal("msg"),
    Type.Literal("sid"),
    Type.Literal("cron"),
  ],
  { $id: "DumpIdKind" },
);
export type DumpIdKind = Static<typeof DumpIdKind>;

export const DumpIdEntry = Type.Object(
  {
    kind: DumpIdKind,
    id: Type.String({ minLength: 1 }),
    /** What the id was called where it appeared — an agent's name, a monitor's
     * description, a peer's working directory. */
    label: Type.Optional(Type.String()),
    /** Where it stood when the dump was written, for the ids that end. */
    status: Type.Optional(Type.String()),
    duration_ms: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { $id: "DumpIdEntry" },
);
export type DumpIdEntry = Static<typeof DumpIdEntry>;

/** The ids the dumped items carried, gathered once.
 *
 * The ledger is what a reader descends by: an agent that did the thing worth
 * copying is named here, and dumping it is the same request with that id as its
 * subject. It is relative to the subject, so an agent's ledger lists the agents
 * it started and not itself. */
export const DumpIds = Type.Array(DumpIdEntry, { $id: "DumpIds" });
export type DumpIds = Static<typeof DumpIds>;

/** The file a dump is written to.
 *
 * The reply to a dump names a path rather than carrying the items, so the file
 * is where they actually travel — which makes its shape as much a part of the
 * contract as the reply is: a successor session handed the path, or a client
 * that fetches it, would otherwise be reading a format nothing states. It
 * repeats what it was asked for, because a file outlives the request that made
 * it and has to say on its own what it is a dump of and what was left out. */
export const SessionDumpFile = Type.Object(
  {
    sid: Sid,
    /** The agent the dump is of, absent when it is of the session itself. */
    agent_id: Type.Optional(Type.String()),
    written_at: Timestamp,
    /** The selection as applied: presets expanded and exclusions kept in
     * place, so the file states what it holds without the instance's config
     * having to be read beside it. */
    types: Type.Array(TranscriptItemSelector),
    /** Oldest first, as the transcript had them. */
    items: Type.Array(TranscriptItem),
    ids: DumpIds,
  },
  { $id: "SessionDumpFile" },
);
export type SessionDumpFile = Static<typeof SessionDumpFile>;

/** A selection an operator named and can ask for by name.
 *
 * Presets are configured on the instance rather than fixed here, because what
 * they name is an interest — "how the work was done", "what to hand over" —
 * and an interest is not a property of the wire. A type name stays one to one
 * with what a record is, and the groupings people actually reach for are made
 * by naming a set of them. */
export const DumpPreset = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
    opts: Type.Object({ types: Type.Array(TranscriptItemSelector) }),
  },
  { $id: "DumpPreset" },
);
export type DumpPreset = Static<typeof DumpPreset>;

/** Reads the presets an instance is configured with.
 *
 * Nothing else states which names a dump may be asked for, so a client with no
 * way to list them could only offer a free-text field and let the instance
 * refuse. A preset that references another is answered as written; the
 * expansion, and the refusal of a cycle or of a name that is not configured,
 * happen where the config is validated. */
export const DumpPresetsReadArgs = Type.Object({});
export type DumpPresetsReadArgs = Static<typeof DumpPresetsReadArgs>;

export const DumpPresetsReadResult = Type.Object({
  /** In configured order. */
  presets: Type.Array(DumpPreset),
});
export type DumpPresetsReadResult = Static<typeof DumpPresetsReadResult>;

export const DumpPresetsReadRequest = request("dump_presets_read", DumpPresetsReadArgs);
export const DumpPresetsReadResponse = response("dump_presets_read", DumpPresetsReadResult);
