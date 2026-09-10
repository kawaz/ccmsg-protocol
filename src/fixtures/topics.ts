import type { Static } from "@sinclair/typebox";
import type { AuthRecordsFrame } from "../common/auth.ts";
import type { AgentsFrame } from "../control/agents.ts";
import type { KvFrame } from "../control/kv.ts";
import type { LlmRequestsFrame, LlmStatusFrame } from "../control/llm.ts";
import type { PeersFrame } from "../control/peers.ts";
import type { SessionErrorsFrame } from "../control/session-errors.ts";
import type { SessionStatusFrame } from "../control/session-status.ts";
import type { TranscriptFrame } from "../control/transcript.ts";
import type { InboxFrame } from "../messaging/message.ts";
import type { NotifyFrame } from "../messaging/notify.ts";
import { FIXTURE_IDS, FIXTURE_NOW } from "./ids.ts";

const { sid, other_sid, instance, other_instance, endpoint, other_endpoint, mid } = FIXTURE_IDS;

const WORKSPACE = "/repos/kawaz/ccmsg-protocol/main";

export const INBOX_FRAME: Static<typeof InboxFrame> = {
  ev: "topic",
  topic: "inbox",
  snapshot: true,
  instance,
  data: [
    {
      mid,
      from: other_sid,
      from_label: "contract-fixtures",
      text: "fixture を export した",
      sent_at: FIXTURE_NOW,
    },
    {
      mid: `${instance}/1842`,
      from: "user",
      from_label: "kawaz",
      text: "確認する",
      reply_to: mid,
      sent_at: FIXTURE_NOW + 1_000,
    },
  ],
};

export const NOTIFY_FRAME: Static<typeof NotifyFrame> = {
  ev: "topic",
  topic: "notify",
  instance,
  data: { sid, sid_label: "contract-fixtures", text: "確認して", sent_at: FIXTURE_NOW },
};

const PEER = {
  sid,
  instance,
  repo: "ccmsg-protocol",
  ws: "main",
  cwd: WORKSPACE,
  protocol_version: 3,
};

export const PEERS_FRAME: Static<typeof PeersFrame> = {
  ev: "topic",
  topic: "peers",
  snapshot: true,
  instance,
  data: {
    peers: [
      {
        ...PEER,
        transcript_path: "/transcripts/6f1a2b3c.jsonl",
        repo_root: "/repos/kawaz/ccmsg-protocol",
        branch: "main",
        title: "contract fixtures",
        state: "live",
        pinned: true,
        connected_at: FIXTURE_NOW - 600_000,
        last_activity_at: FIXTURE_NOW,
        last_user_input_at: FIXTURE_NOW - 60_000,
        gateway_active_at: FIXTURE_NOW,
        send_message: true,
        client_version: "0.1.0",
      },
      {
        ...PEER,
        sid: other_sid,
        state: "live_unmanaged",
        stale_client: {
          last_seen_at: FIXTURE_NOW - 300_000,
          version: "0.0.9",
          protocol_version: 2,
        },
      },
    ],
    last_live: [
      {
        sid: other_sid,
        instance,
        repo: "ccmsg",
        ws: "daemon-v2",
        cwd: "/repos/kawaz/ccmsg/daemon-v2",
        state: "paused",
        last_seen_at: FIXTURE_NOW - 1_200_000,
        stopped_at: FIXTURE_NOW - 1_000_000,
        model: "claude-opus-5",
        effort: "high",
      },
    ],
    instances: [
      { id: instance, endpoint, host: "mba", reachable: true },
      { id: other_instance, endpoint: other_endpoint, host: "nuc", reachable: false },
    ],
  },
};

export const AGENTS_FRAME: Static<typeof AgentsFrame> = {
  ev: "topic",
  topic: "agents",
  snapshot: true,
  instance,
  data: {
    agents: [
      {
        sid,
        instance,
        pid: 4821,
        cwd: WORKSPACE,
        kind: "claude",
        started_at: FIXTURE_NOW - 600_000,
        name: "contract-fixtures",
        status: "working",
        state: "busy",
        config_dir: "/config/claude-personal",
        terminal_id: "%17",
        terminal_namespace: "personal",
      },
    ],
    polled_at: FIXTURE_NOW,
  },
};

