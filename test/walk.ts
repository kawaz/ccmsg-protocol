import type { TSchema } from "@sinclair/typebox";
import { ConnectionEvent, ErrorResponse } from "../src/envelope.ts";
import { OP_SCHEMAS, TOPIC_SCHEMAS } from "../src/schemas.ts";

/** Every schema this package puts on the wire, so a convention can be checked
 * against all of them at once instead of being re-asserted per op. */
export function allSchemas(): { name: string; schema: TSchema }[] {
  const out: { name: string; schema: TSchema }[] = [
    { name: "ErrorResponse", schema: ErrorResponse },
    { name: "ConnectionEvent", schema: ConnectionEvent },
  ];
  for (const [op, pair] of Object.entries(OP_SCHEMAS)) {
    if (!pair) continue;
    out.push({ name: `${op}:request`, schema: pair.request });
    out.push({ name: `${op}:response`, schema: pair.response });
  }
  for (const [topic, schema] of Object.entries(TOPIC_SCHEMAS)) {
    out.push({ name: `topic:${topic}`, schema });
  }
  return out;
}

export interface FoundProperty {
  readonly key: string;
  readonly schema: Record<string, unknown>;
}

/** Every named property reachable in a schema, through object properties,
 * array items and the composition keywords `Type.Intersect` / `Type.Union`
 * produce. */
export function properties(schema: TSchema): FoundProperty[] {
  const found: FoundProperty[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    const record = node as Record<string, unknown>;
    const props = record["properties"];
    if (typeof props === "object" && props !== null) {
      for (const [key, child] of Object.entries(props)) {
        found.push({ key, schema: child as Record<string, unknown> });
        visit(child);
      }
    }
    visit(record["items"]);
    for (const keyword of ["allOf", "anyOf", "oneOf"]) {
      const branch = record[keyword];
      if (Array.isArray(branch)) for (const child of branch) visit(child);
    }
  };
  visit(schema);
  return found;
}
