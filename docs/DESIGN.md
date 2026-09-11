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
| Identifiers | `src/identifiers.ts` | `sid` / `instance` / `endpoint` / `mid`, roles, capabilities, timestamps |
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
| `needs_hello` | whether an identity settled by `hello` is required (everything but `hello`, `instance_ping` and the four ops that settle an identity) |
| `capability` | the capability it needs; absent from `hello`'s set means `capability_unavailable` |
| `locality` | `instance-local` ops are forwarded to the owning instance, or answer `instance_unreachable` |
| `scope` | present when the role changes what the reply may contain rather than whether the call is allowed |
| `carrier` | present on an op carried over HTTP rather than as a frame on the WebSocket; who may call it is not the carrier's to decide (below) |
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
| `element` | the elements that changed | matches on each element's own id and adds or updates; elements it does not mention are untouched, so a removal arrives as a marked element (an absence in a list of changes says nothing) | yes | `inbox`, `kv:<ns>`, `auth_records` |
| `append` | what has been added since the last frame | appends, and never rewrites what is already there | yes | `transcript:<sid>`, `transcript_items:<sid>` |
| `event` | an occurrence rather than a value | holds nothing | no | `notify` |

Only `event` has no snapshot: nothing is held, so subscribing yields the next occurrence
rather than a current state. `session_status` is whole rather than per instance because one
session lives on one instance, leaving no other instance's half to preserve.

## Conventions (machine-checked)

- Times are Unix milliseconds as integers and are named `*_at`; durations carry their unit
  (`*_ms` / `*_secs`)
- Fields are snake_case; ops are `<noun>_<verb>` (`hello` is the one single word)
- "Unknown" is omitted; "none" is an empty array
- Identifiers: `sid` is a globally unique uuid, `instance` is the opaque random value an
  instance issues for itself (16 bytes as hex), `endpoint` is the URL it is dialed at,
  compared whole including its path, `mid` is `<instance>/<counter>`

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
derive it derives. A greeting is taken field by field: leaving a field out does not withdraw
it (one session reaches the instance as a run of short-lived processes, none of which
knows every field).

The classification (`state`) is **derived by the instance and carried on the row**. Handing
back the raw inputs for a client to assemble would let each instance's reading drift. The
vocabulary is three for a connected session (`waiting`, `live`, `live_unmanaged`) and two
for one that was lost (`paused`, `disappeared`), which the presence of `stopped_at` alone
separates. Being pinned is a mark a person put there rather than a classification, so it
travels beside it as `pinned`.

`protocol_version` on a `peers` row is the generation the row's own connection announced,
so it is absent for a `live_unmanaged` row: such a row exists because an instance's state
file names a session live with no connection at all, not because a client greeted it and
was refused.

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

## Transcript item types