export const SESSION_STATUS_FRAME: Static<typeof SessionStatusFrame> = {
  ev: "topic",
  topic: `session_status:${sid}`,
  snapshot: true,
  instance,
  data: {
    sid,
    todos: [
      {
        id: "1",
        subject: "fixture を export する",
        status: "in_progress",
        owner: "contract-fixtures",
        blocked_by: [],
        blocks: ["2"],
      },
    ],
    workflows: [
      {
        task_id: "w1",
        name: "contract fixtures",
        summary: "export the wire fixtures",
        status: "running",
        started_at: FIXTURE_NOW - 600_000,
        run_id: "r1",
        phases: [{ title: "write", done: 1, total: 2 }],
        agents: [
          {
            agent_id: "a1",
            label: "writer",
            model: "claude-opus-5",
            agent_type: "worker",
            state: "running",
            tokens: 48_000,
            tool_calls: 12,
            phase_index: 0,
            phase_title: "write",
            last_tool: "Write",
            started_at: FIXTURE_NOW - 300_000,
            duration_ms: 300_000,
          },
        ],
      },
    ],
    background: [
      {
        task_id: "b1",
        kind: "bash",
        description: "just ci",
        status: "running",
        started_at: FIXTURE_NOW - 60_000,
      },
    ],
    teammates: [
      {
        name: "contract-fixtures",
        spawned: true,
        agent_type: "worker",
        color: "cyan",
        spawned_at: FIXTURE_NOW - 600_000,
        last_sent_at: FIXTURE_NOW - 60_000,
        last_received_at: FIXTURE_NOW,
        state: "busy",
        model: "claude-opus-5",
      },
    ],
    agent_tree: {
      teammates: [
        {
          agent_id: "a1",
          teammate_name: "contract-fixtures",
          agent_type: "worker",
          description: "export the wire fixtures",
          color: "cyan",
          model: "claude-opus-5",
          spawn_depth: 0,
          kind: "teammate",
          state: "busy",
          last_activity_at: FIXTURE_NOW,
          children: [],
        },
      ],
      agents: [],
      workflows: [
        {
          workflow_id: "w1",
          done: 1,
          total: 2,
          phases: [{ index: 1, title: "write", done: 1, total: 2, members: [] }],
          unassigned: [],
          last_activity_at: FIXTURE_NOW,
        },
      ],
    },
    external_files: [{ path: "/transcripts/6f1a2b3c.jsonl", origin: "tool" }],
    workspace_folders: [{ name: "main", path: WORKSPACE }],
    context: {
      tokens: 148_000,
      model: "claude-opus-5",
      effort: "high",
      observed_at: FIXTURE_NOW,
    },
    api_error: { text: "overloaded_error", occurred_at: FIXTURE_NOW - 30_000 },
  },
};

export const TRANSCRIPT_FRAME = {
  ev: "topic",
  topic: `transcript:${sid}`,
  instance,
  data: {
    sid,
    lines: ['{"type":"assistant","text":"fixture を export した"}'],
    start: 182_300,
    end: 182_400,
    size: 182_400,
  },
} satisfies Static<typeof TranscriptFrame>;

/** The opening frame of the topic, which states how far the transcript has
 * been written without carrying any of it. */
export const TRANSCRIPT_SIZE_FRAME = {
  ev: "topic",
  topic: `transcript:${sid}`,
  snapshot: true,
  instance,
  data: { sid, size: 182_400 },
} satisfies Static<typeof TranscriptFrame>;

export const SESSION_ERRORS_FRAME: Static<typeof SessionErrorsFrame> = {
  ev: "topic",
  topic: "session_errors",
  snapshot: true,
  instance,
  data: {
    errors: [{ sid, instance, text: "overloaded_error", occurred_at: FIXTURE_NOW - 30_000 }],
  },
};

export const LLM_REQUESTS_FRAME: Static<typeof LlmRequestsFrame> = {
  ev: "topic",
  topic: "llm_requests",
  snapshot: true,
  instance,
  data: [
    {
      received_at: FIXTURE_NOW,
      sid,
      instance,
      prefix: "contract",
      main: true,
      cache_expires_at: FIXTURE_NOW + 300_000,
      cache_ttl_secs: 300,
      cache_since_at: FIXTURE_NOW - 600_000,
      cache_count: 8,
      next_keepalive_at: FIXTURE_NOW + 240_000,
      ns: "personal",
      model: "claude-opus-5",
      credential: "personal",
      status: 200,
    },
  ],
};

