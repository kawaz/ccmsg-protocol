# ccmsg-protocol

> 🇯🇵 [README-ja.md](./README-ja.md)

The **contract of record** shared by the ccmsg daemon and its web UI. It holds the shape of every op, event, error code and identifier as a schema, and both sides validate against it.

The contract is decided here and the daemon and web UI follow it. Neither side learns the other's internals by any route that does not pass through it.

It covers 48 ops over four planes (common, messaging, control, mesh), 13 topics that are each a snapshot plus a stream of changes, one closed union of 21 error codes, and the op attribute table that authorization, capability gating and forwarding all read.

## Install

```bash
bun add @ccmsg/protocol
```

## Usage

```ts
import { isValid, MessageSendRequest, OP_ATTRIBUTES, opErrors } from "@ccmsg/protocol";

isValid(MessageSendRequest, incoming); // validating the wire is the contract's job
OP_ATTRIBUTES["message.send"].roles; // authorization reads the table, not a branch
opErrors("session.rename"); // the codes this op may answer with
```

`@ccmsg/protocol/fixtures` is a second entry point holding a representative JSON of the real wire for every request, reply and topic frame. An implementation's tests read them from here rather than keeping a copy that goes stale.

## Documentation

- [DESIGN.md](./docs/DESIGN.md) — the layers, the four planes, the op attribute table, how topics are folded, the item types a transcript is read into, instances and mesh, authenticating a person, and the naming conventions

## License

MIT License, Yoshiaki Kawazu (@kawaz)
