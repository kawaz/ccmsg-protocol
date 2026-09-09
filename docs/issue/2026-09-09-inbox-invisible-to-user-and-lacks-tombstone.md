---
title: inbox topic が user role へ配送されず、要素の削除印も表現できない
status: open
category: design
created: 2026-09-09T18:58:11+09:00
last_read:
open_entered: 2026-09-09T18:58:11+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
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

論点: `inbox` に `scope: "role"` を付け、user は全 sid の未配送 (`sid`
付き) を見る / session は自分宛だけ、と契約に書くか。

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

- [ ] `inbox` topic の user role 配送経路について契約上の扱いを決定する
      (`scope: "role"` を追加するか、別の設計を採るか)
- [ ] `InboxMessage` schema に削除印 (tombstone 相当) を追加するか、
      `inbox` の粒度を `per_instance_whole` に変更するか決定する
- [ ] 決定を契約書 (TOPIC_ATTRIBUTES / schema) に反映し、daemon 実装
      (`delivery.ts`) と整合させる
