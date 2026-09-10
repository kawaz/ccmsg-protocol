---
title: 境界の無い transcript_items_read は末尾を返す既定にするか
status: open
category: design
created: 2026-09-11T00:20:48+09:00
last_read:
open_entered: 2026-09-11T00:20:48+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: webui (Timeline v0.3.0)
---

# 境界の無い transcript_items_read は末尾を返す既定にするか

## 概要

契約 1.14.0 の `transcript_items_read` は「下限があれば先頭から `next`、上限だけなら末尾から
`prev`、境界が無ければ transcript 全体を始まりから」という既定になっている。Timeline (webui
v0.3.0) の最初の読みは末尾が欲しいので、上限に `until_at = Number.MAX_SAFE_INTEGER` を置く
細工で「上限だけ」に見せて `prev` 側の挙動を引き出している。

境界の無い読みの既定を「末尾から limit 件 + `prev`」にする (= `transcript_read` が `before`
無指定で末尾を返すのと同じ) か、明示的な終端の言い方 (`until: "end"` 等) を持つかを決めて
minor で契約に入れる。

## 背景

利用側 (webui Timeline) が「境界なし = 先頭から」という契約の既定と噛み合わず、
`until_at = Number.MAX_SAFE_INTEGER` という sentinel 値の細工で回避している。この細工は
契約の意図を読み取りづらくし、他の利用者が同じ初回読みをする度に同じ回避策を再発明する
リスクがある。`transcript_read` は既に「`before` 無指定で末尾を返す」既定を持っており、
`transcript_items_read` だけ挙動が異なる非対称がある。

決めた後は daemon (`src/sessions/items.ts` の `backwards()`) と webui (`src/timeline/items-view.ts`
の初回読み) を追従させる。

## 受け入れ条件

- [ ] 境界の無い `transcript_items_read` の既定挙動 (末尾から limit 件 + `prev`、または明示
      終端の言い方) を決めて契約 DESIGN / SCHEMA に minor で反映する
- [ ] daemon 側 (`src/sessions/items.ts` の `backwards()`) を新既定に追従させる
- [ ] webui 側 (`src/timeline/items-view.ts` の初回読み) から `until_at = Number.MAX_SAFE_INTEGER`
      の sentinel 細工を除去し、新しい言い方に置き換える
