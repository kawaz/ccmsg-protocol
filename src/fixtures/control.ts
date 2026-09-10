import type { Static } from "@sinclair/typebox";
import type {
  DirListRequest,
  DirListResponse,
  DirTreeRequest,
  DirTreeResponse,
  FileCreateRequest,
  FileCreateResponse,
  FileDeleteRequest,
  FileDeleteResponse,
  FileEditRequest,
  FileEditResponse,
  FileFindRequest,
  FileFindResponse,
  FileReadRequest,
  FileReadResponse,
  FileStatBatchRequest,
  FileStatBatchResponse,
  FileWriteRequest,
  FileWriteResponse,
} from "../control/files.ts";
import type {
  KvDeleteRequest,
  KvDeleteResponse,
  KvReadRequest,
  KvReadResponse,
  KvWriteRequest,
  KvWriteResponse,
} from "../control/kv.ts";
import type {
  LauncherConfigReadRequest,
  LauncherConfigReadResponse,
  LauncherRunRequest,
  LauncherRunResponse,
} from "../control/launcher.ts";
import type {
  LlmStatsReadRequest,
  LlmStatsReadResponse,
  LlmUsageReadRequest,
  LlmUsageReadResponse,
} from "../control/llm.ts";
import type {
  SandboxGrantRequest,
  SandboxGrantResponse,
  SandboxRevokeRequest,
  SandboxRevokeResponse,
} from "../control/sandbox.ts";
import type {
  DumpPresetsReadRequest,
  DumpPresetsReadResponse,
  SessionDumpFile,
  TranscriptItem,
} from "../control/dump.ts";
import type {
  SessionDumpWriteRequest,
  SessionDumpWriteResponse,
  SessionEnvReadRequest,
  SessionEnvReadResponse,
  SessionForkOriginRequest,
  SessionForkOriginResponse,
  SessionKillRequest,
  SessionKillResponse,
  SessionLastLiveRemoveRequest,
  SessionLastLiveRemoveResponse,
  SessionRenameRequest,
  SessionRenameResponse,
  SessionSearchRequest,
  SessionSearchResponse,
} from "../control/session.ts";
import type {
  TranscriptItemsReadRequest,
  TranscriptItemsReadResponse,
  TranscriptReadRequest,
  TranscriptReadResponse,
} from "../control/transcript.ts";
import type { TranslateRunRequest, TranslateRunResponse } from "../control/translate.ts";
import { FIXTURE_IDS, FIXTURE_NOW } from "./ids.ts";

const { sid, other_sid, instance, request_id } = FIXTURE_IDS;

const WORKSPACE = "/repos/kawaz/ccmsg-protocol/main";
const FILE_PATH = "src/fixtures/index.ts";

export const SESSION_KILL_REQUEST: Static<typeof SessionKillRequest> = {
  request_id,
  op: "session_kill",
  to_instance: instance,
  sid,
  force: false,
};

export const SESSION_KILL_RESPONSE: Static<typeof SessionKillResponse> = {
  ok: true,
  request_id,
  terminated: true,
};

export const SESSION_RENAME_REQUEST: Static<typeof SessionRenameRequest> = {
  request_id,
  op: "session_rename",
  sid,
  title: "contract fixtures",
};

export const SESSION_RENAME_RESPONSE: Static<typeof SessionRenameResponse> = {
  ok: true,
  request_id,
  terminal_id: "%17",
  instance,
  title: "contract fixtures",
};

export const SESSION_ENV_READ_REQUEST: Static<typeof SessionEnvReadRequest> = {
  request_id,
  op: "session_env_read",
  sid,
};

export const SESSION_ENV_READ_RESPONSE: Static<typeof SessionEnvReadResponse> = {
  ok: true,
  request_id,
  pid: 4821,
  instance,
  env: { CLAUDE_CONFIG_DIR: "/config/claude-personal", PWD: WORKSPACE },
};

export const SESSION_SEARCH_REQUEST: Static<typeof SessionSearchRequest> = {
  request_id,
  op: "session_search",
  query: "fixture",
  target_agent: true,
  modified_within_ms: 86_400_000,
};

export const SESSION_SEARCH_RESPONSE: Static<typeof SessionSearchResponse> = {
  ok: true,
  request_id,
  hits: [
    {
      sid,
      instance,
      config_dir: "/config/claude-personal",
      file: "/transcripts/6f1a2b3c.jsonl",
      cwd: WORKSPACE,
      repo: "ccmsg-protocol",
      ws: "main",
      title: "contract fixtures",
      created_at: FIXTURE_NOW - 3_600_000,
      updated_at: FIXTURE_NOW,
      size: 182_400,
      matches: [{ role: "agent", text: "fixture を export する", said_at: FIXTURE_NOW }],
      model: "claude-opus-5",
      effort: "high",
    },
  ],
  truncated: false,
};

