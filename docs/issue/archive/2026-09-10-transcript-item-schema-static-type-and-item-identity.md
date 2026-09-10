---
title: TranscriptItem の Static 型消失と item 同一性 (uuid 重複) 不備
status: resolved
category: bug
created: 2026-09-10T23:01:08+09:00
last_read:
open_entered: 2026-09-10T23:01:08+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered: 2026-09-10T23:17:28+09:00
discard_reason:
pending_reason:
close_reason: ["done:契約 1.13.0 で対応。item() を generic 化して TObject を返すようにし TranscriptItem の Static が潰れなくなった (TOOL_ITEMS の TSchema[] 注釈も外した)","done:item に id (= <uuid>:<index>) を追加し result_item/parent_item を id で張る形にした。uuid は元 record の参照として残す","done:source (offset/bytes) を必須化し USE_FIELDS のコメントを「リンク先が範囲外なのは正常」に直した","daemon 側の自前 Item 型の置き換えは daemon の作業として残る"]
blocked_by:
origin: ccmsg (daemon v0.4.0 dump のアイテム型化実装)
---

# TranscriptItem の Static 型消失と item 同一性 (uuid 重複) 不備

## 概要

daemon v0.4.0 (dump のアイテム型化) の実装で契約 1.12.0 の `TranscriptItem` に 2 つの不備が見つかった。

1. `src/control/dump.ts` の `item()` ヘルパの戻りが `TSchema` のため `Static<typeof TranscriptItem>` が `unknown` に潰れ、利用側が `item.uuid` すら型で書けない。daemon は暫定で自前の `Item` 型を持ち、schema 側を正本としてテストで `validationErrors` に通している。`item()` の戻り型を保つ (generic で `TObject` を返す) 修正で daemon の `Item` は消せる。
2. 1 record (assistant 1 行) が複数 item (thinking + tool use ×N + text) になると、契約が「`uuid` は record の id」と定めているため item の `uuid` が重複し、`result_item` / `parent_item` のリンクが uuid だけでは一意に解決できない (tool は `tool_use_id` で対が取れるので実害は出ていないが、表示コンポーネントを書く段で判断が要る)。候補: item に `id` (= `<uuid>:<block index>`) を足しリンクは `id` で張る / `uuid` は record 参照として残す。

あわせて `USE_FIELDS` のコメント「範囲外に落ちた result を持つ use は `result_item` を持たない」は daemon の実装 (file 全体を分類してから範囲で切るので、範囲外へのリンクは残る = 設計 §7「リンク先が dump に入っていないのは正常」) と食い違うので、契約の文言を実装に合わせる。

## 背景

daemon 側で契約 1.12.0 の `TranscriptItem` を使って dump のアイテム型化を実装した際に発覚。詳細は daemon リポの実装コード (`src/transcript/items/item.ts` 相当) とテストの `validationErrors` 運用を参照。

## 受け入れ条件

- [ ] 契約 minor で (1) `item()` ヘルパの戻り型を `TObject` を保つ形 (generic) に修正
- [ ] 契約 minor で (2) item 同一性の方針を決め、必要なら `id` フィールドを追加、リンク方式を確定
- [ ] `USE_FIELDS` のコメントを daemon の実装挙動 (範囲外へのリンクは残る) に合わせて修正
- [ ] daemon の `src/transcript/items/item.ts` (自前 `Item` 型) を契約型に置き換え
