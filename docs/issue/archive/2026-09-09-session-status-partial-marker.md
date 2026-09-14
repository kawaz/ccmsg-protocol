---
title: SessionStatusSnapshot に fold の可視範囲を示す partial マーカーを足す
status: discarded
category: design
created: 2026-09-09T02:32:31+09:00
last_read:
open_entered: 2026-09-09T02:32:31+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered: 2026-09-14T11:54:43+09:00
resolved_entered:
discard_reason: ["discarded: 契約に印(folded_from/partial)は載せない。kawaz裁定(2026-09-14): 途中から畳んで不完全な状態を作ること自体をやめ、daemonがtranscriptを頭から畳む(性能はversion付きセッション毎キャッシュで担保)。実装はdaemon issue fold-from-head-with-versioned-cache"]
pending_reason:
close_reason:
blocked_by:
origin:
---

# SessionStatusSnapshot に fold の可視範囲を示す partial マーカーを足す

## 概要

daemon v2 の fold は transcript の末尾 1 MiB から seed するため、一度きりの宣言で
累積する `external_files` / `teammates` / `background` / `workflows` / `agent_tree`
は、その宣言が窓から落ちると消える。契約上「窓外だった」と「宣言が無かった」が
どちらも空リストで区別できない。

## 背景

実害は `external_files`: 長いセッション序盤に読んだファイルの `external` 面が
`path_forbidden` になる (= 宣言が末尾 1 MiB の外に押し出されたことで、宣言自体が
無かったのと区別できず読み込み許可が失われる)。

## 受け入れ条件

- [ ] `SessionStatusSnapshot` に fold の可視範囲を示す値 (読み始めた transcript
      の byte offset、または `partial: boolean`) を optional で足す案を検討する
- [ ] 採否を決める (足すなら仕様に反映、足さないなら不採用理由を記録)
