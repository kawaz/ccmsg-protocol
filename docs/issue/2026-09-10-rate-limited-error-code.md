---
title: 送出側 backpressure 用の rate_limited error code を契約に追加
status: open
category: design
created: 2026-09-10T21:44:12+09:00
last_read:
open_entered: 2026-09-10T21:44:12+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: daemon リポ (v0.3.4 の送出側上限実装)
---

# 送出側 backpressure 用の rate_limited error code を契約に追加

## 概要

daemon v0.3.4 が送出側の上限 (WS 終端ごとの flush 周期付き queue: 現在値 topic は畳む、出来事 topic は上限 256 で backpressure) を入れたが、契約には「引数は正しいが読み手が追いつかず今は受け取れない」を表す error code が無い。`notify_send` / `say_post` の拒否は暫定的に `internal_error` + msg で表現している (`message_send` は inbox 保持の `{delivered:false, reason:"throttled"}` で表現できており契約変更は不要)。

契約 minor で `rate_limited` (または `overloaded`) を error code に追加し、意味 (一時的である、再送で通る可能性がある、引数の誤りではない) を DESIGN に明記する。daemon 側は code が契約に入り次第、暫定の `internal_error` から差し替える。

## 背景

- daemon v0.3.4 で送出側 backpressure (現在値 topic の畳み込み、出来事 topic の上限 256) を実装した
- 現行契約には `internal_error` はあるが、「引数は正しいが今は受け付けられない (一時的)」を表す code が無いため、`notify_send` / `say_post` の queue full 時に意味的に不正確な `internal_error` を暫定使用している
- `message_send` は inbox 保持の仕組みがあり `{delivered:false, reason:"throttled"}` で表現できるため対象外

## 受け入れ条件

- [ ] 契約 (ccmsg-protocol) に `rate_limited` (or `overloaded`) error code を追加、minor bump
- [ ] DESIGN に意味 (一時的・再送可能・引数エラーではない) を明記
- [ ] daemon 側の `notify_send` / `say_post` 拒否を新 code に差し替え (daemon リポ側の追随 issue)

## TODO

<!-- wip 時のみ -->
