import { describe, expect, test } from "bun:test";
import { TopicSubscribeRequest } from "../src/common/topics.ts";
import { AgentsFrame } from "../src/control/agents.ts";
import {
  DirListRequest,
  DirListResponse,
  DirTreeRequest,
  DirTreeResponse,
  FileCreateRequest,
  FileDeleteRequest,
  FileEditRequest,
  FileEditResponse,
  FileFindRequest,
  FileFindResponse,
  FileReadRequest,
  FileReadResponse,
  FileStatBatchRequest,
  FileStatBatchResponse,
  FileWriteRequest,
} from "../src/control/files.ts";
import {
  DumpPresetsReadResponse,
  SessionDumpFile,
  TranscriptItem,
  TranscriptItemSelector,
} from "../src/control/dump.ts";
import {
  LauncherConfigReadResponse,
  LauncherRunRequest,
  LauncherRunResponse,
} from "../src/control/launcher.ts";
import {
  llmCacheWindowEndAt,
  LLM_PROMPT_CACHE_TTL_MS,
  LlmRequestsFrame,
  LlmStatsReadRequest,
  LlmStatsReadResponse,
  LlmStatusFrame,
  LlmUsageReadResponse,
} from "../src/control/llm.ts";
import {
  KvDeleteRequest,
  KvFrame,
  KvReadRequest,
  KvReadResponse,
  KvWriteRequest,
  KvWriteResponse,
} from "../src/control/kv.ts";
import { PeersFrame } from "../src/control/peers.ts";
import { SandboxGrantRequest, SandboxGrantResponse } from "../src/control/sandbox.ts";
import { SessionErrorsFrame } from "../src/control/session-errors.ts";
import { SessionStatusFrame } from "../src/control/session-status.ts";
import {
  SessionDumpWriteRequest,
  SessionEnvReadResponse,
  SessionForkOriginResponse,
  SessionKillRequest,
  SessionKillResponse,
  SessionLastLiveRemoveResponse,
  SessionRenameRequest,
  SessionRenameResponse,
  SessionSearchRequest,
  SessionSearchResponse,
  TITLE_MAX_CHARS,
} from "../src/control/session.ts";
import {
  TranscriptFrame,
  TranscriptItemsFrame,
  TranscriptItemsReadRequest,
  TranscriptItemsReadResponse,
  TranscriptReadRequest,
} from "../src/control/transcript.ts";
import { TranslateRunRequest, TranslateRunResponse } from "../src/control/translate.ts";
import { SESSION_DUMP_FILE, TRANSCRIPT_ITEMS } from "../src/fixtures/control.ts";
import { isValid } from "../src/schemas.ts";

const SID = "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607";
const OTHER_SID = "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b";
const INSTANCE = "3f9c1a7b5e2d48069c1a7b5e2d480691";
const NOW = 1_757_300_000_000;