export const SESSION_DUMP_WRITE_REQUEST: Static<typeof SessionDumpWriteRequest> = {
  request_id,
  op: "session_dump_write",
  sid,
  agent_id: "a471372f2",
  since_at: FIXTURE_NOW - 3_600_000,
  preset: "howto",
  types: ["@file", "-tool:Grep", "thinking"],
};

export const SESSION_DUMP_WRITE_RESPONSE: Static<typeof SessionDumpWriteResponse> = {
  ok: true,
  request_id,
  path: "/transcripts/6f1a2b3c.dump.json",
  instance,
  entries: { thinking: 41, "tool:Bash": 62, "tool:Read": 25 },
  ids: [
    {
      kind: "agent",
      id: "a471372f2",
      label: "dump-kinds-design",
      status: "ok",
      duration_ms: 252_000,
    },
    { kind: "task", id: "b6mmcr0ax", label: "just watch", status: "running" },
    { kind: "sid", id: other_sid, label: "ccmsg-webui/main" },
  ],
  bytes: 65_536,
};

/** The file the reply above names, holding the items themselves. */
export const SESSION_DUMP_FILE: Static<typeof SessionDumpFile> = {
  sid,
  agent_id: "a471372f2",
  written_at: FIXTURE_NOW,
  types: ["tool:Read", "tool:Write", "tool:Edit", "tool:Glob", "thinking"],
  items: [],
  ids: [{ kind: "agent", id: "a471372f2", label: "dump-kinds-design", status: "ok" }],
};

export const DUMP_PRESETS_READ_REQUEST: Static<typeof DumpPresetsReadRequest> = {
  request_id,
  op: "dump_presets_read",
};

export const DUMP_PRESETS_READ_RESPONSE: Static<typeof DumpPresetsReadResponse> = {
  ok: true,
  request_id,
  presets: [
    {
      name: "file",
      description: "reading, writing and searching, as one interest",
      opts: { types: ["tool:Read", "tool:Write", "tool:Edit", "tool:Glob", "tool:Grep"] },
    },
    {
      name: "howto",
      description: "how the work was done: what was thought, run, read and written",
      opts: { types: ["thinking", "message:user", "message:sub", "tool:Bash", "@file"] },
    },
  ],
};

/** One item of several types, as a reader emits them.
 *
 * A call and its result appear as the two items they are, linked both ways, so
 * an implementation can check that it draws the pair without assuming they are
 * adjacent. The thinking and the call after it were read out of one record and
 * carry the one address it sits at, which is the case an id exists for. */
export const TRANSCRIPT_ITEMS: Static<typeof TranscriptItem>[] = [
  {
    id: "3f9a21c4:0",
    uuid: "3f9a21c4",
    source: { offset: 180_000, bytes: 420 },
    type: "message:user:in",
    at: FIXTURE_NOW - 3_600_000,
    turn: 1,
    text: "dump のアイテム型を整理して",
  },
  {
    id: "f10b6d43:0",
    uuid: "f10b6d43",
    source: { offset: 180_420, bytes: 980 },
    type: "thinking",
    at: FIXTURE_NOW - 3_500_000,
    text: "台帳として分ける",
  },
  {
    id: "f10b6d43:1",
    uuid: "f10b6d43",
    source: { offset: 180_420, bytes: 980 },
    type: "tool:Bash",
    at: FIXTURE_NOW - 3_400_000,
    role: "use",
    tool_use_id: "toolu_01Ne9BDS",
    result_item: "18d6f2c9:0",
    command: "jq -r '.type' session.jsonl | sort | uniq -c",
    description: "count the record types",
  },
  {
    id: "18d6f2c9:0",
    uuid: "18d6f2c9",
    source: { offset: 181_400, bytes: 260 },
    type: "tool:Bash",
    at: FIXTURE_NOW - 3_399_000,
    role: "result",
    parent_item: "f10b6d43:1",
    parent_tool_use_id: "toolu_01Ne9BDS",
    stdout: "1174 assistant\n753 user\n",
    interrupted: false,
  },
  {
    id: "b7e41d09:0",
    uuid: "b7e41d09",
    source: { offset: 181_660, bytes: 640 },
    type: "message:sub:out",
    at: FIXTURE_NOW - 3_300_000,
    role: "use",
    result_item: "c2d80f16:0",
    tool_use_id: "toolu_01Rk4WQm",
    prompt: "docs/design/dump-kinds.md を書き直す",
    agent_id: "a471372f2",
    subagent_type: "opus5-worker-high",
  },
  {
    id: "92e6d4f5:0",
    uuid: "92e6d4f5",
    source: { offset: 182_300, bytes: 310 },
    type: "hook:PreToolUse",
    at: FIXTURE_NOW - 3_200_000,
    hook_name: "PreToolUse:Bash",
    outcome: "additionalContext",
    content: "read コマンドを使うこと",
    tool_use_id: "toolu_01Ne9BDS",
  },
  {
    id: "81d5c3e4:0",
    uuid: "81d5c3e4",
    source: { offset: 182_610, bytes: 190 },
    type: "system:attachment:queued_command",
    at: FIXTURE_NOW - 3_100_000,
    attachment: { type: "queued_command", command: "/pre-clear" },
  },
];

