# DR-0009: 共有 kv が約束するのは namespace 内の key の一意性だけ

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

client 同士が小さな値を共有したい (人が付けた印、画面の状態、設定の類)。契約が値の意味まで持てば、書き手と読み手の間の取り決めが契約の版に縛られ、値を 1 つ増やすたびに契約が動く。

## Decision

- control 面に名前空間付きの小さな store を置く (`kv.read` / `kv.write` / `kv.delete`)。契約が約束するのは **namespace の中で key が一意であること** だけ。値は任意の JSON で、意味は書き手と読み手のもの
- この store の op は control で唯一 `locality: any_instance`。値は 1 つの instance ではなく mesh が持つので、聞かれた instance が答えてよい。instance 間の複製は daemon の仕事で、食い違いは **後の `updated_at` が勝つ**。write が自分の `updated_at` を述べられるのは、instance が届かない間に書かれた値が、後から実際より新しいふりをせずに合流できるようにするため
- `kv:<ns>` topic が、ある client の保存を他の client にその場で見せる。snapshot は namespace の全 entry、以後は変わった entry で、**削除は `deleted: true` の entry** として運ぶ
- namespace は topic 名の一部になるので識別子に限る。key は人が打った文字を持ちうるので、長さと制御文字の排除だけで縛る

## Alternatives Considered

- 案 A: 値に型を持たせる
  - 不採用理由: 値の意味は書き手と読み手の間の話で、契約の責務ではない。型を持てば用途が増えるたびに契約の版が動く
- 案 B: `locality: owner_instance` にする
  - 不採用理由: 値に持ち主の instance を決めることになり、その instance が落ちれば読めなくなる。mesh が持つ値として扱えば、聞けた instance が答える
- 案 C: 削除を entry の不在で表す
  - 不採用理由: 変化の一覧における不在は何も述べない ([DR-0005](DR-0005-observation-is-snapshot-plus-delta.md))
- 案 D: key も識別子に限る
  - 不採用理由: key は人が打った文字を持つ用途がある。topic 名に載るのは namespace だけなので、縛る理由があるのも namespace だけ

## Consequences

- 競合は後勝ちで解決するので、同じ key を複数の client が同時に書く用途には向かない
- 人が読み書きできる場所なので、認証に関わる値はここに置かない ([DR-0020](DR-0020-auth-shape-on-the-wire.md))

## 関連

- `docs/DESIGN.md` §The shared key-value store