A transcript is a file the harness writes for its own reasons, and its shape changes without ccmsg agreeing to it. What the contract holds is **the vocabulary a line was read into — the item types — and nothing that reads a line**. The classifying lives in the daemon, which is what opens the file, and what travels is the typed items it made. Neither the contract nor a client moves when the harness changes its format, or when a second harness (codex's rollout) is read at all.

A type name is `:`-separated, and a prefix names everything below it: `tool` is every tool, `message:user` both directions of what a person and a session said. Three families stay open at their last segment — `tool:<Name>`, `system:attachment:<kind>`, `hook:<Event>` — because the harness coins that segment, and a closed list would turn every newcomer into `unknown` with nothing left to say what arrived. `TRANSCRIPT_ITEM_TYPES` spells out the closed part alone; a name outside it is a newcomer rather than an error. Segments after the first are not snake_case because they are the harness's spelling (`tool:Bash`, `hook:PreToolUse`).

`in` and `out` are read **from wherever the subject stands**. The subject is the session by default and one agent below it when `agent_id` names one; the type definitions do not change, only what they point at, which is what lets one preset be carried down a chain of agents.

The second segment of a `message:*` names **a relation read from the subject**: `parent` is whoever started this agent, `sub` a throwaway agent it started, `team` a named counterpart that goes on standing, `session` another session over ccmsg. The one exception is `user` — not a relation to anyone, but **the user**, standing alone. An agent's parent is a session or another agent, and calling that `user` would have a reader take a machine for a person.

A harness's own name for a party is never a type. `main` is the main, not a relation, so `message:main` would read as the main session's traffic being overheard wherever it happens — when what is meant is the party this subject answers to, which is what `parent` says. The literal names (`main`, a lead's, a teammate's) are kept in the item's `harness_name`.

Which of those standings the subject held is stated by the item itself, in `subject`: `main` is a session's own transcript, `sub` a throwaway worker's, `team` a teammate's — one that was named and goes on standing. The relation names (`parent`, `sub`, `team`, `session`) are read **from that standing**, so the same `message:parent:in` is an errand's brief under a `sub` and what a lead wrote under a `team`. Without it on the item, a client drawing several transcripts together can only place an item for as long as it remembers the request that fetched it. It is not `harness_name`: that is the other party's literal name and arrives only when one was given, while a subject always has a standing.

| type | `subject: "main"` (session) | `subject: "sub"` (throwaway agent) | `subject: "team"` (teammate) |
|---|---|---|---|
| `message:user:in/out` | with a person | (does not occur) | occurs: a person types at it directly |
| `message:parent:in/out` | (does not occur) | the brief, and the answer to it | the lead's instructions and the replies to them |
| `message:sub:out/in` | the agents it started and their answers | agents below it | agents below it |
| `message:team:out/in` | what it wrote to a teammate and heard back | (does not occur) | with the other teammates |
| `message:session:out/in` | another session over ccmsg | only if the agent ran ccmsg | the same |

"Does not occur" is **not a refusal**. A line that arrives anyway is still a line and is emitted under the name it fits — vanishing silently is the same failure an unknown type would be.

`sub` and `team` are apart because **a round trip folds differently**. A throwaway agent is started, answers once and is done, so `message:sub:in` is the result of the `message:sub:out` that started it. A teammate is named and goes on standing: its reply is not the answer to the call that sent something, it is a message of its own, arriving addressed and whenever it was written. Only the call that starts a teammate has a result to pair with; everything after is two independent messages. `message:parent:out` is prose-or-call for the same reason — an agent's answer is plain text the harness collects, with no call behind it, and requiring a `tool_use_id` would leave the one message an agent is certain to send unnameable.

An item is identified by its `id` (`<uuid>:<index>` — the record it was read from and where in it the item stood), and `uuid` stays beside it as **the record the item came out of**. One assistant record becomes the thinking, the text and each call it held, so a record id alone names all of them at once and leaves a link with nothing single to resolve to.

A call and its result are **two items**, pointing at each other by id through `result_item` and `parent_item`. An agent's or a monitor's result arrives many turns later, so folding the pair into one item would make the classifying decide which of the two instants it happens at; folding belongs to whoever draws them. A link is written from the whole transcript rather than from the slice it travels in, so **a link out of the range asked for is ordinary** — the reader has the id and can ask for it. A `use` with no `result_item` is a call that has not come back. The links point by id and not by position, since the selection and the range decide which items exist at all. `parent_item` is what the reader saw and not what the file holds: a read that begins in the middle — a topic's seed, a transcript resumed from another file — meets results whose call is behind where it started, so the link is optional and **`parent_tool_use_id` is the one that is always there**, the harness's key for the call, joined against the `tool_use_id` every call carries. A result with neither placed would be a line that says what came back and never what it came back from.

Every item also carries `source` (`offset` and `bytes`), **where in the file the record it was read from begins and how far it runs**. Classifying is fallible, and the one question it cannot answer is what the line actually said: a `transcript_read` bounded to end at `offset + bytes` returns that record, so a client draws typed items and fetches the raw record only for the ones it doubts. Several items out of one record share the address, which makes the fetch a record and never a slice of one.

There are two typed ways in. `transcript_items_read` answers with items over the range a dump is cut by (`since_at` / `since_uuid` / `until_*`) and the same `types` selection; which end a `limit` keeps follows from the bound given: a lower bound (`since_at` / `since_uuid` / `since_id`) reads from the range's start and `next` names the first item left out, and anything else — an upper bound alone (`until_at` / `until_uuid` / `until_id`), or no bound at all — reads the range's last items, with `prev` naming the first one answered, which `until_id` takes to read further back. **A first read therefore asks with no bound and is answered the tail**, the way `transcript_read` with no `before` is, and a reader that wants the transcript from its beginning says so with `since_at: 0` — the typed counterpart of paging `transcript_read` backwards by byte, so a client drawing the newest items first walks back without reading the transcript whole. The `transcript_items:<sid>` topic is the typed form of `transcript:<sid>`: its snapshot is the tail of the list, in a count the instance decides, and every frame after carries what has since been classified. The raw `transcript_read` and `transcript:<sid>` both stay — the typed pair is what a client works in, the raw pair is how it fetches a record by an item's `source`.

An element of `types` is a type name, a prefix, either negated with `-`, or `@<preset>`, applied left to right. Presets are not fixed here: an instance's config holds them and `dump_presets_read` reads them. What a preset names is an **interest** — how the work was done, what to hand over — and an interest is not a property of the wire. Type names stay one to one with what a record is, and the groupings people reach for are named by whoever configures them. Expanding a reference, and refusing a cycle or an unconfigured name, belong where the config is validated.

`session_dump_write` answers with `entries` as **a count per type** rather than one total, and with an `ids` ledger beside it. A single total leaves the caller unable to tell a dump that kept what it asked for from one whose selection matched almost nothing. The ledger gathers the ids the items carried, so naming an agent from it as the next dump's subject needs no reading of the file. An id says how to point at something rather than what a line is, which is why it is not one of the types.

A dump's reply names a path and carries no items, so **the file is where the items actually travel**. Its shape is therefore the contract's too (`SessionDumpFile`: `sid`, `agent_id?`, `written_at`, the selection as applied, `items`, `ids`, as JSON) — otherwise a successor session handed the path, or a client fetching it, would be reading a format nothing states. The file repeats what was asked for because it outlives the request: it has to say on its own what it is a dump of and what was left out.


## Limits the sender keeps to

A limit only the sender can keep to is a value the contract holds. A limit only the receiver
knows is one the sender cannot read its own refusal against.

`MAX_FRAME_BYTES` of 1 MiB is the ceiling on a single frame — one newline-delimited line, be
it a request, a reply or a topic frame. A frame over it is answered `bad_request` and the
connection stays up. What to do with a body above it — split it, write it as a file and send
the reference — is the caller's decision, so the contract states the limit and not a remedy.

A limit the receiver keeps has one thing the sender can read: `rate_limited`, the answer an op gives when
what it would queue for a reader has filled up. It is apart from `internal_error` because nothing failed and
the arguments are not what to look at again — the same call sent once the reader has caught up is the one
that goes through. Only an op that queues for a reader (`notify_send`, `say_post`) declares it; a message
held for a session that is not reading needs no refusal, since the inbox is where it waits.

`TITLE_MAX_CHARS` of 200 is the ceiling on `session_rename`'s `title`, and the schema's
`maxLength` is the same value. A title is typed into a terminal and becomes a session's first
line, so it stops at a readable length rather than at whatever the terminal would accept.

## Versions and compatibility

`PROTOCOL_VERSION` is an integer naming a generation. Within a generation only optional
fields and whole new ops may be added; removals and changes of meaning raise it. Peers
announcing another generation are refused, on client connections and mesh links alike.
There is no compatibility path.

## Instances and mesh

**Identity is the `instance` id; what is dialed and what TLS is checked against is the
`endpoint` URL**, and the two are separate types. The id is an opaque random value an
instance issues for itself once and keeps through a move. The endpoint is the instance's
published base URL (`http(s)://<host>[/<prefix>]/`, trailing slash required, no query or
fragment); several instances may share one origin, so the comparison is the whole URL rather
than the origin, and the trailing slash is required so `/ccmsg` and `/ccmsg/` are not two
spellings of one instance.

The routes sit **below** the endpoint and are no part of it: `<endpoint>ws` for the WebSocket,
`<endpoint>mesh/*`, `<endpoint>auth/*`, `<endpoint>webhook/*`. Each keeps the endpoint's own
scheme and none is rewritten to `ws(s)://` — a WebSocket begins as an HTTP request that
upgrades, so one spelling of the URL is enough. Cut that way, the value that says where an
instance lives does not change when a transport moves off `/ws`. Everything keyed by the id — `mid`, the store's keys, the issuer of a
record or a token — survives the endpoint changing. `hello` answers with the answering
instance's id and endpoint, and with the instances it can see (each an id, an endpoint and a
reachability). An entry's `id` is optional, because it is unknown until the handshake with
that peer has settled — a configured endpoint is known before anything answers there, and a
peer whose link is down is the last one to drop from the list. `endpoint` is optional on every
line and on the answering instance's own: an instance that joins no mesh has no URL to give a
peer. The reply also carries `terminal_gateway` where one stands in front of the machine the
instance's sessions run on — the base URL a person opens a session's terminal under, as
`<terminal_gateway>/sessions/<terminal_id>` with the handle the `agents` topic names. It is
absent where the instance cannot reach its sessions' terminals, the same condition that leaves
`terminal` out of `capabilities`.

