# DR-0018: 識別は `instance` id、ダイヤル先は `endpoint` URL

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

instance を指す値は 2 つの仕事をする。「同じ instance かどうか」を言うことと、「どこへ繋ぐか・TLS で何を検証するか」を言うこと。1 つの値で両方をやると、instance が引っ越した時に、それを鍵にしている物 (`mid`、store の key、record や token の発行者) が全部指す先を失う。

## Decision

- **identity は `instance` id**。instance が自分で 1 度発行する不透明な乱数 (16 bytes の hex) で、移転しても変わらない
- **ダイヤル先と TLS の検証先は `endpoint` URL**。instance が公開する base URL (`http(s)://<host>[/<prefix>]/`、末尾スラッシュ必須、query と fragment なし)。1 つの origin を複数の instance が共有しうるので、比較は origin ではなく **path まで含めた URL 全体**。末尾スラッシュを必須にするのは `/ccmsg` と `/ccmsg/` を 1 つの instance の 2 通りの綴りにしないため
- 各経路は endpoint の **下**にあり、endpoint の一部ではない: `<endpoint>ws`、`<endpoint>mesh/*`、`<endpoint>auth/*`、`<endpoint>webhook/*`。どれも endpoint 自身の scheme を保ち、`ws(s)://` に書き換えない (WebSocket は upgrade する HTTP 要求として始まるので、URL の綴りは 1 つで足りる)。こう切ることで、transport が `/ws` から動いても「instance がどこに居るか」の値は変わらない
- id を鍵にする物は endpoint の変更を跨いで生き残る
- 挨拶は、答えた instance の id と endpoint、そして見えている instance 群 (それぞれ id・endpoint・到達性) を返す。entry の `id` が任意なのは、その peer との handshake が済むまで分からないから (設定された endpoint は何かが答える前から分かっており、link が落ちた peer は一覧から最後に消える)。`endpoint` はどの行でも、答えた instance 自身の分でも任意 (mesh に加わらない instance は peer に渡す URL を持たない)
- 応答は `terminal_gateway` も運ぶ (instance のセッションが動く機械の前に立つ物がある場合の、人が端末を開く base URL。`<terminal_gateway>/sessions/<terminal_id>`)。届かない instance では不在で、これは `capabilities` に `terminal` が無いのと同じ条件

## Alternatives Considered

- 案 A: endpoint を identity にする (id を持たない)
  - 不採用理由: 移転で `mid` も store の key も token の発行者も指す先を失う
- 案 B: endpoint の比較を origin で行う
  - 不採用理由: 1 つの origin に複数の instance が同居できなくなる
- 案 C: 末尾スラッシュを任意にする
  - 不採用理由: 同じ instance に 2 通りの綴りができ、比較が一致しない
- 案 D: WebSocket の URL を別の値として持つ
  - 不採用理由: transport が `/ws` から動くたびに「どこに居るか」の値が変わる。経路を endpoint の下に置けば、動くのは経路だけで済む

## Consequences

- 認証と信頼は endpoint に根を持ち、id は認証された対応付けを通してのみダイヤルされる ([DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md))
- credential は endpoint に縛られず、origin と所有で決まる ([DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md))

## 関連

- [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) — endpoint から id への対応付け
- ccmsg (daemon) `docs/decisions/DR-0013-instances-are-long-running.md`
- `docs/DESIGN.md` §Instances and mesh
