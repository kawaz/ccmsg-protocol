import { describe, expect, test } from "bun:test";
import { OP_NAMES } from "../src/attributes.ts";
import { PARAMETERIZED_TOPICS, PLAIN_TOPICS } from "../src/common/topics.ts";
import { ERROR_CODES } from "../src/errors.ts";
import { allSchemas, properties } from "./walk.ts";

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

describe("naming", () => {
  test("every field on the wire is snake_case", () => {
    const offenders: string[] = [];
    for (const { name, schema } of allSchemas()) {
      for (const { key } of properties(schema)) {
        if (!SNAKE_CASE.test(key)) offenders.push(`${name}.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("every op name is snake_case", () => {
    for (const op of OP_NAMES) expect(op).toMatch(SNAKE_CASE);
  });

  test("`hello` is the only op that is not `<noun>_<verb>`", () => {
    expect(OP_NAMES.filter((op) => !op.includes("_"))).toEqual(["hello"]);
  });

  test("every topic and error code is snake_case", () => {
    for (const topic of [...PLAIN_TOPICS, ...PARAMETERIZED_TOPICS])
      expect(topic).toMatch(SNAKE_CASE);
    for (const code of ERROR_CODES) expect(code).toMatch(SNAKE_CASE);
  });
});

describe("time and duration fields", () => {
  test("every `*_at` field is an integer (Unix ms)", () => {
    const offenders: string[] = [];
    for (const { name, schema } of allSchemas()) {
      for (const { key, schema: field } of properties(schema)) {
        if (!key.endsWith("_at")) continue;
        if (field["type"] !== "integer") offenders.push(`${name}.${key}: ${String(field["type"])}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no field names a point in time without the `_at` suffix", () => {
    const offenders: string[] = [];
    for (const { name, schema } of allSchemas()) {
      for (const { key } of properties(schema)) {
        const timeish = /(^|_)(ts|time|timestamp|date)$/.test(key) || /_(ms|secs)_at$/.test(key);
        if (timeish) offenders.push(`${name}.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
