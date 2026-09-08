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
| Session description | `src/session-meta.ts` | the shared fields naming where a session lives and what it runs as |
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

## Wording a message handed over directly

One recipient cannot read the delivery frame. It is the route that writes into the harness's
own messaging socket: there the recipient is the model rather than a client, and what arrives
is one block of text. With no frame to look at, **a message without `mid` and `from` in its
body cannot be answered** — the recipient knows something came and not what to answer or how.
So this one wording belongs to the contract (`renderDirectDelivery` / `parseDirectDelivery`).

The shape is the harness's own sender convention: `<cross-session-message>` embedded in the
body, where `from` / `from-name` / `from-mode` are the origin the receiving harness reads and
`ccmsg-mid` / `ccmsg-from` / `ccmsg-reply-to` are this contract's identifiers. `from` holds
neither a sid nor a `uds:` path — those are addresses the harness actually dials, and dialing
one that has gone ends the recipient's turn in failure. The way back is one line at the end of
the body (`Reply with: ccmsg reply <mid> <text>`), which the recipient runs itself.

`text` travels untouched. What the model reads is those characters, so replacing them with
entities would hand it a corrupted message to answer. A body containing the closing tag is
delivered rather than refused (one substring must not lose a message), and the closing tag is
found from the end. Only attribute values are escaped — `&` `<` `>` `"` — so a value cannot
leave its quotes.

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

## The shared key-value store

The control plane carries a small store under named namespaces (`kv_read` / `kv_write` /
`kv_delete`). All the contract promises is that **a key is unique within its namespace**: a
value is any JSON, and what it means belongs to whoever writes and reads it.

The store's ops are the only control ops that are `locality: cluster`. A value is held by the
cluster rather than by one instance, so whichever instance is asked can answer. Mirroring
between instances is the daemon's job, and two instances that disagree settle it on the later
`updated_at`. That is why a write may state its own: a value written while an instance was
unreachable can join later without pretending to be newer than it is.

The topic `kv:<ns>` shows one client's save to the others as it happens. The snapshot is every
entry in the namespace and each later frame is the entries that changed, with **a removal
carried as an entry marked `deleted: true`** — an absence in a list of changes would say
nothing. Because the namespace becomes part of a topic name it is kept to an identifier, while
a key may hold what a person typed and is bounded only in length and by rejecting control
characters.

## Session classification and retention

Where a session lives and what it runs as (`repo`, `ws`, `cwd`, `repo_root`, `branch`,
`transcript_path`, `title`, `model`, `effort`) is what the session itself states in `hello`
and what the instance repeats on each `peers` row. The names and types are stated in one
place (`src/session-meta.ts`), so the side that says them and the side that returns them
cannot spell them differently. What is not stated is omitted, and what an instance can
derive it derives.

The classification (`state`) is **derived by the instance and carried on the row**. Handing
back the raw inputs for a client to assemble would let each instance's reading drift. The
vocabulary is three for a connected session (`waiting`, `live`, `live_unmanaged`) and two
for one that was lost (`paused`, `disappeared`), which the presence of `stopped_at` alone
separates. Being pinned is a mark a person put there rather than a classification, so it
travels beside it as `pinned`.

The retention windows for undelivered messages and for the last-known list are values the
contract holds (`INBOX_RETENTION_MS` and `LAST_LIVE_RETENTION_MS` of 7 days,
`INBOX_MAX_PER_SID` of 256). What a person comes back to is one thing — the session and
what was said to it — so the two cannot expire at different times. The count is matched to
what a recipient will hold for one session, keeping what the contract accepts to what the
recipient can still be handed.

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
| ops | 36 | common 5 / messaging 4 / control 27 / mesh 0 |
| topics | 10 | messaging 2 (`inbox` / `notify`), control 8 |
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
