# DR-0003: 接続直後に通るのは `hello.*` だけで、identity は挨拶が束縛する

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

WebSocket 接続は誰からでも張れる。認可の入力 (role、`sid`) は接続そのものからは分からないので、identity が決まる前に op を受け付けると、属性表を読む相手が居ない状態で実行することになる。

## Decision

- 属性表の `needs_hello` が「挨拶で決まった identity が要るか」を op ごとに述べる。WebSocket 上で挨拶前に通るのは `hello.*` だけで、それ以外は `hello_required`
- 挨拶は role ごとに分かれる: `hello.session` / `hello.user` / `hello.instance`。挨拶が role を決め、`session` なら `sid` を束縛する。以後その接続の要求はこの identity で dispatch される
- 名乗らない呼び手に答える物は無い。instance がそこに居ること自体は接続が成立した時点で分かっているので、到達確認のための無名 op も要らない
- HTTP で運ぶ 4 つの `auth.*` は接続が存在する前に答えるので `needs_hello: false`。挨拶を省いてよいのではなく、送るべき接続が無い

## Alternatives Considered

- 案 A: 挨拶を 1 つにし、role を引数で受ける
  - 不採用理由: role ごとに要る引数と返す物が違う (session は素性、instance は mesh の claim と単回鍵、user は認証の期限)。1 つの schema に畳むと、どの role でどのフィールドが要るかが schema の外の約束になる
- 案 B: 挨拶前でも読み取り専用の op は通す
  - 不採用理由: 何を返してよいかは role と scope が決めるので、identity の無い呼び手に対しては「読み取り専用かどうか」だけでは答えを絞れない
- 案 C: identity を接続ごとでなく要求ごとに載せる
  - 不採用理由: 接続を跨がない値を毎フレーム運ぶことになり、転送時の `caller` (別 instance が名乗る identity) と線上で見分けが付かなくなる

## Consequences

- 挨拶の応答が、その接続で以後使える capability と instance の素性を伝える唯一の機会になる
- 転送された要求は接続の挨拶を持たないので、identity は封筒の `caller` が運ぶ (DR-0019)

## 関連

- [DR-0004](DR-0004-op-attribute-table.md) — `needs_hello` を含む属性表
- [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) — 転送された要求の identity
- `docs/DESIGN.md` §Planes, §The op attribute table
