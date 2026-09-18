# DR-0028: refresh token は endpoint の cookie のままで、site をまたぐときだけ分割された cookie として渡る

- Status: Active — ✅ 実装済
- Date: 2026-09-16

## Context

refresh token は `<endpoint>auth/*` が Set-Cookie する HttpOnly cookie で、page の script からは読めない ([DR-0020](DR-0020-auth-shape-on-the-wire.md))。webui の origin と endpoint が別物である ([DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md)) 今、その cookie は page から見て first-party とは限らない — 同じ値が、同じ site から呼ばれることも、別の site から呼ばれることもある。

## Decision

- refresh token は `<endpoint>auth/*` の HttpOnly cookie で、応答の本文には現れない
- **前提**: site をまたいで cookie を送るには、分割された cookie (CHIPS) に対応した browser が要る。それがこの契約の前提であり、**対応しない browser は対象外** — 信頼しない環境として扱い、そこでの振る舞いを設計しない
- cookie の属性は、credential の webui と endpoint が **same-site (scheme と registrable domain が同じ) か**で決まる。cross-site では **分割された cookie** としてしか渡らない。属性の綴りは daemon の持ち物で、ここには書かない。
- **cookie の分割と credential の束縛は粒度が違う**。分割の単位は top-level **site** で、credential の単位は **origin**。同じ site の別 origin にある webui は同じ分割 cookie を共有しうるので、両者は重ならない。session をその origin に留めるのは cookie の分割ではなく、**token family の `origin` と `Origin` の照合** ([DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md))。cookie の分割が引き受けるのは site をまたぐ持ち越しだけ
- `auth/*` のうち **identity を決める 3 op** (`auth.register` / `auth.assert` / `auth.token.refresh`) は 2 つのヘッダを見る。`Origin` が origin と一致すること (register では登録 URL の claims、他の 2 つは token family および credential record が持つ webui から導いた origin)、そして `Sec-Fetch-Site` が **`same-origin` / `same-site` / `cross-site` のいずれか**であること。この 3 つが「page から呼ばれた」の全体で、残りは通さない — `none` (initiator が無い要求。人が URL を直に開いた場合を含む)、ヘッダの不在、そして知らない値。**列挙で受けるのであって、`none` だけを弾くのではない**。`Origin` も同じく、不在は不一致として扱う (省かれた物を一致と読めば、ヘッダを付けない呼び手が検査を素通りする)
- `auth.challenge` はこの 2 つの検査を受けない。照らす相手 — credential も登録 URL も — がまだ無い段階の op であり、challenge 自体は誰が取っても、それを使い切れるのは発行者だけ ([DR-0021](DR-0021-registration-in-two-halves.md))。CORS の許可集合には他の 3 つと同じく従う
- 断るときの応答は既存の `auth_invalid` で、どのヘッダで落ちたかは述べない ([DR-0021](DR-0021-registration-in-two-halves.md) と同じ)
- 契約が持つのはここまで — **どの op がどのヘッダを見るか、断り方、そして下の境界**。cookie の属性をどう組み立て、ヘッダをどう検査するかの手順は daemon の判断で、ここには複製しない ([DR-0020](DR-0020-auth-shape-on-the-wire.md))

## Alternatives Considered

- 案 A: refresh token を応答の本文で返し、page が storage に持つ
  - 不採用理由: HttpOnly を失う。cookie である理由はまさに「page の script に読めない」ことで、本文に 1 度でも現れればその性質は無くなる
- 案 B: refresh をやめ、期限のたびに assert し直す
  - 不採用理由: access token の寿命ごとに user verification が要る。refresh は「本人が居ることを確かめ直さずに接続を続ける」ための物で、廃止はその目的を捨てること

## Consequences

- same-site で使う人と cross-site で使う人が、同じ endpoint に同居する。属性は credential ごとに決まるので、instance 全体の設定にはならない

## 関連

- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — 4 op の carrier と、手順を契約に写さない境界
- [DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md) — credential が origin だけに縛られることと、CORS の許可集合
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — cookie の属性と、ヘッダ検査の手順の正本
- `docs/DESIGN.md` §Authenticating a person
