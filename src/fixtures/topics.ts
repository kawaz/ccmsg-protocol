import type { Static } from "@sinclair/typebox";
import type { AuthRecordsFrame } from "../common/auth.ts";
import type { AgentsFrame } from "../control/agents.ts";
import type { InstancesFrame } from "../control/instances.ts";
import type { KvFrame } from "../control/kv.ts";
import type { LlmRequestsFrame, LlmStatusFrame } from "../control/llm.ts";
import type { PeersFrame } from "../control/peers.ts";
import type { SessionErrorsFrame } from "../control/session-errors.ts";
import type { SessionStatusFrame } from "../control/session-status.ts";
import type { TerminalsFrame } from "../control/terminals.ts";
import type { TranscriptFrame, TranscriptItemsFrame } from "../control/transcript.ts";
import { TRANSCRIPT_ITEMS } from "./control.ts";
import type { InboxFrame } from "../messaging/message.ts";
import type { NotifyFrame } from "../messaging/notify.ts";
import { FIXTURE_IDS, FIXTURE_NOW } from "./ids.ts";

const {
  sid,
  other_sid,
  instance,
  other_instance,
  endpoint,
  other_endpoint,
  origin,
  same_site_origin,
  user: USER,
  other_user: OTHER_USER,
  mid,
} = FIXTURE_IDS;

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
      to: sid,
    },
    {
      mid: `${instance}/1842`,
      from: "user",
      from_label: "kawaz",
      text: "確認する",
      reply_to: mid,
      sent_at: FIXTURE_NOW + 1_000,
      to: sid,
    },
  ],
};

/** A later frame, where one message has been handed over and another was never
 * taken. */
export const INBOX_REMOVED_FRAME: Static<typeof InboxFrame> = {
  ev: "topic",
  topic: "inbox",
  instance,
  data: [
    { mid, removed: true, reason: "delivered" },
    { mid: `${instance}/1842`, removed: true, reason: "expired" },
  ],
};

export const NOTIFY_FRAME: Static<typeof NotifyFrame> = {
  ev: "topic",
  topic: "notify",
  instance,
  data: {
    sid,
    sid_label: "contract-fixtures",
    text: "確認して",
    reply_to: mid,
    sent_at: FIXTURE_NOW,
  },
};

const PEER = {
  sid,
  instance,
  repo: "ccmsg-protocol",
  ws: "main",
  cwd: WORKSPACE,
  protocol_version: 4,
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
        runs: [
          {
            pid: 4821,
            started_at: FIXTURE_NOW - 600_000,
            terminal_id: "hyoui:%17",
            connected: true,
          },
        ],
        session_status: "ready",
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
        runs: [{ pid: 7314, started_at: FIXTURE_NOW - 120_000, connected: false }],
        session_status: "folding",
        stale_client: {
          last_seen_at: FIXTURE_NOW - 300_000,
          version: "0.0.9",
          protocol_version: 2,
        },
      },
      {
        sid: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        instance,
        repo: "ccmsg",
        ws: "daemon-v2",
        cwd: "/repos/kawaz/ccmsg/daemon-v2",
        runs: [],
        session_status: "ready",
        last_seen_at: FIXTURE_NOW - 1_200_000,
        stopped_at: FIXTURE_NOW - 1_000_000,
        model: "claude-opus-5",
        effort: "high",
      },
    ],
  },
};

/** A later frame: one row is being run by two processes at once, and one the
 * instance forgot. */
export const PEERS_CHANGE_FRAME: Static<typeof PeersFrame> = {
  ev: "topic",
  topic: "peers",
  instance,
  data: {
    peers: [
      {
        ...PEER,
        runs: [
          {
            pid: 4821,
            started_at: FIXTURE_NOW - 600_000,
            terminal_id: "hyoui:%17",
            connected: true,
          },
          {
            pid: 9022,
            started_at: FIXTURE_NOW - 30_000,
            terminal_id: "hyoui:%23",
            connected: true,
          },
        ],
        session_status: "frozen",
        gateway_active_at: FIXTURE_NOW + 1_000,
      },
      { sid: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", instance, removed: true },
    ],
  },
};

export const INSTANCES_FRAME: Static<typeof InstancesFrame> = {
  ev: "topic",
  topic: "instances",
  snapshot: true,
  instance,
  data: {
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
        terminal_id: "hyoui:%17",
        terminal_namespace: "personal",
      },
      {
        instance,
        pid: 9022,
        cwd: WORKSPACE,
        kind: "claude",
        started_at: FIXTURE_NOW - 30_000,
        config_dir: "/config/claude-personal",
        terminal_id: "hyoui:%23",
      },
    ],
    polled_at: FIXTURE_NOW,
  },
};

