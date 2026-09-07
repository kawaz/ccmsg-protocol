import { describe, expect, test } from "bun:test";
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
} from "../src/control/session.ts";
import { TraceWriteRequest } from "../src/control/trace.ts";
import { TranscriptFrame, TranscriptReadRequest } from "../src/control/transcript.ts";
import { TranslateRunRequest, TranslateRunResponse } from "../src/control/translate.ts";
import { isValid } from "../src/schemas.ts";

const SID = "6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607";
const OTHER_SID = "0e9d8c7b-6a5f-4e3d-9c2b-1a0f9e8d7c6b";
const INSTANCE = "wss://mba.example.ts.net/ccmsg/personal";
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
    protocol_version: 2,
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

describe("diagnostics", () => {
  test("a trace names its stages by what happens, not by who does it", () => {
    expect(
      isValid(TraceWriteRequest, {
        request_id: "22",
        op: "trace_write",
        sid: SID,
        start: 0,
        end: 4_096,
        size: 4_096,
        sampled: true,
        elapsed_ms: 42,
        points: [
          { at: NOW, edge: "in", kind: "receive" },
          { at: NOW + 5, edge: "out", kind: "render" },
        ],
      }),
    ).toBe(true);
  });

  test("a stage named for one client's own internals is refused", () => {
    expect(
      isValid(TraceWriteRequest, {
        request_id: "22",
        op: "trace_write",
        sid: SID,
        start: 0,
        end: 1,
        size: 1,
        sampled: false,
        elapsed_ms: 1,
        points: [{ at: NOW, edge: "in", kind: "dom_commit" }],
      }),
    ).toBe(false);
  });
});
