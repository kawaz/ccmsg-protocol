---
title: say-unread-on-wire
status: open
category: design
created: 2026-09-08T23:15:03+09:00
last_read:
open_entered: 2026-09-08T23:15:03+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: ccmsg
---

# say-unread-on-wire

## 概要

`say_post` が立てて `say_mark_read` が消す「このセッションが喋って未読」のマークを運ぶフィールドが契約に無い (`PeerInfo` / `SessionStatusSnapshot` のどちらにも無い)。daemon v2 は instance 内 (`Notify#unread()`) にしか持てず、webui が未読表示を出せない。

## 背景

`PeerInfo.say_unread_at` (optional Timestamp) 等の置き場を決める必要がある。

## 受け入れ条件

- [ ] `say_post` / `say_mark_read` の未読状態を運ぶフィールドの置き場所 (`PeerInfo` か `SessionStatusSnapshot` か、あるいは別構造) を決定する
- [ ] 決定した契約フィールドを protocol 定義に反映する
- [ ] daemon v2 / webui がそのフィールド経由で未読表示を出せることを確認する