describe("session ops", () => {
  test("a kill names a session and never a pid", () => {
    expect(isValid(SessionKillRequest, { request_id: "1", op: "session_kill", sid: SID })).toBe(
      true,
    );
    expect(
      isValid(SessionKillRequest, { request_id: "1", op: "session_kill", sid: SID, force: true }),
    ).toBe(true);
  });

  test("a kill without a session to kill is refused", () => {
    expect(isValid(SessionKillRequest, { request_id: "1", op: "session_kill" })).toBe(false);
  });

  test("an unconfirmed termination is a normal reply", () => {
    expect(isValid(SessionKillResponse, { ok: true, request_id: "1", terminated: false })).toBe(
      true,
    );
  });

  test("a rename reports the terminal it typed into and the instance owning it", () => {
    expect(
      isValid(SessionRenameRequest, {
        request_id: "2",
        op: "session_rename",
        sid: SID,
        title: "pv2 control ops",
      }),
    ).toBe(true);
    expect(
      isValid(SessionRenameResponse, {
        ok: true,
        request_id: "2",
        terminal_id: "hy-3f1c",
        instance: INSTANCE,
        title: "pv2 control ops",
      }),
    ).toBe(true);
  });

  test("a title stops at the length the contract states", () => {
    const rename = (title: string) =>
      isValid(SessionRenameRequest, { request_id: "2", op: "session_rename", sid: SID, title });
    expect(TITLE_MAX_CHARS).toBe(200);
    expect(rename("t".repeat(TITLE_MAX_CHARS))).toBe(true);
    expect(rename("t".repeat(TITLE_MAX_CHARS + 1))).toBe(false);
  });

  test("a rename reply without its instance is refused", () => {
    expect(
      isValid(SessionRenameResponse, {
        ok: true,
        request_id: "2",
        terminal_id: "hy-3f1c",
        title: "t",
      }),
    ).toBe(false);
  });

  test("an environment comes back with the pid it was read from", () => {
    expect(
      isValid(SessionEnvReadResponse, {
        ok: true,
        request_id: "3",
        pid: 4821,
        instance: INSTANCE,
        env: { CLAUDE_CONFIG_DIR: "/Users/x/.claude-personal" },
      }),
    ).toBe(true);
  });

  test("a search window is a duration, not an instant", () => {
    expect(
      isValid(SessionSearchRequest, {
        request_id: "4",
        op: "session_search",
        query: "protocol v2",
        modified_within_ms: 5 * 24 * 60 * 60 * 1000,
      }),
    ).toBe(true);
    expect(
      isValid(SessionSearchRequest, {
        request_id: "4",
        op: "session_search",
        modified_within_ms: "5d",
      }),
    ).toBe(false);
  });

  test("a hit names the instance whose host holds its paths", () => {
    const hit = {
      sid: SID,
      instance: INSTANCE,
      config_dir: "/Users/x/.claude-personal",
      file: "/Users/x/.claude-personal/projects/p/s.jsonl",
      cwd: "/Users/x/src/p",
      created_at: NOW,
      updated_at: NOW,
      size: 4096,
      matches: [{ role: "agent", text: "op 表", said_at: NOW }],
      model: "claude-fable-5[1m]",
    };
    expect(
      isValid(SessionSearchResponse, { ok: true, request_id: "4", hits: [hit], truncated: false }),
    ).toBe(true);
    const { instance: _dropped, ...hostless } = hit;
    expect(
      isValid(SessionSearchResponse, {
        ok: true,
        request_id: "4",
        hits: [hostless],
        truncated: false,
      }),
    ).toBe(false);
  });

  test("an unknown field of a hit is refused rather than passed along", () => {
    expect(
      isValid(SessionSearchResponse, {
        ok: true,
        request_id: "4",
        hits: [
          {
            sid: SID,
            instance: INSTANCE,
            config_dir: "/c",
            file: "/f",
            created_at: NOW,
            updated_at: NOW,
            size: 1,
            matches: [],
            title: null,
          },
        ],
        truncated: false,
      }),
    ).toBe(false);
  });

  test("a dump is bounded by an instant or by a record, both spelled out", () => {
    expect(
      isValid(SessionDumpWriteRequest, {
        request_id: "5",
        op: "session_dump_write",
        sid: SID,
        since_at: NOW,
        no_thinking: true,
      }),
    ).toBe(true);
    expect(
      isValid(SessionDumpWriteRequest, {
        request_id: "5",
        op: "session_dump_write",
        sid: SID,
        since_uuid: "1f0e2d3c-4b5a-4968-8776-655443322110",
      }),
    ).toBe(true);
  });

  test("a bound given as an ISO string is refused", () => {
    expect(
      isValid(SessionDumpWriteRequest, {
        request_id: "5",
        op: "session_dump_write",
        sid: SID,
        since_at: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  test("no seam and no ancestor are the same absent origin", () => {
    expect(isValid(SessionForkOriginResponse, { ok: true, request_id: "6" })).toBe(true);
    expect(
      isValid(SessionForkOriginResponse, {
        ok: true,
        request_id: "6",
        origin: { sid: OTHER_SID, boundary_uuid: "a1b2", copied: 812 },
      }),
    ).toBe(true);
  });

  test("a null origin is refused — absence is how this contract says nothing", () => {
    expect(isValid(SessionForkOriginResponse, { ok: true, request_id: "6", origin: null })).toBe(
      false,
    );
  });

  test("removing an entry nobody had is a success", () => {
    expect(
      isValid(SessionLastLiveRemoveResponse, { ok: true, request_id: "7", removed: false }),
    ).toBe(true);
  });
});

describe("transcript items", () => {
  test("every item a reader emits passes", () => {
    for (const item of TRANSCRIPT_ITEMS) expect(isValid(TranscriptItem, item)).toBe(true);
  });

  test("a tool nobody wrote fields for still arrives, with what it was called with", () => {
    expect(
      isValid(TranscriptItem, {
        id: "aa11bb22:0",
        uuid: "aa11bb22",
        source: { offset: 4_096, bytes: 310 },
        type: "tool:Workflow",
        at: 1_757_300_000_000,
        role: "use",
        tool_use_id: "toolu_02",
        input: { script: "resume.ts" },
      }),
    ).toBe(true);
  });

  test("an attachment of a kind nobody has seen keeps its own name", () => {
    expect(
      isValid(TranscriptItem, {
        id: "bb22cc33:0",
        uuid: "bb22cc33",
        source: { offset: 4_406, bytes: 120 },
        type: "system:attachment:telemetry",
        at: 1_757_300_000_000,
        attachment: { type: "telemetry" },
      }),
    ).toBe(true);
  });

  test("a hook is typed by its event, and carries the matcher as a field", () => {
    // `hook:PreToolUse:Bash` would read as a third level of the hierarchy and
    // leave `hook:PreToolUse` selecting nothing.
    const hook = {
      id: "cc33dd44:0",
      uuid: "cc33dd44",
      source: { offset: 4_526, bytes: 240 },
      type: "hook:PreToolUse",
      at: 1_757_300_000_000,
      hook_name: "PreToolUse:Bash",
      outcome: "additionalContext",
    };
    expect(isValid(TranscriptItem, hook)).toBe(true);
    expect(isValid(TranscriptItem, { ...hook, outcome: "allowed" })).toBe(false);
  });

  test("an item without the record it came out of is refused", () => {
    const { uuid: _dropped, ...rest } = TRANSCRIPT_ITEMS[0] as Record<string, unknown>;
    expect(isValid(TranscriptItem, rest)).toBe(false);
  });

  test("an item without its own identity is refused", () => {
    const { id: _dropped, ...rest } = TRANSCRIPT_ITEMS[0] as Record<string, unknown>;
    expect(isValid(TranscriptItem, rest)).toBe(false);
  });

  test("several items out of one record are told apart by index and share an address", () => {
    // The record id alone names all of them at once, which is what a link
    // pointing by `uuid` could not resolve.
    const [thinking, call] = TRANSCRIPT_ITEMS.filter((item) => item.uuid === "f10b6d43");
    expect(thinking?.id).toBe("f10b6d43:0");
    expect(call?.id).toBe("f10b6d43:1");
    expect(call?.source).toEqual(thinking?.source);
  });

  test("a link names an item, not the record it sits in", () => {
    const result = TRANSCRIPT_ITEMS.find((item) => item.id === "18d6f2c9:0") as Record<
      string,
      unknown
    >;
    expect(result["parent_item"]).toBe("f10b6d43:1");
    expect(isValid(TranscriptItem, { ...result, parent_item: "f10b6d43" })).toBe(false);
  });

  test("an item names where its record begins and how far it runs, so it can be fetched raw", () => {
    const [first] = TRANSCRIPT_ITEMS as Record<string, unknown>[];
    expect(isValid(TranscriptItem, { ...first, source: { offset: 0 } })).toBe(false);
    // A record occupies at least one byte; a zero-length one is nothing to read.
    expect(isValid(TranscriptItem, { ...first, source: { offset: 0, bytes: 0 } })).toBe(false);
    expect(isValid(TranscriptItem, { ...first, source: { offset: 0, bytes: 1 } })).toBe(true);
  });

  test("the file says what it is a dump of, so the path alone is enough to read it", () => {
    const file = { ...SESSION_DUMP_FILE, items: TRANSCRIPT_ITEMS };
    expect(isValid(SessionDumpFile, file)).toBe(true);
    // A dump that matched nothing is a file with no items, not a file without
    // the field.
    const { items: _dropped, ...rest } = file;
    expect(isValid(SessionDumpFile, rest)).toBe(false);
    expect(isValid(SessionDumpFile, { ...file, items: [] })).toBe(true);
  });

  test("an item keeps its shape in TypeScript, so a reader writes `item.uuid` and not a cast", () => {
    for (const item of TRANSCRIPT_ITEMS) {
      const uuid: string = item.uuid;
      expect(typeof uuid).toBe("string");
    }
  });

  test("a selection names types, prefixes, exclusions and presets", () => {
    for (const selector of ["tool", "tool:Bash", "-message:sub", "@howto", "system:api-error"])
      expect(isValid(TranscriptItemSelector, selector)).toBe(true);
    for (const selector of ["", "tool:", "@", "-@ho to", "Tool"])
      expect(isValid(TranscriptItemSelector, selector)).toBe(false);
  });

  test("presets are the instance's, so an unconfigured list is empty and not absent", () => {
    expect(isValid(DumpPresetsReadResponse, { ok: true, request_id: "9", presets: [] })).toBe(true);
    expect(isValid(DumpPresetsReadResponse, { ok: true, request_id: "9" })).toBe(false);
  });
});

describe("transcript", () => {
  test("a read pages by byte offset and never by path", () => {
    expect(
      isValid(TranscriptReadRequest, {
        request_id: "8",
        op: "transcript_read",
        sid: SID,
        before: 1_048_576,
        max_bytes: 65_536,
      }),
    ).toBe(true);
  });

  test("a read may name an agent below the session", () => {
    expect(
      isValid(TranscriptReadRequest, {
        request_id: "8",
        op: "transcript_read",
        sid: SID,
        agent_id: "a3f1c9d2",
        run_id: "wf_1a2b3c4d-001",
      }),
    ).toBe(true);
  });

  test("an offset that is not one is refused", () => {
    expect(
      isValid(TranscriptReadRequest, {
        request_id: "8",
        op: "transcript_read",
        sid: SID,
        before: "1048576",
      }),
    ).toBe(false);
  });

  test("the typed read is cut like a dump and resumed by the item it stopped at", () => {
    expect(
      isValid(TranscriptItemsReadRequest, {
        request_id: "8",
        op: "transcript_items_read",
        sid: SID,
        since_id: "f10b6d43:1",
        types: ["tool", "-tool:Read"],
        limit: 100,
      }),
    ).toBe(true);
    // A record id is not an item id: resuming from one would read again what a
    // limit already answered.
    expect(
      isValid(TranscriptItemsReadRequest, {
        request_id: "8",
        op: "transcript_items_read",
        sid: SID,
        since_id: "f10b6d43",
      }),
    ).toBe(false);
  });

  test("an upper bound alone reads the range's end and pages back by item id", () => {
    expect(
      isValid(TranscriptItemsReadRequest, {
        request_id: "8",
        op: "transcript_items_read",
        sid: SID,
        until_id: "18d6f2c9:0",
        limit: 50,
      }),
    ).toBe(true);
    // The bound is an item, not the record it came from: stopping at a record
    // would answer again the items of it a backward read already held.
    expect(
      isValid(TranscriptItemsReadRequest, {
        request_id: "8",
        op: "transcript_items_read",
        sid: SID,
        until_id: "18d6f2c9",
      }),
    ).toBe(false);
    expect(
      isValid(TranscriptItemsReadResponse, {
        ok: true,
        request_id: "8",
        items: TRANSCRIPT_ITEMS,
        prev: "3f9a21c4:0",
      }),
    ).toBe(true);
    // A record id is no more a continuation than it is a bound.
    expect(
      isValid(TranscriptItemsReadResponse, {
        ok: true,
        request_id: "8",
        items: TRANSCRIPT_ITEMS,
        prev: "3f9a21c4",
      }),
    ).toBe(false);
  });

  test("a read that answered the whole range names nothing to come next", () => {
    expect(
      isValid(TranscriptItemsReadResponse, { ok: true, request_id: "8", items: TRANSCRIPT_ITEMS }),
    ).toBe(true);
    // An empty answer is an empty list, not a missing field.
    expect(isValid(TranscriptItemsReadResponse, { ok: true, request_id: "8", items: [] })).toBe(
      true,
    );
    expect(isValid(TranscriptItemsReadResponse, { ok: true, request_id: "8" })).toBe(false);
  });

  test("the typed topic carries items where the raw one carries bytes", () => {
    const frame = {
      ev: "topic",
      topic: `transcript_items:${SID}`,
      instance: INSTANCE,
      data: { sid: SID, items: TRANSCRIPT_ITEMS },
    };
    expect(isValid(TranscriptItemsFrame, frame)).toBe(true);
    // The opening frame is the same shape as the ones after it: the tail of the
    // list, appended to like any later batch.
    expect(isValid(TranscriptItemsFrame, { ...frame, snapshot: true })).toBe(true);
    // Bytes are the other topic's; this one only ever carries items.
    expect(
      isValid(TranscriptItemsFrame, {
        ...frame,
        data: { sid: SID, lines: ['{"type":"assistant"}'], start: 0, end: 21, size: 21 },
      }),
    ).toBe(false);
  });

  test("the snapshot states where the file ends and the deltas append to it", () => {
    expect(
      isValid(TranscriptFrame, {
        ev: "topic",
        topic: `transcript:${SID}`,
        snapshot: true,
        instance: INSTANCE,
        data: { sid: SID, size: 4_096 },
      }),
    ).toBe(true);
    expect(
      isValid(TranscriptFrame, {
        ev: "topic",
        topic: `transcript:${SID}`,
        instance: INSTANCE,
        data: { sid: SID, lines: ['{"type":"assistant"}'], start: 4_096, end: 4_117, size: 4_117 },
      }),
    ).toBe(true);
  });
});

describe("file access", () => {
  test("the surface is an argument, so one op serves all three", () => {
    for (const kind of ["contained", "workspace", "external"]) {
      expect(
        isValid(FileReadRequest, {
          request_id: "9",
          op: "file_read",
          sid: SID,
          kind,
          path: "docs/design/protocol-v2.md",
        }),
      ).toBe(true);
    }
  });

  test("listing and searching offer no external surface — it names no directory", () => {
    expect(
      isValid(DirListRequest, {
        request_id: "9",
        op: "dir_list",
        sid: SID,
        kind: "external",
        path: "/tmp",
      }),
    ).toBe(false);
    expect(
      isValid(FileFindRequest, {
        request_id: "9",
        op: "file_find",
        sid: SID,
        kind: "external",
        query: "protocol",
      }),
    ).toBe(false);
  });

  test("a listing states its entries' times as instants", () => {
    expect(
      isValid(DirListResponse, {
        ok: true,
        request_id: "9",
        sid: SID,
        path: "docs",
        entries: [
          { name: "design", type: "dir" },
          { name: "DESIGN.md", type: "file", size: 4_096, mtime_at: NOW },
        ],
      }),
    ).toBe(true);
  });

  test("an ISO mtime is refused wherever it appears", () => {
    expect(
      isValid(DirListResponse, {
        ok: true,
        request_id: "9",
        sid: SID,
        path: "",
        entries: [{ name: "a", type: "file", mtime_at: "2026-09-08T00:00:00Z" }],
      }),
    ).toBe(false);
    expect(
      isValid(FileReadResponse, {
        ok: true,
        request_id: "9",
        sid: SID,
        path: "a",
        size: 1,
        truncated: false,
        binary: false,
        content: "x",
        mtime_at: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  test("an edit carries the lock the read handed it", () => {
    expect(
      isValid(FileEditRequest, {
        request_id: "10",
        op: "file_edit",
        sid: SID,
        kind: "contained",
        path: "docs/DESIGN.md",
        content: "new",
        expected_mtime_at: NOW,
        expected_size: 4_096,
      }),
    ).toBe(true);
    expect(
      isValid(FileEditResponse, {
        ok: true,
        request_id: "10",
        sid: SID,
        path: "docs/DESIGN.md",
        size: 3,
        mtime_at: NOW + 1_000,
      }),
    ).toBe(true);
  });

  test("an edit without its lock is refused", () => {
    expect(
      isValid(FileEditRequest, {
        request_id: "10",
        op: "file_edit",
        sid: SID,
        kind: "contained",
        path: "a",
        content: "new",
      }),
    ).toBe(false);
  });

  test("create and delete take only the surfaces that name a directory", () => {
    expect(
      isValid(FileCreateRequest, {
        request_id: "11",
        op: "file_create",
        sid: SID,
        kind: "workspace",
        path: "/Users/x/ws/notes.md",
        content: "",
      }),
    ).toBe(true);
    expect(
      isValid(FileDeleteRequest, {
        request_id: "11",
        op: "file_delete",
        sid: SID,
        kind: "external",
        path: "/tmp/x",
      }),
    ).toBe(false);
  });

  test("an inbox write takes no surface — its destination is fixed", () => {
    expect(
      isValid(FileWriteRequest, {
        request_id: "12",
        op: "file_write",
        sid: SID,
        path: "docs/inbox/note.md",
        content: "text",
      }),
    ).toBe(true);
  });

  test("a find says when its hits are not all of them", () => {
    expect(
      isValid(FileFindRequest, {
        request_id: "13",
        op: "file_find",
        sid: SID,
        kind: "contained",
        query: "protocol -node_modules",
        respect_gitignore: false,
      }),
    ).toBe(true);
    expect(
      isValid(FileFindResponse, {
        ok: true,
        request_id: "13",
        sid: SID,
        hits: [{ path: "src/index.ts", type: "file" }],
        truncated: true,
      }),
    ).toBe(true);
  });

  test("an unresolved path keeps its slot, so the reply lines up with the request", () => {
    expect(
      isValid(FileStatBatchRequest, {
        request_id: "14",
        op: "file_stat_batch",
        sid: SID,
        paths: ["/Users/x/src/p/a.ts", "/nope"],
      }),
    ).toBe(true);
    expect(
      isValid(FileStatBatchResponse, {
        ok: true,
        request_id: "14",
        results: [{ kind: "contained", path: "a.ts" }, null],
      }),
    ).toBe(true);
  });

  test("a tree node whose children are absent is one a client may expand", () => {
    expect(
      isValid(DirTreeRequest, {
        request_id: "15",
        op: "dir_tree",
        roots: ["/Users/x/src"],
        depth: 1,
      }),
    ).toBe(true);
    expect(
      isValid(DirTreeResponse, {
        ok: true,
        request_id: "15",
        entries: [
          { path: "/Users/x/src", children: [{ path: "/Users/x/src/p", children: [] }] },
          { path: "/Users/x/work" },
        ],
      }),
    ).toBe(true);
  });
});

describe("launcher, sandbox and translate", () => {
  test("the configuration is the form: roots, recipes and their parameters", () => {
    expect(
      isValid(LauncherConfigReadResponse, {
        ok: true,
        request_id: "16",
        root_dirs: ["/Users/x/src"],
        templates: [
          {
            name: "default",
            command: 'cd "$CWD" && claude --model "$MODEL"',
            params: [
              { name: "CWD", default: "" },
              { name: "MODEL", default: "opus" },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test("a run states its outcome, and a signal leaves no code to state", () => {
    expect(
      isValid(LauncherRunRequest, {
        request_id: "17",
        op: "launcher_run",
        cwd: "/Users/x/src/p",
        params: { MODEL: "opus" },
        template: "default",
      }),
    ).toBe(true);
    expect(
      isValid(LauncherRunResponse, {
        ok: true,
        request_id: "17",
        stdout: "started",
        stderr: "",
        timed_out: false,
      }),
    ).toBe(true);
  });

  test("a null exit code is refused — the absent field is how a signal reads", () => {
    expect(
      isValid(LauncherRunResponse, {
        ok: true,
        request_id: "17",
        stdout: "",
        stderr: "",
        exit_code: null,
        timed_out: false,
      }),
    ).toBe(false);
  });

  test("a grant expires at an instant and is minted per surface", () => {
    expect(
      isValid(SandboxGrantRequest, {
        request_id: "18",
        op: "sandbox_grant",
        sid: SID,
        kind: "external",
        path: "/Users/x/report.html",
      }),
    ).toBe(true);
    expect(
      isValid(SandboxGrantResponse, {
        ok: true,
        request_id: "18",
        gid: "g7f2",
        token: "s3cret",
        url: "https://g7f2.sandbox.example/report.html",
        expires_at: NOW + 30 * 60 * 1000,
      }),
    ).toBe(true);
  });

  test("a batch succeeds while individual texts fail", () => {
    expect(
      isValid(TranslateRunRequest, { request_id: "19", op: "translate_run", texts: ["hello"] }),
    ).toBe(true);
    expect(
      isValid(TranslateRunResponse, {
        ok: true,
        request_id: "19",
        results: [
          { ok: true, text: "こんにちは" },
          { ok: false, error: "not installed" },
        ],
      }),
    ).toBe(true);
  });
});

describe("llm", () => {
  test("spend comes back keyed by the gateway's own days", () => {
    expect(isValid(LlmStatsReadRequest, { request_id: "20", op: "llm_stats_read", days: 30 })).toBe(
      true,
    );
    expect(
      isValid(LlmStatsReadResponse, {
        ok: true,
        request_id: "20",
        generated_at: NOW,
        days: { "2026-09-07": { credentials: { "-": { opus: { usd: 1.5 } } }, total_usd: 1.5 } },
      }),
    ).toBe(true);
  });

  test("quota reports a window's length as a duration and its reset as an instant", () => {
    expect(
      isValid(LlmUsageReadResponse, {
        ok: true,
        request_id: "21",
        generated_at: NOW,
        credentials: [
          {
            name: "personal",
            support: "observed",
            snapshot: {
              observed_at: NOW - 60_000,
              windows: {
                "5h": { utilization: 0.13, status: "allowed", reset_at: NOW, window_secs: 18_000 },
              },
            },
          },
        ],
      }),
    ).toBe(true);
  });

  test("the cache window ends where the gateway says, or where the assumption does", () => {
    expect(llmCacheWindowEndAt({ received_at: NOW, cache_expires_at: NOW + 3_600_000 })).toBe(
      NOW + 3_600_000,
    );
    expect(llmCacheWindowEndAt({ received_at: NOW, origin: "main" })).toBe(NOW);
    expect(llmCacheWindowEndAt({ received_at: NOW })).toBe(NOW + LLM_PROMPT_CACHE_TTL_MS);
  });

  test("a request frame is a whole unexpired set, each entry naming its instance", () => {
    expect(
      isValid(LlmRequestsFrame, {
        ev: "topic",
        topic: "llm_requests",
        snapshot: true,
        instance: INSTANCE,
        data: [
          {
            received_at: NOW,
            sid: SID,
            instance: INSTANCE,
            prefix: "9f2c7a5e",
            main: true,
            origin: "main",
            cache_expires_at: NOW + 3_600_000,
            cache_ttl_secs: 3_600,
            model: "claude-fable-5",
            status: 200,
          },
        ],
      }),
    ).toBe(true);
  });

  test("a request whose instant is spelled the old way is refused", () => {
    expect(
      isValid(LlmRequestsFrame, {
        ev: "topic",
        topic: "llm_requests",
        instance: INSTANCE,
        data: [{ ts: NOW, sid: SID, instance: INSTANCE, main: true }],
      }),
    ).toBe(false);
  });

  test("a status report is one whole value per frame", () => {
    expect(
      isValid(LlmStatusFrame, {
        ev: "topic",
        topic: "llm_status",
        instance: INSTANCE,
        data: {
          generated_at: NOW,
          overall: { severity: "warning", service_counts: { ok: 2, warning: 1 } },
          services: [
            {
              id: "anthropic",
              name: "Anthropic",
              severity: "warning",
              routes: ["default"],
              official: {
                state: "degraded",
                observed_at: NOW,
                components: [{ name: "API", state: "degraded" }],
                incidents: [{ name: "Elevated errors", state: "investigating", created_at: NOW }],
              },
              observed: { state: "failing", last_failure: { at: NOW, status: 529 } },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a severity outside the closed set is refused", () => {
    expect(
      isValid(LlmStatusFrame, {
        ev: "topic",
        topic: "llm_status",
        instance: INSTANCE,
        data: { overall: { severity: "catastrophic", service_counts: {} }, services: [] },
      }),
    ).toBe(false);
  });
});

describe("session observation topics", () => {
  const peer = {
    sid: SID,
    instance: INSTANCE,
    repo: "kawaz/ccmsg-protocol",
    ws: "main",
    cwd: "/Users/x/src/ccmsg-protocol/main",
    transcript_path: "/Users/x/.claude-personal/projects/p/s.jsonl",
    branch: "main",
    connected_at: NOW,
    last_activity_at: NOW,
    protocol_version: 3,
  };

  test("both lists travel together, because a session moves between them", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        snapshot: true,
        instance: INSTANCE,
        data: {
          peers: [peer],
          last_live: [
            {
              sid: OTHER_SID,
              instance: INSTANCE,
              repo: "kawaz/ccmsg",
              ws: "main",
              cwd: "/Users/x/src/ccmsg/main",
              last_seen_at: NOW - 3_600_000,
              model: "claude-opus-5[1m]",
            },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a peer whose generation is a guess is refused", () => {
    const { protocol_version: _dropped, ...unannounced } = peer;
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [unannounced], last_live: [] },
      }),
    ).toBe(false);
  });

  test("an empty list is stated, not omitted", () => {
    expect(
      isValid(PeersFrame, {
        ev: "topic",
        topic: "peers",
        instance: INSTANCE,
        data: { peers: [peer] },
      }),
    ).toBe(false);
  });

  test("the harness's own view arrives renamed, with its terminal handle", () => {
    expect(
      isValid(AgentsFrame, {
        ev: "topic",
        topic: "agents",
        snapshot: true,
        instance: INSTANCE,
        data: {
          agents: [
            {
              sid: SID,
              instance: INSTANCE,
              pid: 4821,
              cwd: "/Users/x/src/p",
              kind: "interactive",
              started_at: NOW,
              name: "pv2-control-ops",
              status: "running",
              config_dir: "/Users/x/.claude-personal",
              terminal_id: "hy-3f1c",
            },
          ],
          polled_at: NOW,
        },
      }),
    ).toBe(true);
  });

  test("the harness's camelCase does not reach the wire", () => {
    expect(
      isValid(AgentsFrame, {
        ev: "topic",
        topic: "agents",
        instance: INSTANCE,
        data: {
          agents: [
            {
              sessionId: SID,
              instance: INSTANCE,
              pid: 1,
              cwd: "/",
              kind: "interactive",
              startedAt: NOW,
              config_dir: "/c",
            },
          ],
        },
      }),
    ).toBe(false);
  });

  test("a status snapshot carries the fold, with every list present", () => {
    expect(
      isValid(SessionStatusFrame, {
        ev: "topic",
        topic: `session_status:${SID}`,
        snapshot: true,
        instance: INSTANCE,
        data: {
          sid: SID,
          todos: [
            {
              id: "1",
              subject: "control 25 op",
              status: "in_progress",
              blocked_by: [],
              blocks: ["2"],
            },
          ],
          workflows: [],
          background: [],
          teammates: [],
          agent_tree: {
            teammates: [],
            agents: [
              {
                agent_id: "a3f1c9d2",
                agent_type: "Explore",
                spawn_depth: 0,
                kind: "subagent",
                state: "active",
                last_activity_at: NOW,
                children: [],
              },
            ],
            workflows: [],
          },
          external_files: [{ path: "/Users/x/notes.md", origin: "tool" }],
          workspace_folders: [],
          context: { tokens: 128_000, model: "claude-fable-5", observed_at: NOW },
        },
      }),
    ).toBe(true);
  });

  test("a stopped session states when it stopped as an instant", () => {
    expect(
      isValid(SessionErrorsFrame, {
        ev: "topic",
        topic: "session_errors",
        instance: INSTANCE,
        data: {
          errors: [{ sid: SID, instance: INSTANCE, text: "API Error: 529", occurred_at: NOW }],
        },
      }),
    ).toBe(true);
    expect(
      isValid(SessionErrorsFrame, {
        ev: "topic",
        topic: "session_errors",
        instance: INSTANCE,
        data: {
          errors: [{ sid: SID, instance: INSTANCE, text: "x", timestamp: "2026-09-08T00:00:00Z" }],
        },
      }),
    ).toBe(false);
  });
});

describe("the shared key-value store", () => {
  test("a value may be any JSON, and nothing here reads it", () => {
    for (const value of [{ bg: "#101014", fg: "#e8e8ea" }, "dark", 42, true, null, [1, 2, 3]]) {
      expect(
        isValid(KvWriteRequest, {
          request_id: "23",
          op: "kv_write",
          ns: "theme",
          key: "default",
          value,
        }),
      ).toBe(true);
    }
  });

  test("a write may carry the time the value was written", () => {
    expect(
      isValid(KvWriteRequest, {
        request_id: "23",
        op: "kv_write",
        ns: "theme",
        key: "device:ipad",
        value: {},
        updated_at: NOW,
      }),
    ).toBe(true);
    expect(isValid(KvWriteResponse, { ok: true, request_id: "23", updated_at: NOW })).toBe(true);
  });

  test("a written time given as an ISO string is refused", () => {
    expect(
      isValid(KvWriteRequest, {
        request_id: "23",
        op: "kv_write",
        ns: "theme",
        key: "default",
        value: {},
        updated_at: "2026-09-08T00:00:00Z",
      }),
    ).toBe(false);
  });

  test("a read answers with the value and when it was written", () => {
    expect(
      isValid(KvReadRequest, { request_id: "24", op: "kv_read", ns: "theme", key: "default" }),
    ).toBe(true);
    expect(
      isValid(KvReadResponse, {
        ok: true,
        request_id: "24",
        value: { bg: "#101014" },
        updated_at: NOW,
      }),
    ).toBe(true);
  });

  test("a read that cannot say when is refused", () => {
    expect(isValid(KvReadResponse, { ok: true, request_id: "24", value: {} })).toBe(false);
  });

  test("a key holds what a person typed, within bounds", () => {
    const del = (key: unknown) =>
      isValid(KvDeleteRequest, { request_id: "25", op: "kv_delete", ns: "theme", key });
    expect(del("device:kawaz の ipad")).toBe(true);
    expect(del("x".repeat(256))).toBe(true);
    expect(del("x".repeat(257))).toBe(false);
    expect(del("")).toBe(false);
    expect(del("device:\nipad")).toBe(false);
  });

  test("a namespace stays an identifier, since it names a topic too", () => {
    const write = (ns: unknown) =>
      isValid(KvWriteRequest, { request_id: "25", op: "kv_write", ns, key: "k", value: 1 });
    expect(write("theme")).toBe(true);
    expect(write("Theme")).toBe(false);
    expect(write("theme:extra")).toBe(false);
    expect(write("")).toBe(false);
  });

  test("its topic is subscribed to by namespace", () => {
    expect(
      isValid(TopicSubscribeRequest, {
        request_id: "26",
        op: "topic_subscribe",
        topic: "kv:theme",
      }),
    ).toBe(true);
    expect(
      isValid(TopicSubscribeRequest, { request_id: "26", op: "topic_subscribe", topic: "kv" }),
    ).toBe(false);
    expect(
      isValid(TopicSubscribeRequest, {
        request_id: "26",
        op: "topic_subscribe",
        topic: "kv:Theme",
      }),
    ).toBe(false);
  });

  test("the snapshot is every entry, and a change is the entries that changed", () => {
    expect(
      isValid(KvFrame, {
        ev: "topic",
        topic: "kv:theme",
        snapshot: true,
        instance: INSTANCE,
        data: {
          entries: [
            { key: "default", value: { bg: "#101014" }, updated_at: NOW },
            { key: "device:ipad", value: { bg: "#000" }, updated_at: NOW - 1_000 },
          ],
        },
      }),
    ).toBe(true);
  });

  test("a removal travels as a marked entry, not as an absence", () => {
    expect(
      isValid(KvFrame, {
        ev: "topic",
        topic: "kv:theme",
        instance: INSTANCE,
        data: { entries: [{ key: "device:ipad", updated_at: NOW, deleted: true }] },
      }),
    ).toBe(true);
  });

  test("`deleted: false` is refused — the mark is present or absent", () => {
    expect(
      isValid(KvFrame, {
        ev: "topic",
        topic: "kv:theme",
        instance: INSTANCE,
        data: { entries: [{ key: "k", value: 1, updated_at: NOW, deleted: false }] },
      }),
    ).toBe(false);
  });

  test("an entry that cannot be ordered against another instance's is refused", () => {
    expect(
      isValid(KvFrame, {
        ev: "topic",
        topic: "kv:theme",
        instance: INSTANCE,
        data: { entries: [{ key: "default", value: 1 }] },
      }),
    ).toBe(false);
  });
});