export const TRANSCRIPT_READ_REQUEST: Static<typeof TranscriptReadRequest> = {
  request_id,
  op: "transcript_read",
  sid,
  before: 182_400,
  max_bytes: 65_536,
};

export const TRANSCRIPT_READ_RESPONSE: Static<typeof TranscriptReadResponse> = {
  ok: true,
  request_id,
  sid,
  lines: ['{"type":"assistant","text":"fixture を export した"}'],
  start: 182_300,
  end: 182_400,
  size: 182_400,
};

export const TRANSCRIPT_ITEMS_READ_REQUEST: Static<typeof TranscriptItemsReadRequest> = {
  request_id,
  op: "transcript_items_read",
  sid,
  since_at: FIXTURE_NOW - 3_600_000,
  types: ["message", "thinking", "tool:Bash"],
  limit: 200,
};

/** The answer stops where the limit did and names what comes next, so the
 * caller asks for the rest with `since_id` and reads nothing twice. */
export const TRANSCRIPT_ITEMS_READ_RESPONSE: Static<typeof TranscriptItemsReadResponse> = {
  ok: true,
  request_id,
  items: TRANSCRIPT_ITEMS,
  next: "c2d80f16:0",
  ids: [{ kind: "agent", id: "a471372f2", label: "dump-kinds-design", status: "running" }],
};

/** A client drawing the newest items first asks with an upper bound alone, and
 * walks back by handing the `prev` it was given to the next call. */
export const TRANSCRIPT_ITEMS_READ_BACKWARD_REQUEST: Static<typeof TranscriptItemsReadRequest> = {
  request_id,
  op: "transcript_items_read",
  sid,
  until_id: "18d6f2c9:0",
  limit: 2,
};

export const TRANSCRIPT_ITEMS_READ_BACKWARD_RESPONSE: Static<typeof TranscriptItemsReadResponse> = {
  ok: true,
  request_id,
  items: TRANSCRIPT_ITEMS.slice(1, 3),
  prev: "f10b6d43:0",
};

export const SESSION_FORK_ORIGIN_REQUEST: Static<typeof SessionForkOriginRequest> = {
  request_id,
  op: "session_fork_origin",
  sid,
};

export const SESSION_FORK_ORIGIN_RESPONSE: Static<typeof SessionForkOriginResponse> = {
  ok: true,
  request_id,
  origin: { sid: other_sid, boundary_uuid: "6d1f0c2e-8a44-4b1e-9f30-5c7a2d9e4b81", copied: 128 },
};

export const SESSION_LAST_LIVE_REMOVE_REQUEST: Static<typeof SessionLastLiveRemoveRequest> = {
  request_id,
  op: "session_last_live_remove",
  sid: other_sid,
};

export const SESSION_LAST_LIVE_REMOVE_RESPONSE: Static<typeof SessionLastLiveRemoveResponse> = {
  ok: true,
  request_id,
  removed: true,
};

export const DIR_LIST_REQUEST: Static<typeof DirListRequest> = {
  request_id,
  op: "dir_list",
  sid,
  kind: "workspace",
  path: "src/fixtures",
};

export const DIR_LIST_RESPONSE: Static<typeof DirListResponse> = {
  ok: true,
  request_id,
  sid,
  path: "src/fixtures",
  entries: [
    { name: "index.ts", type: "file", size: 2_048, mtime_at: FIXTURE_NOW },
    { name: "topics.ts", type: "file", size: 4_096, mtime_at: FIXTURE_NOW },
  ],
};

export const FILE_READ_REQUEST: Static<typeof FileReadRequest> = {
  request_id,
  op: "file_read",
  sid,
  kind: "workspace",
  path: FILE_PATH,
};