Authentication between instances happens once, at connection time, and a `role: "instance"`
`hello` starts it (its `mesh` field is the claim and the location of a single-use key). The
`iss` / `aud` compared there are endpoints — trust is rooted in the URL and nowhere else. The
id the peer names travels in the same hello, and the proof landing is what makes everything
that hello said trusted, so the receiver keeps an authenticated endpoint-to-id mapping. That
mapping is what a later `to_instance` id is dialed through. One id binds to one link: a hello
naming an id already bound to another endpoint is the one closed, and the standing binding
stays. The procedure of record is mesh-peer-auth in the main ccmsg repository.

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

## Authenticating a person

What the contract holds is **the shape on the wire, and nothing else**. The procedure —
registering and verifying a passkey, the cookie, replicating the records, where a challenge
is forwarded — is DR-0001 in the main ccmsg repository, and is not copied here.

The four ops that settle a person's identity (`auth_challenge`, `auth_register`,
`auth_assert`, `auth_refresh_token`) are **carried over HTTP**: reading and setting a cookie,
and answering before a connection exists, are things a frame on the WebSocket cannot do. They
are in the attribute table all the same, because **authorization is not decided outside that
table** — what a carrier decides is what an op can do, never who may call it. All four are
`needs_hello: false` and reachable from a connection with no identity yet, as `hello` is; the
`request_id` is composed by the HTTP carrier. They are served at `<endpoint>auth/*`, and
`RegisterClaims.endpoint` names that same base URL.