/** A later frame: the harness no longer reports one of the rows above. */
export const AGENTS_CHANGE_FRAME: Static<typeof AgentsFrame> = {
  ev: "topic",
  topic: "agents",
  instance,
  data: { agents: [{ instance, pid: 7314, removed: true }], polled_at: FIXTURE_NOW + 5_000 },
};

export const TERMINALS_FRAME: Static<typeof TerminalsFrame> = {
  ev: "topic",
  topic: "terminals",
  snapshot: true,
  instance,
  data: {
    terminals: [
      {
        instance,
        id: "hyoui:%17",
        state: "running",
        command: ["claude", "--continue"],
        cwd: WORKSPACE,
        pid: 4821,
        started_at: FIXTURE_NOW - 600_000,
      },
      {
        instance,
        id: "hyoui:%31",
        state: "running",
        command: ["zsh", "-i"],
        cwd: WORKSPACE,
        pid: 5177,
        started_at: FIXTURE_NOW - 120_000,
      },
    ],
    polled_at: FIXTURE_NOW,
  },
};

/** A later frame: one terminal was closed. */
export const TERMINALS_CHANGE_FRAME: Static<typeof TerminalsFrame> = {
  ev: "topic",
  topic: "terminals",
  instance,
  data: {
    terminals: [{ instance, id: "hyoui:%31", removed: true }],
    polled_at: FIXTURE_NOW + 5_000,
  },
};

