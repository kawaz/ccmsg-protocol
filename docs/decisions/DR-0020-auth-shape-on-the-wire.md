# DR-0020: 人の認証は線上の形だけを契約が持ち、4 つの op は HTTP で運ぶ

- Status: Active
- Date: 2026-09-14

## Context

人の認証には手順がある (passkey の登録と検証、cookie、record の複製、challenge の転送先)。手順を契約にも書けば同じ物が 2 つのリポで綴られ、片方だけが動いた時にどちらが正本か分からなくなる。一方、cookie の読み書きと「接続が成立する前に答えること」は WebSocket の frame にはできない。

## Decision

- 契約が持つのは **線上の形だけ**。手順は daemon リポの判断であり、ここには写さない
- 人の identity を決める 4 つの op (`auth.challenge` / `auth.register` / `auth.assert` / `auth.token.refresh`) は **HTTP で運ぶ**。それでも **属性表には載る** — 認可を表の外で決めないため。carrier が決めるのは運び方だけで、誰が呼べるかは決めない ([DR-0004](DR-0004-op-attribute-table.md))
- 4 つとも `needs_hello: false` で、identity の無い接続から届く (挨拶と同じ扱い)。`request_id` は HTTP の carrier が合成する。提供場所は `<endpoint>auth/*` で、`RegisterClaims.endpoint` が同じ base URL を名指す
- `auth.extend` は WebSocket の op。生きた接続の期限 (挨拶が答えた `auth_expires_at`) を、接続を閉じずに動かす
- `auth.resolve` と `auth.rotate` は instance 間 (`roles: ["instance"]`、`locality: owner_instance`)。発行者にしか答えられない事 — 登録 URL の検査、challenge の消費、token family の rotate — は `to_instance = iss` として転送する。転送される rotate は、受け手が観測した `reason` / `ip` / `user_agent` を運ぶ (人は受け手の接続の向こう側に居て、発行者の側には居ない)。発行者はそれを自分が観測した値と同じく無検査で `last_refresh` に書く
- credential record と token family は `auth.records` topic (`roles: ["instance"]`、element 粒度) で複製する。**共有 kv には載せない** — あれは人が読み書きする場所で、そこに置かれた token は人のセッションそのものになり、書き込まれた credential は新しい入口になる。削除は tombstone の要素として運ぶ
- family が退けた refresh の値は **digest** として `retired` に持ち、各値自身の期限まで保つ。replay の検知は「今提示された物が、かつてここで発行され、もう有効でないか」を問うだけなので、値そのものを配る必要が無い

## Alternatives Considered

- 案 A: 手順まで契約に書く
  - 不採用理由: 同じ手順が 2 リポに綴られ、正本が二重化する。契約は線上の形を述べる物
- 案 B: HTTP で運ぶ op を属性表の外に置く
  - 不採用理由: carrier が認可を決めることになる。roles と scope は他の op と同じ列で持つべき物
- 案 C: record と token を共有 kv に載せる
  - 不採用理由: 人が読み書きできる場所なので、token は読めばセッション、credential は書けば入口になる
- 案 D: 退けた refresh の値そのものを複製する
  - 不採用理由: 生きた secret を instance 間で配って回ることになる。検知に必要なのは同一性の判定だけ

## Consequences

- 認証の手順を変える判断は daemon 側で完結し、線上の形が変わる時だけ契約が動く
- `auth.*` は identity の無い接続から届くので、濫用の勘定 (試行回数) は発行者が持つ ([DR-0021](DR-0021-registration-in-two-halves.md))

## 関連

- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録の 2 経路と発行者の単独判定
- [DR-0029](DR-0029-what-a-credential-is-bound-to.md) — credential が何に縛られるか
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` (手順の正本)
- `docs/DESIGN.md` §Authenticating a person
