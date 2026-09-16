# DR-0028: refresh token は endpoint の cookie のままで、site をまたぐときだけ分割された cookie として渡る

- Status: Active
- Date: 2026-09-16

## Context

refresh token は `<endpoint>auth/*` が Set-Cookie する HttpOnly cookie で、page の script からは読めない ([DR-0020](DR-0020-auth-shape-on-the-wire.md))。page の origin と endpoint が別物になった ([DR-0027](DR-0027-origin-apart-from-endpoint.md)) 今、その cookie は page から見て first-party とは限らない — 同じ値が、同じ site から呼ばれることも、別の site から呼ばれることもある。

## Decision

- **置き場は変えない**。refresh token は `<endpoint>auth/*` の HttpOnly cookie で、応答の本文には現れない
- cookie の属性は、credential の origin と endpoint が **same-site (registrable domain が同じ) か**で決まる。cross-site では **分割された cookie** (top-level site ごとに別々) としてしか渡らず、これは **credential が origin ごとに 1 つという形とそのまま重なる** — 1 つの site から取った session が別の site に持ち越されることは、どちらの層でも起こらない。属性の綴りは daemon の持ち物で、ここには書かない
- `auth/*` のうち **identity を決める 3 op** (`auth.register` / `auth.assert` / `auth.token.refresh`) は 2 つのヘッダを見る。`Origin` が origin と一致すること (register では登録 URL が名指す origin、他の 2 つは token family および credential record の origin)、そして `Sec-Fetch-Site` が **`none` でない**こと。`none` は「人がアドレスバーに打って開いた」で、page から呼ばれていないという意味であり、認証 op にそれが要る場面は無い。`Origin` の不在は不一致として扱う (省かれた物を一致と読めば、ヘッダを付けない呼び手が検査を素通りする)
- `auth.challenge` はこの 2 つの検査を受けない。照らす相手 — credential も登録 URL も — がまだ無い段階の op であり、challenge 自体は誰が取っても、それを使い切れるのは発行者だけ ([DR-0021](DR-0021-registration-in-two-halves.md))。CORS の許可集合には他の 3 つと同じく従う
- 断るときの応答は既存の `auth_invalid` で、どのヘッダで落ちたかは述べない ([DR-0021](DR-0021-registration-in-two-halves.md) と同じ)
- 契約が持つのはここまで — **どの op がどのヘッダを見るか、断り方、そして下の境界**。cookie の属性をどう組み立て、ヘッダをどう検査するかの手順は daemon の判断で、ここには複製しない ([DR-0020](DR-0020-auth-shape-on-the-wire.md))

## Alternatives Considered

- 案 A: refresh token を応答の本文で返し、page が storage に持つ
  - 不採用理由: HttpOnly を失う。cookie である理由はまさに「page の script に読めない」ことで、本文に 1 度でも現れればその性質は無くなる
- 案 B: refresh をやめ、期限のたびに assert し直す
  - 不採用理由: access token の寿命ごとに user verification が要る。refresh は「本人が居ることを確かめ直さずに接続を続ける」ための物で、廃止はその目的を捨てること

## Consequences

- **CHIPS を持たない browser では、cross-site の refresh は届かない**。cookie が送られないので access token が切れた時点で refresh が失敗し、client は passkey の assert に落ちる。**機能は落ちず、user verification の回数が増えるだけ**。契約はこの差を面倒見ない — 同じ site から配られた webui を使えば起きない差で、cookie の分割に対応するかは browser の側の話
- same-site で使う人と cross-site で使う人が、同じ endpoint に同居する。属性は credential ごとに決まるので、instance 全体の設定にはならない

## 関連

- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — 4 op の carrier と、手順を契約に写さない境界
- [DR-0027](DR-0027-origin-apart-from-endpoint.md) — origin の束縛と、それが CORS の許可集合であること
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — 手順の正本。cookie の属性を 1 通りに決めている §54 と、`Origin` を見ない理由を述べる §90 は本 DR が置き換える (daemon 側の DR 更新が要る)
- `docs/DESIGN.md` §Authenticating a person