Besides the registration URL's token, `auth_register` takes the six digits the command line
showed when that URL was made. They are not in the URL: the two halves reaching the browser by
different routes is exactly what makes holding the URL insufficient, and the contract states
that by taking the code as a required argument. A wrong code and a spent URL are both answered
with the existing `auth_invalid` / `auth_expired`, which do not say which half failed.

A registration carries its challenge with an issuer beside it, as an assertion does. The value
is inside `client_data_json` as well, but who may spend it is not, and behind a load balancer
the instance that issued the challenge, the one that made the registration URL and the one
receiving this may all be different. The field being optional means a receiver may be left
with a value and no issuer, in which case it can only honour a challenge it holds itself and
refuses the rest rather than guessing.

The code is judged by the issuer alone. A receiving instance forwards it beside the token on
`auth_resolve`'s `register` and decides nothing: the issuer is what counts the attempts, and a
receiver ruling on the code itself would let an attacker spread guesses across instances with
none of them counted anywhere.

A registration URL's claims carry a `user_id`, sixteen random bytes the issuing instance
settles on once per subject. The page creates the credential against it as `user.id`, the
instance keeps it as `CredentialRecord.user_handle`, and an assertion naming a handle is held
to it. It is not left to the page because the authenticator keeps it beyond the instance's
reach — two values for one person would be two accounts on their device.

A credential record keeps the `endpoint` it was registered for, and an assertion is accepted
only there: the origin has to match and the request's path has to fall under that base URL.
`https://h/` and `https://h/personal/` are two endpoints and take two registrations, on one
host and one RP ID alike — an RP ID says which domain an authenticator answers for, which is
coarser than which instance a person has been admitted to. Binding to the base URL rather than
the origin is what stops one instance's credential from being a way into its neighbour.

