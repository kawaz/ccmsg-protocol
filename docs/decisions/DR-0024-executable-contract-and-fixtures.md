# DR-0024: 契約は実行可能で、線上の代表例 (fixtures) も契約が持つ

- Status: Active
- Date: 2026-09-14

## Context

このリポが持つのは 1 つの物 — 線上の契約 — で、daemon と web UI の双方がそれに照らす。型だけの契約にすると、実際に検査するのは各実装の手書きテストになり、2 つは別々に育って食い違う。実装が期待する JSON を自分の側に写して持つ場合も同じで、契約が動いた時に写しは黙って古くなる。

## Decision

- 契約は **型だけでなく実行可能**。schema と、そこから compile した validator を持ち、daemon と web UI は同じ物に照らす
- 全ての op が `OP_SCHEMAS` に要求と応答を持ち、全ての topic が `TOPIC_SCHEMAS` に frame を持つ。`OP_SCHEMAS` は `Record<OpName, OpSchemas>` と型付けられているので、属性表に op を足して schema を書かなければ型検査が落ちる。topic は属性表と双方向に照合する
- `src/fixtures/` が、全ての op の要求と応答、全ての topic の frame について、**実際の線上の代表的な JSON** を持ち、`@ccmsg/protocol/fixtures` として export する。`.` からは辿れない — 実装の製品コードが例を持つ理由は無いので、読むのはテストだけ
- 契約自身のテストが `OP_NAMES` と `TOPIC_SCHEMAS` を歩いて全部を schema に通すので、op や frame を変えれば fixture も一緒に落ちる
- 実装 (daemon、web UI) のテストはこの fixtures を読む

## Alternatives Considered

- 案 A: 型だけの契約にする
  - 不採用理由: 検査が各実装の手書きテストに残り、2 つは別々に育つ。契約は「両者が同じ物に照らす」ためにある
- 案 B: 期待する JSON を各実装にコピーする
  - 不採用理由: 契約が動いた時に写しは黙って古くなり、テストが述べるのは「実装が自分の写しと一致する」だけになる
- 案 C: fixtures を `.` から export する
  - 不採用理由: 製品コードが例を持てるようになる。例が本番の経路に紛れ込む余地を残さない

## Consequences

- op を 1 つ足すには、属性表・schema・fixture の 3 つが揃う必要がある (欠けると型検査かテストが落ちる)
- 実装側のテストが契約と一致していることは、契約との一致そのものを意味する

## 関連

- [DR-0004](DR-0004-op-attribute-table.md) — 属性表と schema の照合
- ccmsg (daemon) `docs/decisions/DR-0002-contract-holds-the-vocabulary.md`
- `docs/DESIGN.md` §Domain, §What the contract holds, §The fixtures the contract holds
