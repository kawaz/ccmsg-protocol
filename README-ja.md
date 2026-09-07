# ccmsg-protocol

> 🇬🇧 [README.md](./README.md)

ccmsg の daemon と web UI が共有する**契約の正本**。op・イベント・エラーコード・識別子の
形を schema として持ち、両側が同じ schema で検証する。

契約はここで決まり、daemon と webui はそれに従う (規約ファースト)。片側がもう片側の内部構造を
知る経路は、この契約を通さずには作らない。

## インストール

```bash
bun add @ccmsg/protocol
```

## 使い方

```ts
import { isValid, MessageSendRequest, OP_ATTRIBUTES, opErrors } from "@ccmsg/protocol";

isValid(MessageSendRequest, incoming); // wire の検証は契約側の仕事
OP_ATTRIBUTES.message_send.roles; // 認可は表を引く (分岐を書かない)
opErrors("session_rename"); // その op が返しうるコード
```

## ドキュメント

- [DESIGN-ja.md](./docs/DESIGN-ja.md) — 契約の層・面・op 属性表・表記規約

## ライセンス

MIT License, Yoshiaki Kawazu (@kawaz)
