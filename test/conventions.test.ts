import { describe, expect, test } from "bun:test";
import { OP_NAMES } from "../src/attributes.ts";
import {
  NAMESPACE_SCOPED_TOPICS,
  PLAIN_TOPICS,
  SESSION_SCOPED_TOPICS,
  Topic,
} from "../src/common/topics.ts";
import { ERROR_CODES } from "../src/errors.ts";
import { AgentInfo } from "../src/control/agents.ts";
import { LlmRequestInfo, LlmStatusReport } from "../src/control/llm.ts";
import { HelloUserRequest } from "../src/common/hello.ts";
import { TRANSCRIPT_ITEM_TYPES } from "../src/control/dump.ts";
import { FIXTURE_IDS } from "../src/fixtures/ids.ts";
import { isValid } from "../src/schemas.ts";
import { allSchemas, properties } from "./walk.ts";

const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** An op name: a `.`-separated hierarchy ending in the verb. */
const OP_NAME = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

/** A topic name: the same hierarchy, with a parameter at the end and nowhere
 * else. What stands after the `:` is the subject's own id, so it is left as
 * whatever issued it. */
const TOPIC_NAME = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

/** An item type: the hierarchy, with the last segment of an open family spelled
 * by whoever coined it. */
const ITEM_TYPE = /^[a-z][a-z0-9_]*(?:\.[A-Za-z0-9_-]+)*$/;

/** The families whose last segment is the harness's word rather than this
 * contract's, which is why that segment is held to no rule of ours. */
const OPEN_FAMILIES = ["tool.", "system.attachment.", "hook."];

/** The `_` spellings this contract has agreed are one word.
 *
 * Empty, and that is the point: `_` joins the parts of a single word, and every
 * name here is currently one word per segment. A name that puts two words in a
 * segment fails the check below until someone states, here, that the two are
 * read as one. */
const COMPOUND_SEGMENTS: string[] = [];

/** The segments a name is made of, less the last segment of an open family. */
function ownSegments(name: string): string[] {
  const family = OPEN_FAMILIES.find((prefix) => name.startsWith(prefix));
  const segments = name.split(".");
  return family === undefined ? segments : segments.slice(0, family.split(".").length - 1);
}

function wordJoins(names: readonly string[]): string[] {
  const found: string[] = [];
  for (const name of names) {
    for (const segment of ownSegments(name)) {
      if (segment.includes("_") && !COMPOUND_SEGMENTS.includes(segment)) found.push(name);
    }
  }
  return found;
}

const TOPIC_NAMES = [...PLAIN_TOPICS, ...SESSION_SCOPED_TOPICS, ...NAMESPACE_SCOPED_TOPICS];

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

  test("every op, topic and item type is a `.`-separated hierarchy", () => {
    for (const op of OP_NAMES) expect(op).toMatch(OP_NAME);
    for (const topic of TOPIC_NAMES) expect(topic).toMatch(TOPIC_NAME);
    for (const type of TRANSCRIPT_ITEM_TYPES) expect(type).toMatch(ITEM_TYPE);
    for (const code of ERROR_CODES) expect(code).toMatch(SNAKE_CASE);
  });

  test("a `_` in a name is one word's own, never two words joined", () => {
    // The shape above cannot tell `last_live` from `stat_batch`, so the join is
    // checked against a list this contract keeps: a segment that puts two words
    // together fails here until someone writes down that it reads as one.
    expect(wordJoins(OP_NAMES)).toEqual([]);
    expect(wordJoins(TOPIC_NAMES)).toEqual([]);
    expect(wordJoins(TRANSCRIPT_ITEM_TYPES)).toEqual([]);
  });

  test("a parameter is the end of a topic name and appears once", () => {
    // `transcript.items:<sid>` and never `transcript:<sid>.items`: the id names
    // the whole of what stands before it.
    for (const topic of SESSION_SCOPED_TOPICS) {
      expect(isValid(Topic, `${topic}:${FIXTURE_IDS.sid}`)).toBe(true);
      expect(isValid(Topic, `${topic}:${FIXTURE_IDS.sid}.items`)).toBe(false);
    }
    expect(isValid(Topic, `transcript:${FIXTURE_IDS.sid}:${FIXTURE_IDS.sid}`)).toBe(false);
  });

  test("the three greetings are the ops that name a role rather than a verb", () => {
    expect(OP_NAMES.filter((op) => op.startsWith("hello")).sort()).toEqual([
      "hello.instance",
      "hello.session",
      "hello.user",
    ]);
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

describe("what the contract does and does not pin down", () => {
  test("a field this generation has not heard of is carried, not refused", () => {
    // Within one generation a peer may add optional fields, so an older peer
    // has to tolerate one it cannot read. Refusing here would make every such
    // addition a breaking change and leave §8 with nothing to permit.
    expect(
      isValid(HelloUserRequest, {
        request_id: "1",
        op: "hello.user",
        protocol_version: 3,
        something_added_later: true,
      }),
    ).toBe(true);
  });

  test("a field it does know is held to its type", () => {
    expect(
      isValid(HelloUserRequest, { request_id: "1", op: "hello.user", protocol_version: "2" }),
    ).toBe(false);
  });
});

describe("types whose vocabulary belongs to someone else", () => {
  test("each says whose, so an unfamiliar value reads as theirs and not as a bug", () => {
    for (const schema of [AgentInfo, LlmRequestInfo, LlmStatusReport]) {
      expect(schema.description).toMatch(/^upstream: (claude|llm-gateway) — /);
    }
  });
});
