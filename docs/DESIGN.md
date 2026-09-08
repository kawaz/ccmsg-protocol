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
| common | everyone | connecting (`hello` / `instance_ping` / `instance_shutdown`), declaring the end (`session_stopping`), and subscribing (`topic_subscribe` / `topic_unsubscribe`) |
| messaging | agents (session role) and people (user role, through the web UI) | one-to-one delivery to a sid, say, notify |
| control | the web UI and the CLI's admin commands (user role) | session observation and operation, files, launcher, sandbox, llm, diagnostics |
| mesh | instances among themselves | no ops of its own — only the envelope's `to_instance` / `from_instance` / `hops` |

The four share one type system, one envelope and one error vocabulary. A plane is a column
of the op attribute table, not a separate schema.

Messaging has no rooms. A message is addressed to one sid, and the record of a conversation
is the session's own transcript. The route back is not carried as text either: answering
means sending to the delivery frame's `from`, and that structure is all the contract states.

A message is addressed to a sid, but **its sender need not be one**. Both the session and
the user role may call `message_send`, and a person at the web UI has no sid. So `from` is
`Sender`, which is `Sid | "user"`; the literal is spelled out rather than left as an absent
field so that "a person sent this" reads apart from "a session sent this and the id was
lost". Every sid remains a valid sender. Nothing can be sent back to `user`, so how an
answer reaches a person is the instance's to arrange.

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
`ccmsg-mid` / `ccmsg-from` / `ccmsg-reply-to` are this contract's identifiers. In the body
`from` is always `ccmsg` and holds neither a sid nor a `uds:` path — those are addresses the
harness actually dials, and dialing one that has gone ends the recipient's turn in failure.
The `from` of the frame it is written in is a separate address, where the instance may name a
`uds:` socket of its own to receive delivery status on. Those receipts are negative only —
`refused`, `denied`, `dropped`, `expired`, `held` — so silence within the window is delivery.
The way back is one line at the end of
the body (`Reply with: ccmsg reply <mid> --to <sid> <text>`), which the recipient runs itself.
The sid is spelled out because a `mid` does not name its sender; making it resolvable instead
would take an op for it, and that op a sent-message index the daemon does not otherwise need.

Only when the sender is a person (`from` is `user`) does `--to` drop, leaving
`Reply with: ccmsg reply <mid> <text>`. `user` is not a sid, so `--to user` would be an
address nothing reaches. What such an answer becomes — a notification back to the web UI,
say — is the instance's to decide, and the recipient only has to run the line.

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

Sharing one payload type leaves exactly one question the shape cannot answer: what a later
frame does to the value already held. The contract holds that as `granularity` in
`TOPIC_ATTRIBUTES`, so the daemon and the web UI fold the same way instead of each keeping a
local table of it.

| granularity | What a frame carries | How a subscriber folds it | snapshot | Topics |
|---|---|---|---|---|
| `whole` | the whole value | replaces everything held | yes | `session_status:<sid>` |
| `per_instance_whole` | the whole of what its `instance` knows | replaces that instance's entries and leaves every other instance's alone (what is held is the union across instances) | yes | `peers`, `agents`, `session_errors`, `llm_requests`, `llm_status` |
| `element` | the elements that changed | matches on each element's own id and adds or updates; elements it does not mention are untouched, so a removal arrives as a marked element (an absence in a list of changes says nothing) | yes | `inbox`, `kv:<ns>` |
| `append` | what has been added since the last frame | appends, and never rewrites what is already there | yes | `transcript:<sid>` |
| `event` | an occurrence rather than a value | holds nothing | no | `notify` |

Only `event` has no snapshot: nothing is held, so subscribing yields the next occurrence
rather than a current state. `session_status` is whole rather than per instance because one
session lives on one instance, leaving no other instance's half to preserve.

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

There is one way in to `stopped_at`: `session_stopping`, by which a session states that it
is about to stop, with the instance holding that declaration until the disconnection
arrives so that the two are one event in that order. A session that goes without saying so
is `disappeared` — what separates stopping on purpose from being lost is the declaration,
not an observation. The session itself calls it (the role is `session` alone), with the
harness's end-of-session hook or the `ccmsg` CLI standing in for it.

**How busy a session is is an attribute of the row too**, carried as `gateway_active_at`:
when inference last ran for it. A session can be busy in any of the connected
classifications, so folding it into `state` would lose one of the two. It is an instant
rather than a flag because nothing observes the moment a request stops being in flight — a
client reads recency against its own threshold. It is absent on an instance with no gateway
configured, which means there is nothing observing inference, never that the session is
quiet.

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

A forwarded request is authorized again in full at its destination. The envelope's `caller`
(a `role`, and a `sid` when that role is `session`) is the identity it dispatches as, and the
forwarder's own verdict is not carried over. What is taken on trust is the claim itself — the
forwarder is an authenticated peer, so its word on who called is believed, an assumption that
holds inside one deployment and nowhere else. A forwarded request naming no caller is
dispatched as the role of the connection it arrived on (`instance`), which the attribute table
answers with `forbidden` for every instance-local op. A request that would pass through the
same instance twice is dropped on the envelope's `hops` rather than looped.

A broken link is visible from a subscription too. A `peers` frame may carry the sending
instance's view of the instances (`instances`, each with `reachable`), so learning that a link
went down does not mean greeting again to find out. Reachability is stated from the sender's
position, so two instances legitimately disagreeing about one is not a fault.

## What the contract holds

| Unit | Count | Breakdown |
|---|---|---|
| ops | 37 | common 6 / messaging 4 / control 27 / mesh 0 |
| topics | 10 | messaging 2 (`inbox` / `notify`), control 8 |
| capabilities | 9 | `fork` `launcher` `llm_events` `llm_stats` `llm_status` `llm_usage` `sandbox` `terminal` `translate` |
| error codes | 17 | one closed union |

Every op has a request and a reply in `OP_SCHEMAS`, and every topic a frame in
`TOPIC_SCHEMAS`. `OP_SCHEMAS` is typed `Record<OpName, OpSchemas>`, so adding an op to the
attribute table without writing its schema fails to typecheck; the topics are checked against
the attribute table in both directions.

Types whose vocabulary belongs to `claude` or to `llm-gateway` (`AgentInfo`,
`LlmRequestInfo`, `LlmStatusReport` and their like) carry the mark `upstream()` makes. The
mark says that an unfamiliar value is theirs to add — it does not exempt the type from the
spelling above. Their documents are rewritten into snake_case and Unix milliseconds as the
daemon takes them in, so what travels here is this contract's spelling.
