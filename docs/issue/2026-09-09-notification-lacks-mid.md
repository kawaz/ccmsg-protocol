---
title: notify Notification に reply_to (mid) が無く webui が返事の重複表示を消せない
status: open
category: design
created: 2026-09-09T18:11:54+09:00
last_read:
open_entered: 2026-09-09T18:11:54+09:00
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

# notify Notification に reply_to (mid) が無く webui が返事の重複表示を消せない

## 概要

`notify` topic の `Notification { sid, sid_label, text, sent_at }` に、それがどのメッセージへの返事か (`reply_to` の mid) や通知自身の id が無い。

## 背景

webui (ccmsg-webui スライス 4) は人宛の返事を「transcript の `ccmsg reply <mid>` の tool_use (正本)」と「`notify` の一時表示」の両方で描くが、両者を結ぶ鍵が無いため transcript が追いついても通知側を消せず、同じ返事が並ぶ瞬間がある。daemon 側は `ccmsg reply <mid> <text>` (`--to` 無し) を `notify_send { text }` に落としており、mid はそこで捨てられている。

論点:

1. `NotifySendArgs` / `Notification` に任意フィールド `reply_to: Mid` を足す (同一世代内の追加 = minor)
2. 通知自身に `mid` を振るか (event 粒度で保持しないものに id が要るか)
3. `say_post` 由来の通知との区別 (`kind`) を持たせるか

## 受け入れ条件

- [ ] 上記 3 論点それぞれについて採否を決める
- [ ] 採用した設計で webui が transcript 到着後に対応する通知を確実に消せることを確認する

## TODO

<!-- wip 時のみ -->
