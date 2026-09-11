# ccmsg-protocol

> 🇯🇵 [README-ja.md](./README-ja.md)

The **contract of record** shared by the ccmsg daemon and its web UI. It holds the shape of
every op, event, error code and identifier as a schema, and both sides validate against it.

The contract is decided here and the daemon and web UI follow it. Neither side learns the
other's internals by any route that does not pass through it.

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

## Documentation

- [DESIGN.md](./docs/DESIGN.md) — layers, planes, the op attribute table, and the conventions

## License

MIT License, Yoshiaki Kawazu (@kawaz)
