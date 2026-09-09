import { describe, expect, test } from "bun:test";
import {
  isRoleAllowed,
  OP_ATTRIBUTES,
  OP_NAMES,
  opAttributes,
  opErrors,
  opsOfPlane,
  type OpName,
} from "../src/attributes.ts";
import { ERROR_CODES } from "../src/errors.ts";
import { OP_SCHEMAS, TOPIC_SCHEMAS } from "../src/schemas.ts";
import { TOPIC_ATTRIBUTES, TOPIC_GRANULARITIES, topicGranularity } from "../src/common/topics.ts";

describe("op attribute table", () => {
  test("no op is callable by nobody", () => {
    for (const op of OP_NAMES) expect(OP_ATTRIBUTES[op].roles.length).toBeGreaterThan(0);
  });

  test("every declared error is a known code", () => {
    for (const op of OP_NAMES) {
      for (const code of OP_ATTRIBUTES[op].errors) expect(ERROR_CODES).toContain(code);
    }
  });

  test("the rule-derived codes are derived, not declared per op", () => {
    const derived = ["invalid_args", "forbidden", "capability_unavailable", "instance_unreachable"];
    for (const op of OP_NAMES) {
      for (const code of OP_ATTRIBUTES[op].errors) expect(derived).not.toContain(code);
    }
  });

  test("attributes decide the derived codes", () => {
    expect(opErrors("hello")).toEqual(["invalid_args"]);
    expect(opErrors("session_rename")).toEqual([
      "invalid_args",
      "session_not_found",
      "hello_required",
      "forbidden",
      "capability_unavailable",
      "instance_unreachable",
    ]);
    expect(opErrors("message_send")).toEqual([
      "invalid_args",
      "session_not_found",
      "hello_required",
      "forbidden",
    ]);
  });

  test("what is callable before hello is the greeting and what settles an identity", () => {
    const open = OP_NAMES.filter((op) => !OP_ATTRIBUTES[op].needs_hello);
    expect(open.sort()).toEqual([
      "auth_assert",
      "auth_challenge",
      "auth_refresh_token",
      "auth_register",
      "hello",
      "instance_ping",
    ]);
  });

  test("an op carried over HTTP is one of those, and is in the table like any other", () => {
    // The carrier decides what an op can do — set a cookie, answer before a
    // connection exists — never who may call it: that stays this table's.
    const overHttp = OP_NAMES.filter((op) => opAttributes(op).carrier === "http");
    expect(overHttp.sort()).toEqual([
      "auth_assert",
      "auth_challenge",
      "auth_refresh_token",
      "auth_register",
    ]);
    for (const op of overHttp) expect(OP_ATTRIBUTES[op].needs_hello).toBe(false);
  });

  test("the planes hold the op counts the contract states", () => {
    expect(opsOfPlane("common")).toHaveLength(13);
    expect(opsOfPlane("messaging")).toHaveLength(4);
    expect(opsOfPlane("control")).toHaveLength(27);
    expect(opsOfPlane("mesh")).toHaveLength(0);
    expect(OP_NAMES).toHaveLength(44);
    expect(Object.keys(TOPIC_SCHEMAS)).toHaveLength(11);
  });

  test("the store's ops are the only control ops answerable anywhere", () => {
    const anywhere = opsOfPlane("control").filter((op) => OP_ATTRIBUTES[op].locality === "cluster");
    expect(anywhere.sort()).toEqual(["kv_delete", "kv_read", "kv_write"]);
  });

  test("role checks read the table", () => {
    expect(isRoleAllowed("say_post", "session")).toBe(true);
    expect(isRoleAllowed("say_post", "user")).toBe(false);
    expect(isRoleAllowed("say_mark_read", "session")).toBe(false);
    expect(isRoleAllowed("session_kill", "user")).toBe(true);
    expect(isRoleAllowed("session_stopping", "session")).toBe(true);
    expect(isRoleAllowed("session_stopping", "user")).toBe(false);
  });
});

