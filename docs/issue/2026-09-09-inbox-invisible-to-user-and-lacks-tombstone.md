---
title: inbox topic が user role へ配送されず、要素の削除印も表現できない
status: open
category: design
created: 2026-09-09T18:58:11+09:00
last_read:
open_entered: 2026-09-13T23:38:00+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered: 2026-09-13T23:33:39+09:00
resolved_entered:
discard_reason: ["統括の誤読で discard していた。kawaz 裁定 (2026-09-13) は a: 人 (webui) は inbox を読める(読んでも配送済みの印は付かない、閲覧)。用途 = セッション宛に送ったがまだ届いていないメッセージをTLに未到達と分かる印付きで出し、届いた(inboxから消えた)ら通常のitemに置き換える。契約: (1) 人の読みは副作用なしの閲覧、をtopicの規約に明記(sessionの読みは配送)、(2) 削除(配送済み/失効/溢れ)をelementの印として流す。契約minor Aに同梱。"]
pending_reason:
close_reason:
blocked_by:
origin: ccmsg (webui スライス 6 での実機観測)
---

# inbox topic が user role へ配送されず、要素の削除印も表現できない

## 概要

`inbox` topic の契約と実装に 2 つの穴がある (ccmsg-webui スライス 6 で実機観測)。

**(1) user role への配送経路が世代 2 に存在しない**

`TOPIC_ATTRIBUTES.inbox.roles` は `["session","user"]` だが、daemon
(`delivery.ts`) の snapshot は接続の sid で引き、sid の無い user 接続は
`[]` を返す。配送の push も `publish(INBOX, …, to)` で宛先 sid の接続に
絞られる。結果、人 (webui) が `topic_subscribe inbox` すると ok は返るが
snapshot も delta も来ない。`peers` 行にも未配送件数は無い。人が「ある
セッション宛の未配送」を見る経路が世代 2 に存在しない。

**kawaz 裁定 (2026-09-13)**: 人 (webui) は inbox を読める。ただし人の読みは
**副作用なしの閲覧** (読んでも配送済みの印は付かない)。session の読みは
これまで通り配送 (読むと配送済みになる)。用途は「セッション宛に送ったが
まだ届いていないメッセージを、TL に未到達と分かる印付きで出し、届いた
(inbox から消えた) ら通常の item に置き換える」こと。この非対称
(人=閲覧 / session=配送) を topic の規約に明記する。

**(2) element 粒度なのに削除印を運ぶ場所が schema に無い**

`inbox` は `element` 粒度 (削除は「印を付けた要素として届く」) だが
`InboxMessage` の schema に削除印 (`deleted: true` / `tombstone`) を書く
場所が無く、配送済みで消えた要素を購読側が畳めない。`kv` は tombstone を
持つので同じ形を `inbox` にも置くか、`inbox` を `per_instance_whole` に
変えるか。

webui は現状「この画面から送って未配送の 1 通」だけをページのメモリに
持つ回避をしている。

## 背景

ccmsg-webui のスライス 6 実装中に、webui (user role 接続) から
`topic_subscribe inbox` した際に何も届かないことを実機で観測した。
`delivery.ts` の実装を読み、sid ベースの絞り込みが原因と特定した。
また `InboxMessage` schema を確認したが削除印フィールドが無く、配送済み
要素の削除を購読側で反映する手段が無いことも確認した。

## 受け入れ条件

- [ ] topic の規約に「人の読みは副作用なしの閲覧、session の読みは配送」
      という非対称を明記する
- [ ] `InboxMessage` (element) に削除印を追加し、配送済み / 失効 / 溢れ
      による削除を element の印として流せるようにする
- [ ] 決定を契約書 (TOPIC_ATTRIBUTES / schema) に反映し、daemon 実装
      (`delivery.ts`) と整合させる
- [ ] 契約 minor A に同梱する
