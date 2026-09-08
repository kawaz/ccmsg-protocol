---
title: PeersFrame に instances[] を追加し mesh 断絶を purely topic 経由で購読可能にする
status: open
category: design
created: 2026-09-09T01:37:55+09:00
last_read:
open_entered: 2026-09-09T01:37:55+09:00
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

# PeersFrame に instances[] を追加し mesh 断絶を purely topic 経由で購読可能にする

## 概要

`PeersFrame` の payload は `{peers, last_live}` のみで、`InstanceInfo`
(id / host / reachable) の一覧を載せる場所が無い。mesh の断絶 (daemon 設計
§7.5「断絶は hello の応答の instances[] と peers topic に現れる」) を
購読者が知る経路が hello 応答だけになっている。

`PeersFrame.instances: InstanceInfo[]` (per_instance_whole の各 frame に
発生元 instance の見た一覧) の追加を検討。

## 背景

daemon 設計 §7.5 は「断絶は hello の応答の instances[] と peers topic に
現れる」と書いているが、実際の `PeersFrame` payload には instances 相当の
フィールドが無く、topic 購読だけでは断絶を検知できない。hello 応答を都度
叩かないと知れない設計は topic 購読の利点を損なう。

## 受け入れ条件

- [ ] `PeersFrame` payload に instances (または同等の断絶検知手段) を
      追加するか、追加しない設計判断を明記する
- [ ] 追加する場合、per_instance_whole の意味論 (発生元 instance が見た
      一覧であること) を仕様に明記する