export const SESSION_STATUS_FRAME: Static<typeof SessionStatusFrame> = {
  ev: "topic",
  topic: `session.status:${sid}`,
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

/** The typed topic, whose frames carry items rather than bytes. */
export const TRANSCRIPT_ITEMS_FRAME = {
  ev: "topic",
  topic: `transcript.items:${sid}`,
  instance,
  data: { sid, items: TRANSCRIPT_ITEMS.slice(-2) },
} satisfies Static<typeof TranscriptItemsFrame>;

/** Its opening frame, which is the tail the instance kept — the same shape as
 * every frame after it, so a subscriber appends both the same way. */
export const TRANSCRIPT_ITEMS_SNAPSHOT_FRAME = {
  ev: "topic",
  topic: `transcript.items:${sid}`,
  snapshot: true,
  instance,
  data: { sid, items: TRANSCRIPT_ITEMS },
} satisfies Static<typeof TranscriptItemsFrame>;

export const SESSION_ERRORS_FRAME: Static<typeof SessionErrorsFrame> = {
  ev: "topic",
  topic: "session.errors",
  snapshot: true,
  instance,
  data: {
    errors: [{ sid, instance, text: "overloaded_error", occurred_at: FIXTURE_NOW - 30_000 }],
  },
};

export const LLM_REQUESTS_FRAME: Static<typeof LlmRequestsFrame> = {
  ev: "topic",
  topic: "llm.requests",
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
  topic: "llm.status",
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

/** The grantings the fixtures name. A granting's id is random and never reused,
 * which is what lets the same instance be given up and taken again. */
const GRANT = "Z3JhbnQtb25l";
const OTHER_GRANT = "Z3JhbnQtdHdv";
const THIRD_GRANT = "Z3JhbnQtdGhyZWU";
const FOURTH_GRANT = "Z3JhbnQtZm91cg";

/** The person, the passkeys that answer for them, and the instances they own —
 * the records an instance needs to admit somebody, all replicated. */
export const AUTH_RECORDS_FRAME = {
  ev: "topic",
  topic: "auth.records",
  snapshot: true,
  instance,
  data: {
    records: [
      {
        key: `user/${USER}`,
        updated_at: FIXTURE_NOW - 900_000,
        body: {
          kind: "user",
          user: USER,
          display_name: "kawaz",
          created_at: FIXTURE_NOW - 900_000,
        },
      },
      {
        key: "credential/Y3JlZC1pZA",
        updated_at: FIXTURE_NOW,
        body: {
          kind: "credential",
          user: USER,
          credential_id: "Y3JlZC1pZA",
          public_key: "pQECAyYgASFYIA",
          origin,
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
      {
        // The same person at a second origin, which shares the endpoints'
        // registrable domain where the first does not. One credential per
        // origin, and the difference between the two is what decides whether
        // the refresh cookie for a session made here is a partitioned one.
        key: "credential/Y3JlZC1pZC0y",
        updated_at: FIXTURE_NOW,
        body: {
          kind: "credential",
          user: USER,
          credential_id: "Y3JlZC1pZC0y",
          public_key: "pQECAyYgASFYIB",
          origin: same_site_origin,
          device_label: "phone",
          registered_at: FIXTURE_NOW - 300_000,
        },
      },
      {
        // The instance this person made themselves, from its command line:
        // there was no user yet to do it, which is why a granting's author can
        // be an instance at all.
        key: `ownership/${instance}/${USER}/${GRANT}`,
        updated_at: FIXTURE_NOW - 600_000,
        body: {
          kind: "ownership",
          user: USER,
          instance,
          grant: GRANT,
          granted_at: FIXTURE_NOW - 600_000,
          granted_by: { kind: "instance", instance },
        },
      },
      {
        // A second instance, taken as their own afterwards. Neither credential
        // is named here: which instances a person may enter is this record's
        // answer, and which page may speak is the credential's.
        //
        // The frame is this instance's, and what it carries is an ownership of
        // its peer: a granting is written wherever the operator is standing and
        // replicated from there, peers trusting one another equally. Nothing
        // requires the instance that wrote a granting to be the one granted.
        key: `ownership/${other_instance}/${USER}/${OTHER_GRANT}`,
        updated_at: FIXTURE_NOW - 60_000,
        body: {
          kind: "ownership",
          user: USER,
          instance: other_instance,
          grant: OTHER_GRANT,
          granted_at: FIXTURE_NOW - 60_000,
          granted_by: { kind: "user", user: USER },
        },
      },
      {
        // A second person owning that same instance. One instance may have
        // several owners, and they are told apart by the key alone.
        key: `ownership/${other_instance}/${OTHER_USER}/${THIRD_GRANT}`,
        updated_at: FIXTURE_NOW - 30_000,
        body: {
          kind: "ownership",
          user: OTHER_USER,
          instance: other_instance,
          grant: THIRD_GRANT,
          granted_at: FIXTURE_NOW - 30_000,
          granted_by: { kind: "user", user: USER },
        },
      },
    ],
  },
} satisfies Static<typeof AuthRecordsFrame>;

/** The token half of the same topic: one family, minted by one instance and
 * writable at every instance its owner owns. */
export const AUTH_RECORDS_FAMILY_FRAME = {
  ev: "topic",
  topic: "auth.records",
  instance,
  data: {
    records: [
      {
        key: "family/01J9Z3W2Q",
        updated_at: FIXTURE_NOW + 100_000,
        body: {
          kind: "token_family",
          user: USER,
          iss: instance,
          origin,
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

/** A removal travels as a record of its own, and says nothing but when: what
 * was removed is the key it arrives under. A credential's and an ownership's
 * never expire; a family's is kept only as long as a refresh token could still
 * arrive. */
export const AUTH_RECORDS_TOMBSTONE_FRAME = {
  ev: "topic",
  topic: "auth.records",
  instance,
  data: {
    records: [
      {
        key: "credential/Y3JlZC1pZA",
        updated_at: FIXTURE_NOW + 100_000,
        body: { kind: "tombstone", deleted_at: FIXTURE_NOW + 100_000 },
      },
      {
        // The second person gives that instance up.
        key: `ownership/${other_instance}/${OTHER_USER}/${THIRD_GRANT}`,
        updated_at: FIXTURE_NOW + 100_000,
        body: { kind: "tombstone", deleted_at: FIXTURE_NOW + 100_000 },
      },
      {
        // And is made an owner of it again. A granting has an id of its own, so
        // this is a key no tombstone stands on — where a key made of the
        // instance and the person alone would have made the removal above
        // final, with nothing able to undo it.
        key: `ownership/${other_instance}/${OTHER_USER}/${FOURTH_GRANT}`,
        updated_at: FIXTURE_NOW + 200_000,
        body: {
          kind: "ownership",
          user: OTHER_USER,
          instance: other_instance,
          grant: FOURTH_GRANT,
          granted_at: FIXTURE_NOW + 200_000,
          granted_by: { kind: "user", user: USER },
        },
      },
      {
        key: "family/01J9Z3W2Q",
        updated_at: FIXTURE_NOW + 100_000,
        body: {
          kind: "tombstone",
          deleted_at: FIXTURE_NOW + 100_000,
          expires_at: FIXTURE_NOW + 604_900_000,
        },
      },
    ],
  },
} satisfies Static<typeof AuthRecordsFrame>;
