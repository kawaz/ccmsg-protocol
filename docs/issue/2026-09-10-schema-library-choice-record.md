---
title: TypeBox (JSON Schema) 採用根拠が記録されていない
status: open
category: design
created: 2026-09-10T12:16:38+09:00
last_read:
open_entered: 2026-09-10T12:16:38+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: 自リポ TODO
---

# TypeBox (JSON Schema) 採用根拠が記録されていない

## 概要

契約の schema / 検証器に TypeBox (JSON Schema) を選んだ根拠が記録されていない。最初の skeleton commit で骨格と一緒に入り、DESIGN の要件「契約が実行可能であること = 検証器を伴う」しか残っていない。

## 背景

事後的に振り返ると採用理由は以下の 3 点:

1. JSON Schema そのものとして書けるので TS 以外の実装にも同じ契約を配れる
2. `Static<typeof Schema>` で型と検証器が 1 定義から出る
3. `TypeCompiler` の compile 済み検証器が使える

既知の弱点もある: `maxLength` の数え方が JSON Schema (code point) と TypeBox (UTF-16 code unit) で違う (0.7.0 の `TITLE_MAX_CHARS` で判明)。

論点: zod / valibot / arktype / ajv + 手書き JSON Schema との比較を 1 本の DR (`docs/decisions/` を新設) として残すか、DESIGN の「契約の層」節に理由を 3 行足すだけで足りるか。kawaz r292m69 の問い。

## 受け入れ条件

- [ ] DR を新設するか DESIGN に追記するかを決める
- [ ] 決めた形式で TypeBox 採用理由 (JSON Schema 互換性 / 型と検証器の単一定義 / compile 済み検証器) と既知の弱点 (`maxLength` の数え方の差異) を記録する