A credential record keeps the `rp_id` it was registered under. A passkey answers only for the
domain it was created against, so an assertion's `rpIdHash` is checked against that and not
against the host of whatever endpoint was reached.

Two names travel with a registration. `RegisterClaims.issued_label` is what the administrator
wrote about who the URL was for; `auth_register`'s `device_label` is what the person wrote
about which device they are on. The credential record keeps both, along with the address and
user agent at registration and at last use. None of it authenticates anything and nothing is
decided by it — an address is chosen freely by whoever makes the request. It is there as
**something to recognise**: the one person reading their own list places a line as theirs
because the address is their home provider's and the browser is the one they use, or fails to,
and removes it.

A credential record also keeps the BE and BS flags of the authenticator data it was
registered with (`backup_eligible`, `backup_state`), and a token family keeps its most recent
rotation (`last_refresh`: when, from where, and the `reason` the client stated). Both are
hints of the same order as the addresses above — **nothing is admitted or refused by either**.
BE and BS say whether a passkey is one synced across a person's devices or one bound to the
device it was made on, which is what removing a line costs them; `reason` is the caller's
unchecked word, and a refresh that states none is as valid as any.

The other three:

- `auth_refresh` is a WebSocket op. It moves a live connection's deadline (`hello`'s
  `auth_expires_at`) rather than closing it
- `auth_resolve` and `auth_rotate` are between instances (`roles: ["instance"]`, `locality:
  instance-local`). What only an issuer can answer — checking a registration URL, spending a
  challenge, rotating a token family — is forwarded to it as `to_instance = iss`. A forwarded
  rotation carries the `reason`, `ip` and `user_agent` the receiving instance observed, since
  the person is at the other end of its connection and not the issuer's; the issuer writes
  them to `last_refresh` unchecked, as it does the ones it observes itself

A family remembers the refresh values it retired as digests in `retired`, kept until each
value's own expiry — replicating the values themselves would be handing live secrets around,
where recognising a replay only asks whether something presented now was once issued here and
no longer stands.

Credential records and token families are replicated on the `auth_records` topic
(`roles: ["instance"]`, element granularity). Not on the store, because the store is the
person's to read and write: a token read out of it would be their session, and a credential
written into it would be a new way in. A removal travels as a tombstone element, since an
absence in a list of changes says nothing.

## What the contract holds

| Unit | Count | Breakdown |
|---|---|---|
| ops | 46 | common 13 / messaging 4 / control 29 / mesh 0 |
| topics | 12 | messaging 2 (`inbox` / `notify`), control 9, common 1 (`auth_records`) |
| capabilities | 9 | `fork` `launcher` `llm_events` `llm_stats` `llm_status` `llm_usage` `sandbox` `terminal` `translate` |
| error codes | 21 | one closed union |

Every op has a request and a reply in `OP_SCHEMAS`, and every topic a frame in
`TOPIC_SCHEMAS`. `OP_SCHEMAS` is typed `Record<OpName, OpSchemas>`, so adding an op to the
attribute table without writing its schema fails to typecheck; the topics are checked against
the attribute table in both directions.

Types whose vocabulary belongs to `claude` or to `llm-gateway` (`AgentInfo`,
`LlmRequestInfo`, `LlmStatusReport` and their like) carry the mark `upstream()` makes. The
mark says that an unfamiliar value is theirs to add — it does not exempt the type from the
spelling above. Their documents are rewritten into snake_case and Unix milliseconds as the
daemon takes them in, so what travels here is this contract's spelling.

## The fixtures the contract holds

For every op's request and reply, and for every topic's frame, `src/fixtures/` holds a representative JSON of the real wire, exported as `@ccmsg/protocol/fixtures`. It is not reachable from `.`: nothing in an implementation's production code has a reason to hold an example, so the fixtures are read by tests alone. The contract's own tests walk `OP_NAMES` and `TOPIC_SCHEMAS` and put every one of them through its schema, so a change to an op or a frame breaks the fixture with it.

An implementation's tests (the daemon's, the web UI's) read these. Copying the expected JSON into the implementation leaves the copy silently stale when the contract moves, and the test then says only that the implementation agrees with its own copy. Read from the contract, that agreement is agreement with the contract.
