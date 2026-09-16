# DR-0006: メッセージは 1 つの sid 宛、送り主は sid とは限らない

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

メッセージの宛先をどう名指すか、そして返し方をどこに書くか。会話の記録はセッション自身の transcript に既にあるので、やり取りの置き場を messaging 側にもう 1 つ作れば、同じ会話が 2 箇所に溜まる。また、送り主は必ずしもセッションではない — web UI に居る人には `sid` が無い。

## Decision

- メッセージは **1 つの sid 宛**。会話の記録はセッション自身の transcript であって、messaging は集約の場を持たない
- 返路も本文のテキストでは運ばない。答えるとは配送 frame の `from` へ送ることで、契約が述べるのはその構造だけ
- `message.send` は session role と user role の両方が呼べる。そこで `from` は `Sender = Sid | "user"` で、**人からであることは literal で綴る**。フィールドの不在で表さないのは、「人が送った」と「セッションが送ったが id が落ちた」を読み分けるため。`user` へは何も送り返せないので、人へどう届けるかは instance が決める
- notification は答えた `mid` を `reply_to` で名乗れる。1 つの答えは人に 2 度届く (通知として、そして後から届くセッション自身の transcript として) ので、同じ物だと言う鍵が要る。述べるのは「何に答えたか」だけで、**種別は持たない**

## Alternatives Considered

- 案 A: 宛先を集合にし、複数のセッションが集まる会話の場を持つ
  - 不採用理由: 会話の記録は transcript が既に持っている。場を持てば同じ会話が 2 箇所に溜まり、どちらが記録かを client が決めることになる
- 案 B: `from` を省略可能にし、不在で「人から」を表す
  - 不採用理由: id が落ちた場合と区別できない。全ての sid は有効な送り主のままなので、不在は曖昧にしかならない
- 案 C: 返路を本文のテキスト (宛先の書き方の説明) として運ぶ
  - 不採用理由: 構造として読めないので、client は本文を解釈することになる。frame を読める受け手にとって `from` で足りる
- 案 D: notification に種別 (返信 / 通知 / 警告 …) を持たせる
  - 不採用理由: 通知は出所によらず 1 種類の物で、種別は描き分けの理由として読まれてしまう

## Consequences

- 直送経路のように frame を読めない受け手には、`mid` と `from` を本文に書くしかない。その文言は契約が持つ ([DR-0008](DR-0008-wording-of-a-direct-delivery.md))
- `user` 宛の経路が無いので、人への到達は instance の実装が決める

## 関連

- [DR-0007](DR-0007-undelivered-waits-in-the-inbox.md) — 渡らなかったメッセージ
- ccmsg (daemon) `docs/decisions/DR-0008-direct-route-first-inbox-persisted.md`
- `docs/DESIGN.md` §Domain