describe("topic attribute table", () => {
  test("every topic states how its frames fold", () => {
    for (const [topic, attrs] of Object.entries(TOPIC_ATTRIBUTES)) {
      expect(TOPIC_GRANULARITIES).toContain(attrs.granularity);
      expect(topicGranularity(topic)).toBe(attrs.granularity);
    }
  });

  test("a parameterized name folds like the kind behind it", () => {
    expect(topicGranularity("session_status:6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607")).toBe("whole");
    expect(topicGranularity("transcript:6f1a2b3c-4d5e-4f60-8a91-b2c3d4e5f607")).toBe("append");
    expect(topicGranularity("kv:launcher")).toBe("element");
  });

  test("a name this generation does not define folds no way at all", () => {
    expect(topicGranularity("rooms")).toBeUndefined();
  });

  test("`notify` is the only topic with nothing to snapshot", () => {
    const events = Object.entries(TOPIC_ATTRIBUTES)
      .filter(([, attrs]) => attrs.granularity === "event")
      .map(([topic]) => topic);
    expect(events).toEqual(["notify"]);
  });

  test("a topic several instances write folds per instance", () => {
    // A whole-value frame from one instance must not erase another's entries,
    // so every instance-wide list is `per_instance_whole`; `session_status` is
    // whole because one session lives on one instance.
    for (const topic of ["peers", "agents", "session_errors", "llm_requests", "llm_status"]) {
      expect(TOPIC_ATTRIBUTES[topic as keyof typeof TOPIC_ATTRIBUTES].granularity).toBe(
        "per_instance_whole",
      );
    }
    expect(TOPIC_ATTRIBUTES.session_status.granularity).toBe("whole");
  });

  test("the records that authenticate a person are the one topic no person may read", () => {
    const forInstances = Object.entries(TOPIC_ATTRIBUTES)
      .filter(([, attrs]) => !(attrs.roles as readonly string[]).includes("user"))
      .map(([topic]) => topic);
    expect(forInstances).toEqual(["auth_records"]);
    expect(TOPIC_ATTRIBUTES.auth_records.roles).toEqual(["instance"]);
  });

  test("subscribing is open to every role, and the topic table is what narrows it", () => {
    // An instance subscribes as itself to `auth_records`, so the op cannot
    // refuse the role; what a person may not have is refused by the topic.
    for (const role of ["session", "user", "instance"] as const) {
      expect(isRoleAllowed("topic_subscribe", role)).toBe(true);
      expect(isRoleAllowed("topic_unsubscribe", role)).toBe(true);
    }
  });
});

describe("schemas and the table", () => {
  test("every schema belongs to an op in the table", () => {
    for (const op of Object.keys(OP_SCHEMAS)) expect(OP_NAMES).toContain(op as OpName);
  });

  test("no op is left without a schema", () => {
    const specified = new Set(Object.keys(OP_SCHEMAS));
    expect(OP_NAMES.filter((op) => !specified.has(op))).toEqual([]);
  });

  test("every topic the attribute table admits carries a frame schema", () => {
    const framed = new Set(Object.keys(TOPIC_SCHEMAS));
    const declared = Object.keys(TOPIC_ATTRIBUTES);
    expect(declared.filter((topic) => !framed.has(topic))).toEqual([]);
    expect([...framed].filter((topic) => !declared.includes(topic))).toEqual([]);
  });

  test("a frame schema pins the topic it belongs to", () => {
    for (const [topic, schema] of Object.entries(TOPIC_SCHEMAS)) {
      expect((schema as { $id?: string }).$id).toBe(`topic:${topic}`);
    }
  });

  test("a request schema pins the op name it belongs to", () => {
    for (const [op, pair] of Object.entries(OP_SCHEMAS)) {
      if (!pair) continue;
      const request = pair.request as { allOf?: { properties?: { op?: { const?: string } } }[] };
      expect(request.allOf?.[0]?.properties?.op?.const).toBe(op);
    }
  });
});
