# ccmsg-protocol design

> 🇯🇵 [DESIGN-ja.md](./DESIGN-ja.md)

## Domain

This repository holds **one thing: the wire contract**. It writes down, as schemas, who may
call what, what comes back, and the shape of every frame that gets pushed — and both the
daemon and the web UI validate against it.

The contract has to be executable, not merely typed. A types-only contract leaves the
checking to each implementation's hand-written tests, and the two drift.

## Layers

| Layer | File | Contents |
|---|---|---|
| Identifiers | `src/identifiers.ts` | `sid` / `instance` / `mid`, roles, capabilities, timestamps |
| Errors | `src/errors.ts` | the closed `ErrorCode` union and the error body |
| Envelope | `src/envelope.ts` | request / response / topic frames / connection events, `PROTOCOL_VERSION` |
| Op attribute table | `src/attributes.ts` | every op, with its authorization, capability and placement |
| Op definitions | `src/common/`, `src/messaging/`, `src/control/` | arguments and replies per op, and the frame of each topic |
| Upstream marks | `src/upstream.ts` | the mark carried by types whose vocabulary is not ccmsg's |
| Validation | `src/schemas.ts` | op name to schema, and compiled validators |

## Planes

| Plane | Who uses it | Contents |
|---|---|---|
| common | everyone | connecting (`hello` / `instance_ping` / `instance_shutdown`) and subscribing (`topic_subscribe` / `topic_unsubscribe`) |
| messaging | agents (session role) and people (user role, through the web UI) | one-to-one delivery to a sid, say, notify |
| control | the web UI and the CLI's admin commands (user role) | session observation and operation, files, launcher, sandbox, llm, diagnostics |
| mesh | instances among themselves | no ops of its own — only the envelope's `to_instance` / `from_instance` / `hops` |

The four share one type system, one envelope and one error vocabulary. A plane is a column
of the op attribute table, not a separate schema.

Messaging has no rooms. A message is addressed to one sid, and the record of a conversation
is the session's own transcript. The route back is not carried as text either: answering
means sending to the delivery frame's `from`, and that structure is all the contract states.

A message that was not handed over right away has not failed. The reply says it went to the
inbox and why (the recipient is still starting up, paused, gone, unreachable over the mesh,
out of inbox room, or not taking anything at the moment), so the sender can choose between
waiting and addressing another session.

## The op attribute table

`OP_ATTRIBUTES` declares the following for every op. Authorization, capability gating and
forwarding all read this table instead of each keeping their own copy of the same branch.

| Attribute | Purpose |
|---|---|
| `plane` | which face the op belongs to |
| `roles` | who may call it; anyone else gets `forbidden` |
| `needs_hello` | whether an identity settled by `hello` is required (everything but `hello` and `instance_ping`) |
| `capability` | the capability it needs; absent from `hello`'s set means `capability_unavailable` |
| `locality` | `instance-local` ops are forwarded to the owning instance, or answer `instance_unreachable` |
| `scope` | present when the role changes what the reply may contain rather than whether the call is allowed |
| `errors` | the codes specific to this op |

The codes that follow from those attributes (`invalid_args`, `hello_required`, `forbidden`,
`capability_unavailable`, `instance_unreachable`) are derived by `opErrors()` rather than
listed per op, so adding a capability to an op cannot leave its error list stale.

## Observation is snapshot plus delta, in one shape

Anything observable is a topic you subscribe to. Right after `topic_subscribe` the current
value arrives once as a frame marked `snapshot: true`, and every later frame carries a change
in the same payload type. There are no one-shot read ops: subscribing and unsubscribing
immediately yields the same value.

Every frame names the `instance` it came from. Topics whose meaning is whole-value
replacement replace per instance, so several instances' values never collide.

## Conventions (machine-checked)

- Times are Unix milliseconds as integers and are named `*_at`; durations carry their unit
  (`*_ms` / `*_secs`)
- Fields are snake_case; ops are `<noun>_<verb>` (`hello` is the one single word)
- "Unknown" is omitted; "none" is an empty array
- Identifiers: `sid` is a globally unique uuid, `instance` is an endpoint URL compared whole
  including its path, `mid` is `<instance>/<counter>`

The first two are checked by `test/conventions.test.ts`, which walks every schema.

## Versions and compatibility

`PROTOCOL_VERSION` is an integer naming a generation. Within a generation only optional
fields and whole new ops may be added; removals and changes of meaning raise it. Peers
announcing another generation are refused, on client connections and mesh links alike.
There is no compatibility path.

## Instances and mesh

An instance is identified by the endpoint URL other instances dial. Several instances may
share one origin, so the comparison is the whole URL rather than the origin. `hello` answers
with the instance itself and the instances it can see.

Authentication between instances happens once, at connection time, and a `role: "instance"`
`hello` starts it (its `mesh` field is the claim and the location of a single-use key). The
procedure of record is mesh-peer-auth in the main ccmsg repository.

## What the contract holds

| Unit | Count | Breakdown |
|---|---|---|
| ops | 33 | common 5 / messaging 4 / control 24 / mesh 0 |
| topics | 9 | messaging 2 (`inbox` / `notify`), control 7 |
| capabilities | 9 | `fork` `launcher` `llm_events` `llm_stats` `llm_status` `llm_usage` `sandbox` `terminal` `translate` |
| error codes | 16 | one closed union |

Every op has a request and a reply in `OP_SCHEMAS`, and every topic a frame in
`TOPIC_SCHEMAS`. `OP_SCHEMAS` is typed `Record<OpName, OpSchemas>`, so adding an op to the
attribute table without writing its schema fails to typecheck; the topics are checked against
the attribute table in both directions.

Types whose vocabulary belongs to `claude` or to `llm-gateway` (`AgentInfo`,
`LlmRequestInfo`, `LlmStatusReport` and their like) carry the mark `upstream()` makes. The
mark says that an unfamiliar value is theirs to add — it does not exempt the type from the
spelling above. Their documents are rewritten into snake_case and Unix milliseconds as the
daemon takes them in, so what travels here is this contract's spelling.
