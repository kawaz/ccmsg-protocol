---
title: topic の差分粒度を TOPIC_ATTRIBUTES の属性として契約側に持たせる
status: open
category: design
created: 2026-09-08T13:00:21+09:00
last_read:
open_entered: 2026-09-08T13:00:21+09:00
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

# topic の差分粒度を TOPIC_ATTRIBUTES の属性として契約側に持たせる

## 概要

topic の差分粒度 (全量置換 / instance ごとの全量置換 / 要素の追加・更新 / 追記 / event=保持なし) を `TOPIC_ATTRIBUTES` の属性として契約側に持たせる。

## 背景

現状は daemon v2 (kawaz/ccmsg `src/topics/granularity.ts`) がローカル表を持っており、契約と 2 箇所になっている。契約に載れば webui も同じ表で snapshot / delta の合成規則を導ける。`notify` は event 粒度 (契約 notify.ts の「snapshot するものは無い」に対応)、`kv:<ns>` は要素の追加・更新。

## 受け入れ条件

- [ ] `TOPIC_ATTRIBUTES` (または相当の契約側定義) に各 topic の差分粒度属性が追加されている
- [ ] daemon v2 (`src/topics/granularity.ts`) が契約側の定義を参照する形に揃えられる、または重複表が撤去される
- [ ] webui が同じ表から snapshot / delta の合成規則を導ける
