---
title: result item without a seen call — parent_item が必須なのに解決できない
status: resolved
category: design
created: 2026-09-10T23:48:41+09:00
last_read:
open_entered: 2026-09-10T23:48:41+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered: 2026-09-11T00:31:14+09:00
discard_reason:
pending_reason:
close_reason: ["done:候補(a)採用、契約1.15.0にRESULT_FIELDS.parent_itemをoptional化しharnessキーparent_tool_use_id(必須)を追加、use側はUSE_FIELDS.tool_use_id(必須)で読み手が結び直す設計とし個別tool_use_idを廃止","daemon側はsystem:unknown退避をやめてparent_tool_use_id経由で型名を復元する追随が必要(未実装)"]
blocked_by:
origin: daemon (ccmsg)
---

# result item without a seen call — parent_item が必須なのに解決できない

## 概要

契約 1.13.0 の `RESULT_FIELDS.parent_item` は必須 ("Always known: a result exists because a did") だが、daemon v0.5.0 の分類器が file の途中から読む場面 (topic `transcript_items:<sid>` の seed 1 MiB より古い呼び出しの結果、resume で前の file に呼び出しがある等) では名指す `id` が存在しない。daemon は捏造も黙殺も避けて record ごと `system:unknown` に落としている (情報は残るが型名を失う)。

## 背景

契約は「result は必ず対応する did (呼び出し) の存在を前提にできる」という不変条件を置いているが、これは file 全体を読める前提に依存している。daemon が部分読み (seed / resume) をする実装である以上、その前提が崩れるケースが実際に発生する。

## 受け入れ条件

- [ ] 契約側で採否を決める
- [ ] 候補 (a): `parent_item` を optional にし、代わりに harness 側のキー `parent_tool_use_id` (必須) を持たせる (読み手は tool_use_id で結び直せる)
- [ ] 候補 (b): 現状維持 (daemon 側で `system:unknown` 退避を許容する設計として明文化)
- [ ] (a) 採用の場合: minor で契約に入れ、daemon は `system:unknown` への退避をやめて `parent_tool_use_id` 経由で型名を復元する