export const LLM_STATUS_FRAME: Static<typeof LlmStatusFrame> = {
  ev: "topic",
  topic: "llm_status",
  snapshot: true,
  instance,
  data: {
    schema_version: 1,
    generated_at: FIXTURE_NOW,
    overall: { severity: "ok", service_counts: { ok: 1, warning: 0, critical: 0, unknown: 0 } },
    services: [
      {
        id: "anthropic",
        name: "Anthropic",
        severity: "ok",
        routes: ["/v1/messages"],
        official: {
          state: "operational",
          source: "status page",
          source_url: "https://status.example.com/",
          observed_at: FIXTURE_NOW,
          components: [{ id: "api", name: "API", state: "operational" }],
          incidents: [],
        },
        observed: {
          state: "reachable",
          observed_at: FIXTURE_NOW,
          expires_at: FIXTURE_NOW + 60_000,
          last_success_at: FIXTURE_NOW,
        },
      },
    ],
  },
};

export const KV_FRAME: Static<typeof KvFrame> = {
  ev: "topic",
  topic: "kv:webui",
  snapshot: true,
  instance,
  data: {
    entries: [
      { key: "layout", value: { pane: "peers", collapsed: false }, updated_at: FIXTURE_NOW },
      { key: "draft", updated_at: FIXTURE_NOW + 1_000, deleted: true },
    ],
  },
};

export const AUTH_RECORDS_FRAME = {
  ev: "topic",
  topic: "auth_records",
  snapshot: true,
  instance,
  data: {
    records: [
      {
        key: "credential/personal-1/Y3JlZC1pZA",
        updated_at: FIXTURE_NOW,
        body: {
          kind: "credential",
          sub: "personal-1",
          credential_id: "Y3JlZC1pZA",
          public_key: "pQECAyYgASFYIA",
          user_handle: "dXNlci1oYW5kbGU",
          endpoint,
          rp_id: "mba.example.ts.net",
          sign_count: 0,
          issued_label: "for kawaz",
          device_label: "work laptop",
          registered_at: FIXTURE_NOW - 600_000,
          registered_ip: "203.0.113.7",
          registered_user_agent: "Mozilla/5.0",
          last_used_at: FIXTURE_NOW,
          last_used_ip: "203.0.113.7",
          last_used_user_agent: "Mozilla/5.0",
        },
      },
    ],
  },
} satisfies Static<typeof AuthRecordsFrame>;

/** The token half of the same topic: one family, written by the instance that
 * issued it. */
export const AUTH_RECORDS_FAMILY_FRAME = {
  ev: "topic",
  topic: "auth_records",
  instance,
  data: {
    records: [
      {
        key: "family/01J9Z3W2Q",
        updated_at: FIXTURE_NOW + 100_000,
        body: {
          kind: "token_family",
          sub: "personal-1",
          iss: instance,
          access: { value: "YWNjZXNz", expires_at: FIXTURE_NOW + 10_000_000 },
          refresh: { value: "cmVmcmVzaA", expires_at: FIXTURE_NOW + 600_000_000 },
          last_refresh: {
            at: FIXTURE_NOW + 100_000,
            reason: "reconnect",
            ip: "203.0.113.7",
            user_agent: "Mozilla/5.0",
          },
          previous_refresh: { value: "b2xkLXJlZnJlc2g", expires_at: FIXTURE_NOW + 100_000_000 },
          retired: [{ hash: "9f".repeat(32), expires_at: FIXTURE_NOW + 80_000_000 }],
        },
      },
    ],
  },
} satisfies Static<typeof AuthRecordsFrame>;

/** A removal travels as a record of its own. A credential's never expires; a
 * family's is kept only as long as a refresh token could still arrive. */
export const AUTH_RECORDS_TOMBSTONE_FRAME = {
  ev: "topic",
  topic: "auth_records",
  instance,
  data: {
    records: [
      {
        key: "credential/personal-1/Y3JlZC1pZA",
        updated_at: FIXTURE_NOW + 100_000,
        body: { kind: "tombstone", sub: "personal-1", deleted_at: FIXTURE_NOW + 100_000 },
      },
      {
        key: "family/01J9Z3W2Q",
        updated_at: FIXTURE_NOW + 100_000,
        body: {
          kind: "tombstone",
          sub: "personal-1",
          deleted_at: FIXTURE_NOW + 100_000,
          expires_at: FIXTURE_NOW + 604_900_000,
        },
      },
    ],
  },
} satisfies Static<typeof AuthRecordsFrame>;