export const FILE_READ_RESPONSE: Static<typeof FileReadResponse> = {
  ok: true,
  request_id,
  sid,
  path: FILE_PATH,
  size: 2_048,
  truncated: false,
  binary: false,
  content: "export const OP_FIXTURES = {} as const;\n",
  mtime_at: FIXTURE_NOW,
};

export const FILE_WRITE_REQUEST: Static<typeof FileWriteRequest> = {
  request_id,
  op: "file_write",
  sid,
  path: FILE_PATH,
  content: "export const OP_FIXTURES = {} as const;\n",
};

export const FILE_WRITE_RESPONSE: Static<typeof FileWriteResponse> = {
  ok: true,
  request_id,
  sid,
  path: FILE_PATH,
};

export const FILE_CREATE_REQUEST: Static<typeof FileCreateRequest> = {
  request_id,
  op: "file_create",
  sid,
  kind: "workspace",
  path: "src/fixtures/ids.ts",
  content: "export const FIXTURE_IDS = {} as const;\n",
};

export const FILE_CREATE_RESPONSE: Static<typeof FileCreateResponse> = {
  ok: true,
  request_id,
  sid,
  path: "src/fixtures/ids.ts",
};

export const FILE_EDIT_REQUEST: Static<typeof FileEditRequest> = {
  request_id,
  op: "file_edit",
  sid,
  kind: "workspace",
  path: FILE_PATH,
  content: "export const OP_FIXTURES = {} as const;\n",
  expected_mtime_at: FIXTURE_NOW,
  expected_size: 2_048,
};

export const FILE_EDIT_RESPONSE: Static<typeof FileEditResponse> = {
  ok: true,
  request_id,
  sid,
  path: FILE_PATH,
  size: 2_112,
  mtime_at: FIXTURE_NOW + 1_000,
};

export const FILE_DELETE_REQUEST: Static<typeof FileDeleteRequest> = {
  request_id,
  op: "file_delete",
  sid,
  kind: "workspace",
  path: "src/fixtures/scratch.ts",
};

export const FILE_DELETE_RESPONSE: Static<typeof FileDeleteResponse> = {
  ok: true,
  request_id,
  sid,
  path: "src/fixtures/scratch.ts",
};

export const FILE_FIND_REQUEST: Static<typeof FileFindRequest> = {
  request_id,
  op: "file_find",
  sid,
  kind: "workspace",
  root: "src",
  query: "fixtures",
  respect_gitignore: true,
};

export const FILE_FIND_RESPONSE: Static<typeof FileFindResponse> = {
  ok: true,
  request_id,
  sid,
  hits: [
    { path: "src/fixtures", type: "dir" },
    { path: FILE_PATH, type: "file" },
  ],
  truncated: false,
};

export const FILE_STAT_BATCH_REQUEST: Static<typeof FileStatBatchRequest> = {
  request_id,
  op: "file_stat_batch",
  sid,
  paths: [FILE_PATH, "/etc/hosts"],
};

/** A path the session may not reach answers `null` in its place rather than
 * dropping out of the list, so the results line up with the paths asked for. */
export const FILE_STAT_BATCH_RESPONSE: Static<typeof FileStatBatchResponse> = {
  ok: true,
  request_id,
  results: [{ kind: "workspace", path: FILE_PATH }, null],
};

export const DIR_TREE_REQUEST: Static<typeof DirTreeRequest> = {
  request_id,
  op: "dir_tree",
  roots: ["/repos/kawaz"],
  depth: 2,
  filter: "ccmsg",
};

export const DIR_TREE_RESPONSE: Static<typeof DirTreeResponse> = {
  ok: true,
  request_id,
  entries: [
    {
      path: "/repos/kawaz/ccmsg-protocol",
      children: [{ path: WORKSPACE }],
    },
  ],
};

export const LAUNCHER_CONFIG_READ_REQUEST: Static<typeof LauncherConfigReadRequest> = {
  request_id,
  op: "launcher_config_read",
};

export const LAUNCHER_CONFIG_READ_RESPONSE: Static<typeof LauncherConfigReadResponse> = {
  ok: true,
  request_id,
  root_dirs: ["/repos/kawaz"],
  templates: [
    {
      name: "claude",
      command: "claude --effort {effort}",
      params: [{ name: "effort", default: "high" }],
    },
  ],
};

export const LAUNCHER_RUN_REQUEST: Static<typeof LauncherRunRequest> = {
  request_id,
  op: "launcher_run",
  cwd: WORKSPACE,
  params: { effort: "high" },
  template: "claude",
};

