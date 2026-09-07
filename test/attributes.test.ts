import { describe, expect, test } from "bun:test";
import {
  isRoleAllowed,
  OP_ATTRIBUTES,
  OP_NAMES,
  opErrors,
  opsOfPlane,
  type OpName,
} from "../src/attributes.ts";
import { ERROR_CODES } from "../src/errors.ts";
import { OP_SCHEMAS, TOPIC_SCHEMAS } from "../src/schemas.ts";
import { TOPIC_ATTRIBUTES } from "../src/common/topics.ts";

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

  test("only hello and ping are callable before hello", () => {
    const open = OP_NAMES.filter((op) => !OP_ATTRIBUTES[op].needs_hello);
    expect(open.sort()).toEqual(["hello", "instance_ping"]);
  });

  test("the planes hold the op counts the contract states", () => {
    expect(opsOfPlane("common")).toHaveLength(5);
    expect(opsOfPlane("messaging")).toHaveLength(4);
    expect(opsOfPlane("control")).toHaveLength(25);
    expect(opsOfPlane("mesh")).toHaveLength(0);
    expect(OP_NAMES).toHaveLength(34);
  });

  test("role checks read the table", () => {
    expect(isRoleAllowed("say_post", "session")).toBe(true);
    expect(isRoleAllowed("say_post", "user")).toBe(false);
    expect(isRoleAllowed("say_mark_read", "session")).toBe(false);
    expect(isRoleAllowed("session_kill", "user")).toBe(true);
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
