# DR-0019: mesh は専用 op を持たず、転送された要求は宛先で認可し直す

- Status: Active
- Date: 2026-09-14

## Context

instance 同士が要求を渡し合う。渡す経路に専用の op を作れば、宛先ではその op を認可することになり、元の op の認可条件が 2 枚目の表として複製される。また、転送元が認可を済ませているという前提を宛先が信じるなら、宛先の表は読まれない。

## Decision

- **mesh は自分の op を持たない**。入口は `role: "instance"` の `hello.instance` だけ (その `mesh` フィールドが claim と単回鍵の在処)。以後に渡るのは同じ op が封筒の mesh フィールド (`to_instance` / `from_instance` / `hops` / `caller`) を纏った物
- 認証は接続時に 1 度。そこで比べる `iss` / `aud` は **endpoint** で、信頼は URL に根を持ち他のどこにも持たない。peer が名乗る id は同じ挨拶で運ばれ、証明が通ったことでその挨拶の内容が信頼される。受け手は認証済みの **endpoint から id への対応付け**を保持し、後の `to_instance` はそれを通してダイヤルされる
- **1 つの id は 1 つの link に束縛される**。既に別の endpoint に束縛された id を名乗る挨拶は、その挨拶の方を閉じ、立っている束縛は残す
- 転送された要求は宛先で **全段階を認可し直す**。封筒の `caller` (role と、role が `session` なら `sid`) が dispatch する identity で、転送元の判定は持ち越さない。信じるのは claim そのものだけ — 転送元は認証済みの peer なので、誰が呼んだかについてのその言葉は信じる (1 つの deployment の中でだけ成り立つ前提)。`caller` を名乗らない転送は、届いた接続の role (`instance`) として dispatch され、`owner_instance` の op は属性表がそのまま `forbidden` と答える
- 同じ instance を 2 度通る要求は、封筒の `hops` で落とす。回し続けない
- 切れた link は購読からも見える。`instances` topic が送り手から見た mesh の姿を運び、各 entry が `reachable` を持つ。到達性は **送り手の位置から**述べられるので、2 つの instance が 1 つの peer について食い違うことは障害ではない

## Alternatives Considered

- 案 A: `mesh.*` の専用 op を作る
  - 不採用理由: 宛先ではその op を認可することになり、元の op の roles と capability が 2 枚目の表として複製される
- 案 B: 転送元の認可結果を持ち回る
  - 不採用理由: 宛先の属性表が読まれなくなる。認可の正本が経路の途中に移る
- 案 C: ループを hop 数の上限だけで防ぐ
  - 不採用理由: 上限に達するまで回る。通った instance を並べておけば、2 度目を落とすのは即座に決まる
- 案 D: 到達性を mesh 全体の合意として述べる
  - 不採用理由: 到達性は位置に依存する事実で、合意にすると片側から見えている link を「無い」と述べることになる

## Consequences

- op を足しても mesh は動かない。転送できるかは属性表の `locality` が決める ([DR-0004](DR-0004-op-attribute-table.md))
- 転送元を信じる範囲が 1 つの deployment に限られるので、信頼できない instance を mesh に入れる運用は成り立たない

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — id と endpoint の分離
- ccmsg (daemon) `docs/decisions/DR-0014-mesh-has-no-ops-of-its-own.md` (mesh peer 認証の手順の正本)
- `docs/DESIGN.md` §Instances and mesh