export const LAUNCHER_RUN_RESPONSE: Static<typeof LauncherRunResponse> = {
  ok: true,
  request_id,
  stdout: "started\n",
  stderr: "",
  exit_code: 0,
  timed_out: false,
};

export const SANDBOX_GRANT_REQUEST: Static<typeof SandboxGrantRequest> = {
  request_id,
  op: "sandbox_grant",
  sid,
  kind: "workspace",
  path: FILE_PATH,
};

export const SANDBOX_GRANT_RESPONSE: Static<typeof SandboxGrantResponse> = {
  ok: true,
  request_id,
  gid: "g-01J9Z3W2Q",
  token: "c2FuZGJveC10b2tlbg",
  url: "https://mba.example.ts.net/ccmsg/personal/sandbox/g-01J9Z3W2Q/",
  expires_at: FIXTURE_NOW + 600_000,
};

export const SANDBOX_REVOKE_REQUEST: Static<typeof SandboxRevokeRequest> = {
  request_id,
  op: "sandbox_revoke",
  gid: "g-01J9Z3W2Q",
};

export const SANDBOX_REVOKE_RESPONSE: Static<typeof SandboxRevokeResponse> = {
  ok: true,
  request_id,
};

export const TRANSLATE_RUN_REQUEST: Static<typeof TranslateRunRequest> = {
  request_id,
  op: "translate_run",
  texts: ["the contract's own fixtures", "one that the helper could not take"],
};

/** One text per result, each of them either the translation or why there is
 * none. */
export const TRANSLATE_RUN_RESPONSE: Static<typeof TranslateRunResponse> = {
  ok: true,
  request_id,
  results: [
    { ok: true, text: "契約自身の fixture" },
    { ok: false, error: "helper exited 1" },
  ],
};

export const LLM_USAGE_READ_REQUEST: Static<typeof LlmUsageReadRequest> = {
  request_id,
  op: "llm_usage_read",
  refresh: true,
};

export const LLM_USAGE_READ_RESPONSE: Static<typeof LlmUsageReadResponse> = {
  ok: true,
  request_id,
  generated_at: FIXTURE_NOW,
  credentials: [
    {
      name: "personal",
      type: "oauth",
      support: "full",
      auth: { status: "ok", observed_at: FIXTURE_NOW },
      snapshot: {
        observed_at: FIXTURE_NOW,
        overage: { status: "off" },
        windows: {
          five_hour: {
            utilization: 0.42,
            status: "allowed",
            reset_at: FIXTURE_NOW + 7_200_000,
            window_secs: 18_000,
          },
        },
      },
      limits: [
        {
          kind: "five_hour",
          percent: 42,
          severity: "ok",
          resets_at: FIXTURE_NOW + 7_200_000,
          is_active: true,
          window_secs: 18_000,
        },
      ],
    },
  ],
};

export const LLM_STATS_READ_REQUEST: Static<typeof LlmStatsReadRequest> = {
  request_id,
  op: "llm_stats_read",
  days: 7,
};

export const LLM_STATS_READ_RESPONSE: Static<typeof LlmStatsReadResponse> = {
  ok: true,
  request_id,
  generated_at: FIXTURE_NOW,
  days: {
    "2026-09-08": {
      credentials: {
        personal: {
          "claude-opus-5": {
            requests: 12,
            input_tokens: 48_000,
            output_tokens: 6_400,
            cache_creation_input_tokens: 12_000,
            cache_read_input_tokens: 320_000,
            usd: 1.23,
          },
        },
      },
      total_usd: 1.23,
    },
  },
};

export const KV_READ_REQUEST: Static<typeof KvReadRequest> = {
  request_id,
  op: "kv_read",
  ns: "webui",
  key: "layout",
};

export const KV_READ_RESPONSE: Static<typeof KvReadResponse> = {
  ok: true,
  request_id,
  value: { pane: "peers", collapsed: false },
  updated_at: FIXTURE_NOW,
};

export const KV_WRITE_REQUEST: Static<typeof KvWriteRequest> = {
  request_id,
  op: "kv_write",
  ns: "webui",
  key: "layout",
  value: { pane: "peers", collapsed: true },
  updated_at: FIXTURE_NOW,
};

export const KV_WRITE_RESPONSE: Static<typeof KvWriteResponse> = {
  ok: true,
  request_id,
  updated_at: FIXTURE_NOW,
};

export const KV_DELETE_REQUEST: Static<typeof KvDeleteRequest> = {
  request_id,
  op: "kv_delete",
  ns: "webui",
  key: "layout",
};

export const KV_DELETE_RESPONSE: Static<typeof KvDeleteResponse> = {
  ok: true,
  request_id,
};
