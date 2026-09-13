---
title: notify Notification に reply_to (mid) が無く webui が返事の重複表示を消せない
status: resolved
category: design
created: 2026-09-09T18:11:54+09:00
last_read:
open_entered: 2026-09-09T18:11:54+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered: 2026-09-14T00:46:56+09:00
discard_reason:
pending_reason:
close_reason: ["implemented:contract 1.23.0 に notify frame / notify.send args へ reply_to (optional、MessageSendArgs.reply_to と同型) を追加、kind は非採用 (kawaz 裁定 2026-09-13)","implemented:daemon v0.13.0 (ccmsg notify --reply-to)","implemented:webui v0.18.0 (通知から元の item / 未到達の 1 通へ飛ぶ)"]
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

## 裁定 (kawaz 2026-09-13)

`reply_to` (どの item への返事かの鍵) を notify の frame に optional で足す。通知の種別 (`kind`) は持たない。契約 minor A で入れる (locality の改名 any_instance / owner_instance、transcript snapshot の liveness 否定の 1 文、dump の format 引数と同梱)。

## 受け入れ条件

- [x] 上記 3 論点それぞれについて採否を決める (論点1: 採用 / 論点2: 見送り、通知自身の id は持たない / 論点3: 見送り、`kind` は持たない)
- [ ] 採用した設計で webui が transcript 到着後に対応する通知を確実に消せることを確認する

## TODO

<!-- wip 時のみ -->
