---
title: transcript:<sid> の snapshot が返ることの意味を契約 DESIGN に明記するか
status: open
category: design
created: 2026-09-10T14:01:24+09:00
last_read:
open_entered: 2026-09-10T14:01:24+09:00
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

# transcript:<sid> の snapshot が返ることの意味を契約 DESIGN に明記するか

## 概要

`transcript:<sid>` topic の snapshot が返ることの意味を契約の DESIGN に明記するか決める。

## 背景

daemon (kawaz/ccmsg v0.2.12、DESIGN-ja §5.4 / §6.2) は announce 済みパスと `projects/**/<sid>.jsonl` の walk の 2 経路で同じファイルに解決し、追記が二度と来ない過去セッションにも `size` だけの snapshot を返すようになった。契約 DESIGN は現状 snapshot の有無に「稼働中か」の含意を持たせていないが、読み手 (webui) が誤読しうる。

次の 1 文を候補にする:

> `transcript:<sid>` の snapshot は購読開始時点のファイル末尾 (`size`) を述べる。snapshot が返ることはセッションが稼働中であることを意味せず、追記が二度と来ないファイルにも返る。購読者はこの size を `transcript_read` の起点として使ってよい。

## 受け入れ条件

- [ ] 契約 DESIGN (日英) にこの含意の否定を載せるか、daemon 側の記述で足りるとして close するかを決める
- [ ] 載せる場合は DESIGN-ja / DESIGN-en 両方に反映する
