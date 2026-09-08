---
title: peer 忙しさ属性と LlmRequestInfo.main 判定規則の契約の穴
status: open
category: design
created: 2026-09-08T22:48:05+09:00
last_read:
open_entered: 2026-09-08T22:48:05+09:00
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

# peer 忙しさ属性と LlmRequestInfo.main 判定規則の契約の穴

## 概要

daemon v2 の gateway 取り込み (kawaz/ccmsg `src/upstream/`) で判明した契約の穴が 2 つある。

1. `PeerInfo` に「忙しさ」の欄が無い。daemon 設計 §5.2 は忙しさを行の属性 (分類ではない) と
   定めるが、載せる欄が契約に無い。案: `gateway_active_at` (最後に推論が走った時刻、optional、
   gateway 未設定なら欠ける)。
2. `LlmRequestInfo.main` は「instance が決める」とだけあり判定規則が無い。daemon は旧実装の
   規則 (origin が言えばそれ、無ければ 2 セッション以上で見えた prefix はサブエージェント + 最初に
   使った系列が勝ち、全部共有なら最新) を採ったので、契約に規則を書くか、`main` を契約から外して
   client 側の解釈に委ねるかを決める。

## 背景

daemon v2 の実装過程で、既存の契約 (protocol) に対して実装側が独自の解釈・補完を行った箇所が
見つかった。契約の記述が実装判断を縛れていない状態。

他の open issue (internal-failure-error-code / topic-granularity-attribute /
message-sender-identity) と合わせて次の minor でまとめて処理する候補。

## 受け入れ条件

- [ ] `PeerInfo` の忙しさ属性 (`gateway_active_at` 案含む) を契約に追加するか却下するかを決定
- [ ] `LlmRequestInfo.main` の判定規則を契約に明記するか、契約から外すかを決定
- [ ] 決定内容を他の関連 open issue とあわせて次の minor に反映
