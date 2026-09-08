---
title: message_send の from をどう表すか (Sid 必須 vs user role)
status: open
category: design
created: 2026-09-08T13:39:56+09:00
last_read:
open_entered: 2026-09-08T13:39:56+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: kawaz/ccmsg
---

# message_send の from をどう表すか (Sid 必須 vs user role)

## 概要

`InboxMessage.from` は `Sid` 必須の型になっているが、`message_send` を呼べる
role は session と user の両方であり、user role (webui からの接続) は sid を
持たない。daemon v2 実装は §4.1「from は利用者入力を通さない」の方針に従い、
from を接続の identity からしか導出しないため、sid の無い user 接続からの
送信を bad_request で拒否している (kawaz/ccmsg `src/messaging/delivery.ts`)。

人 (user) からの送信をどう表すか、契約 (プロトコル定義) レベルで決める必要が
ある。候補: `from: Sid | "user"` のような union、または session/user を包含
する `Sender` 型を新設する。

## 背景

あわせて `from_label` (受信側 instance が表示名を解決するための材料) の元
データが `PeerInfo` に存在しない。現状 `PeerInfo.title` に相当するものは
`LastLiveSession` にしか無く、user 起点のメッセージに付与する表示名の材料が
無い。`PeerInfo` への `title` フィールド追加も合わせて検討する。

## 受け入れ条件

- [ ] `InboxMessage.from` (または代替の Sender 型) が session / user 両 role
      からの送信を型として表現できる
- [ ] user role からの `message_send` が bad_request にならない
- [ ] `from_label` を解決するための表示名材料が契約上どこかに存在する
      (`PeerInfo.title` 追加を含めて検討)

## TODO

<!-- wip 時のみ -->
