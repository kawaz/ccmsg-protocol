# DR-0030: identity はユーザで、instance はその人の所有物。credential はユーザ × origin × 認証器に 1 つ

- Status: Proposed
- Date: 2026-09-17

## Context

1 つの hosting (`ccmsg2.<host>`) の裏に 3 つの instance が並び、どの要求がどれに落ちるかは load balancer が決める。3 つは同格のピアで、互いを同じだけ信頼する。各 instance は自分だけの endpoint も別に持ち、そちらから直に入ることもある。これが実際の運用の姿で、人はそのうちのどれに入っているかを意識しない。

この姿に今の契約が噛み合わない。

**credential が endpoint に縛られている** ([DR-0029](DR-0029-what-a-credential-is-bound-to.md))。assertion は登録された base URL に届いた時だけ受ける、という条件は、hosting の FQDN で来た要求がどの instance の endpoint とも一致しないという形で最初から満たされない。満たすには hosting 自体をどれか 1 つの instance の endpoint と名乗らせるしかなく、そうすると 3 つのうち 1 つだけが人の入口になり、HA の意味が消える。

**複製と束縛が逆を向いている**。credential record と token family は mesh 全体に複製される ([DR-0020](DR-0020-auth-shape-on-the-wire.md))。複製する理由は「登録した instance が落ちていても人が入れること」以外にない。ところが endpoint 束縛は、複製された record を受け取った隣の instance に「これは自分の endpoint ではないから受けない」と言わせる。全部の instance が同じ record を持ち、1 つを除いて誰も使えない。**複製の目的と束縛の条件が同じ判断の中で矛盾している。**

**人が instance の数だけ増える**。`sub` は登録 URL を出した instance が付ける名前 (`<unit>-<連番>`) で、WebAuthn の user handle もその `sub` ごとに決まる ([DR-0021](DR-0021-registration-in-two-halves.md))。3 台に登録すれば 1 人が 3 つの subject になり、認証器の中では 3 つのアカウントとして並び、token も、いずれサーバに置く設定も、3 つに割れる。同じ人が同じ browser で同じ mesh を見ているのに。

**path で instance を分ける形が、比べられない粒度を要求している**。DR-0029 は webui を path 込みの URL で持ちながら、照合は全て origin か host でしか行えないと自ら述べている。browser は `Origin` にも `clientDataJSON` にも path を書かない。持っているが比べられない値がそこにある。

共通の原因は、**identity を「どこに繋いだか」から組み立てていること**にある。endpoint は住所で、mesh は複製の経路で、hosting は配られ方で、どれも「誰か」の答えにならない。passkey が答えるのは人であり、instance はその人が持っている物である。ここを入れ替える。

## Decision

### 1. identity はユーザ

- **passkey で登録した人がユーザ**。`user` はその人の id で、登録が成立した瞬間に発行 instance が 1 度決め、以後変わらない。どの instance にも endpoint にも mesh にも紐づかない
- **user id は WebAuthn の user handle そのもの**。16 bytes の乱数を base64url で綴った 1 つの値が、record の key であり、認証器に保存され、assertion が `user_handle` として名乗り返す値である。2 つの表現を持てば食い違いうる写しが増えるだけで、比較は全て文字列の一致なので綴りは 1 つでよい
- 現行の `Subject` (`<unit>-<連番>`) は**無くなる**。人が読む名前が要るなら、それは認証しない手掛かりの側 (`display_name`) であって identity ではない

```ts
UserRecord = {
  kind: "user",
  user: UserId,              // 16 bytes / base64url。user handle と同一の値
  display_name?: string,     // 人が自分を見分けるための文字列。何も決めない
  created_at: Timestamp,
}
```

### 2. credential はユーザ × origin × 認証器に 1 つ

- credential が持つ束縛は **`origin` 1 つ**。「どの page から来てよいか」だけを答える。endpoint (どの instance に入るか) は credential の問いではなくなり、record から消える
- 保持するのも比べるのも origin。URL を持って毎回導く形 (`originOf` / `rpIdOf`、`WebUi` 型) は**無くなる** — 導出が要ったのは path 込みの URL を持っていたからで、持たないなら導出する物が無い。relying party は引き続き origin の host に固定し、`rpIdHash` はその SHA-256 と比べる
- 1 人が 2 つの origin の webui を使うなら credential は 2 つ、2 台の端末を使うならさらに 2 つ。**その掛け算が credential の数**であり、instance の数は掛からない

```ts
CredentialRecord = {
  kind: "credential",
  user: UserId,
  credential_id: Base64Url,
  public_key: Base64Url,     // COSE
  origin: Origin,            // ceremony が成立してよい唯一の場所
  sign_count?: integer,
  backup_eligible?: boolean,
  backup_state?: boolean,
  issued_label?: string,     // 発行者が書いた
  device_label?: string,     // 本人が書いた
  registered_at: Timestamp,
  registered_ip?: string,
  registered_user_agent?: string,
  last_used_at?: Timestamp,
  last_used_ip?: string,
  last_used_user_agent?: string,
}
```

手掛かり (label・住所・user agent・BE / BS) の扱いは変わらない。**何も認証せず、何も決めない。** 自分の一覧を読む本人が行を自分の物だと置ける、あるいは置けずに消せる、そのためだけにある。

### 3. instance はユーザの所有物

- 「この instance の所有者はこのユーザ」を **所有 record** として instance ごとに持ち、mesh で複製する。認証の可否は **そのユーザがこの instance の所有者か**で決まる
- **endpoint は束縛に出てこない**。どの endpoint から来ても、hosting の裏のどれに落ちても、所有者なら通る。endpoint は instance の住所という DR-0018 の役目のまま残る
- **mesh は束縛の単位ではない**。mesh は record を運ぶ経路であって、「mesh に居ること」は何も許さない。mesh id のような値は持たない — 持てば「同じ mesh なら入れる」という 2 枚目の認可ができ、instance を 1 つ足すたびに全ユーザの権限が黙って広がる
- 1 つの instance が複数のユーザを所有者に持ってよい。1 人のユーザが複数の instance を所有してよい

```ts
OwnershipRecord = {
  kind: "ownership",
  user: UserId,
  instance: InstanceId,
  granted_at: Timestamp,
  granted_by?: UserId,       // 手掛かり。既存の所有者が足したなら誰か
}
```

key は `ownership/<instance>/<user>`、credential は `credential/<credential_id>`、ユーザは `user/<user>`、family は現行どおり。削除は現行と同じく tombstone の要素として運び、tombstone が何を指すかは key が言うので、record 自身は `sub` のような対象フィールドを持たない。

### 4. 登録の操作は 2 つ

**(a) ユーザを作る** (初回)。CLI が登録 URL と 6 桁を出し、人がそれを browser で開いて passkey を作る。成立した瞬間に **ユーザ・credential・所有 record の 3 つが同時に生まれ**、その instance の所有者になる。線上の op は現行の `auth.register` のまま。

**(b) instance をユーザに紐付ける** (2 台目以降)。その instance の CLI が「所有者を足す」URL と 6 桁を出す。人が browser で開き、**既存の passkey で assert する**。通れば所有 record が 1 つ増える。新しい passkey は作らない。op を分けて `auth.enroll` とする — 答えている問いが違う (register は人を作り、enroll は持ち物を足す) し、運ぶ ceremony も違う (create と get)。

複製で既にそのユーザを知っている instance では **URL は要らない**。所有 record を書けばよく、それは CLI の操作で、線上には record の形しか現れない。

**認証器を足す** (2 台目の端末) は上のどちらでもなく「ユーザに passkey を足す」で、認証済みチャンネルからの add が担う (issue `passkey-list-for-people`)。本 DR はその経路の形を決めず、**ユーザに対して足す物であって instance に対して足す物ではない**という位置づけだけを置く。

登録 URL の claims:

```ts
EnrollClaims = {
  iss: InstanceId,           // 発行者。secret も 6 桁の試行回数もここにしかない
  purpose: "create_user" | "add_owner",
  instance: InstanceId,      // 所有者を足す先。iss と同じ
  origin: Origin,            // 人を送る先であり、ceremony が成立してよい場所
  endpoint: Endpoint,        // page が叩く住所。束縛ではない (下記)
  expires_at: Timestamp,
  jti: string,
  user?: UserId,             // purpose が create_user の時だけ。発行者が先に決める
  issued_label?: string,
}
```

- **`endpoint` は宛先であって束縛ではない**。page はどこかに POST しなければならず、その URL を URL 自身が名乗る以外に知らせる手段が無い。hosting の FQDN でもよく、どの instance に落ちても、判定は `auth.resolve` で `iss` に転送される ([DR-0020](DR-0020-auth-shape-on-the-wire.md))。**受け取った側は endpoint を何とも照合しない** — 照合する物が無いことがこの DR の眼目である
- `user` を `create_user` の時だけ claims が運ぶのは、認証器が instance の手の届かない所でその値を保持するため (DR-0021 の理由はそのまま生きる)。page に決めさせれば、1 人に 2 つの値ができた時に instance からは直せない。`add_owner` では誰が来るかが assert の結果で決まるので、claims は持たない
- 登録 URL の送り先は **origin の直下**。path mount は持たない (§7)

op の形:

```ts
// ユーザを作る。現行と同じ引数
auth.register(token, code, device_label?, challenge?, credential: RegistrationCredential) -> AuthSession

// instance を足す。既存 passkey の assert を運ぶ
auth.enroll(token, code, challenge: AuthChallenge, credential: AssertionCredential) -> AuthSession

// ユーザとして入る。現行のまま
auth.assert(challenge, credential: AssertionCredential) -> AuthSession

AuthSession = { user: UserId, access: { value, expires_at } }
```

`auth.enroll` の属性は他の HTTP op と揃える (`plane: "common"`、全 role、`needs_hello: false`、`locality: "any_instance"`、`carrier: "http"`、errors は `auth.register` と同じ)。`auth.resolve` の `register` kind は `claims` kind になり、purpose は返る claims が言う (検査する物 — token・6 桁・試行回数 — が 2 経路で同じなので、resolve を 2 つに割らない)。

### 5. token family

- family はユーザの物で、mesh に複製する。`sub` は `user` になり、`webui` は `origin` になる。他は変わらない (単一世代 + 前世代の猶予 + retired の digest)
- 接続が照らされるのは **family の origin と `Origin` ヘッダ**、そして **そのユーザが到達した instance の所有者であること**。到達した endpoint は見ない
- rotate をどこで行うかは **§未決 Q1**

### 6. 保存の単位はユーザ

- webui の設定 (将来のサーバ保存、kv op) はユーザの record として複製する。持ち主が instance でも endpoint でもないので、人は 3 台のどれから入っても同じ設定を見る
- **localStorage の名前空間は user id**。endpoint でも instance でも mesh でもない。同じ origin の page が同じユーザとして開かれたなら同じ引き出しを見る
- cookie は endpoint host の path のまま ([DR-0028](DR-0028-refresh-cookie-across-sites.md))。cookie は browser が住所で配る物で、ユーザの持ち物にはできない

### 7. hosting は origin だけを持つ

- credential も claims も持つのは `origin` で、**path mount は非対応**。`https://h/` の下に `/personal/` を切って別 instance を出す形は、browser が `Origin` にも `clientDataJSON` にも path を書かない以上、この契約のどの検査からも見分けられない。見分けられない物を持たない
- 1 つの host で複数 instance を出す必要があるなら、**host を分ける** (`a.example` / `b.example`)。それが browser が見分けられる唯一の単位

### 8. 一覧を答える op

自分の姿を読む op を 1 つ持つ。**ユーザ / passkey (認証器ごと) / 所有 instance (endpoint ごと)** の 3 段で、これは webui が描く画面の形であり、契約が持つのは答えの形だけ。

```ts
auth.account.read() -> {
  user: UserRecord,
  credentials: CredentialRecord[],   // public_key を除く
  instances: { instance: InstanceId, endpoint?: Endpoint, granted_at, granted_by? }[],
}
```

`roles: ["user"]`、`needs_hello: true`、`scope: "role"` (答えるのは**呼び手自身の**ユーザの分だけ。他人の分を読む形は持たない)、`locality: "any_instance"`。op の名前は **§未決 Q2**。

### 9. 検査の表

| op / 経路 | `Origin` | `Sec-Fetch-Site` | `clientDataJSON.origin` | `rpIdHash` | 所有 |
|---|---|---|---|---|---|
| `auth.challenge` | — | — | — | — | — |
| `auth.register` | claims の `origin` | 列挙 | claims の `origin` | sha256(claims の `origin` の host) | この登録で**作る** |
| `auth.enroll` | claims の `origin` | 列挙 | credential の `origin` | sha256(同 host) | この登録で**足す** |
| `auth.assert` | credential の `origin` | 列挙 | credential の `origin` | sha256(同 host) | ユーザが到達 instance の所有者か |
| `auth.token.refresh` | family の `origin` | 列挙 | — | — | 同上 |
| WS upgrade | family の `origin` | — | — | — | 同上 |
| `auth.extend` | — | — | — | — | 接続時に済んでいる |
| `auth.account.read` | — | — | — | — | 接続時に済んでいる |

- 「列挙」は `same-origin` / `same-site` / `cross-site` のいずれかであること。`none`・不在・知らない値は通さない (DR-0028 のまま)
- **`Origin` の不在は不一致**。全てのゲートを通ることが条件で、比べる物が無い呼び手は条件を満たしていない (DR-0029 のまま)
- **`endpoint` の列は無い**。どの列にも現れないことがこの DR である
- どの検査で落ちても答えは `auth_invalid` で、どれが合わなかったかは述べない
- CORS の許可集合は「**その instance の所有者たちの credential の origin**」と「その instance 自身が発行してまだ生きている登録 URL の origin」。後者は複製しない (DR-0029 のまま)

## Alternatives Considered

| 案 | 内容 | 不採用理由 |
|---|---|---|
| A | mesh を束縛の単位にする (mesh id を持ち、credential をそれに縛る) | 「同じ mesh なら入れる」という 2 枚目の認可ができる。instance を 1 つ足すと全ユーザの権限が黙って広がり、外したい 1 台だけを外す操作が無い。所有 record なら足すも外すも 1 行で、mesh の形と独立している |
| B | endpoint 束縛のまま (現行 DR-0029) | hosting の FQDN がどの endpoint とも一致せず、HA の裏に入れない。複製した record を隣の instance が使えないので、複製の目的 (登録先が落ちていても入れる) が果たされない。Context の矛盾そのもの |
| C | credential を endpoint ごとに作る (現行の運用として受け入れる) | 1 人が instance の数だけ passkey を持ち、認証器の中で同じ人が複数アカウントとして並ぶ。増えるのは安全性ではなく人が管理する鍵の本数で、どれを消せるか分からなくなる方に効く |
| D | path mount を残す (`WebUi` を path 込みで持ち続ける) | 持てるが比べられない。browser は `Origin` にも `clientDataJSON` にも path を書かないので、同じ origin の別 path はこの契約の全ての検査で同一物になる。区別できない値を record に持つのは、区別されていると読み違える余地を作るだけ |
| E | 所有 record を持たず「mesh の全 instance を所有」と読む | A と同じ帰結を record 無しで得るだけで、外す操作がさらに無い。所有を明示的な record にすると、一覧に出せて、消せて、複製の対象になる (§8 の 3 段目がそれ) |
| F | `auth.enroll` を作らず `auth.assert` に token と 6 桁を optional で足す | 1 つの op が「入る」と「持ち物を足す」の 2 つを答えることになり、属性表からは同じ 1 行に見える。引数の有無で副作用が変わる op は、認可を表の外に置くのと同じ形をしている |
| G | `sub` を人が付ける名前のまま残す (`<unit>-<連番>`) | 名前を付けた instance が identity の所有者になる。引っ越しと HA で名前の由来が意味を失い、同じ人の 2 つの `sub` を後から 1 つにする手段が無い。人が読む名前は `display_name` として認証しない側に置けば足りる |
| H | ユーザ id と user handle を別の値にする | 同じ事実の 2 つ目の写しで、食い違えば認証器の中の人と record の人が別人になる。比較は全て文字列の一致なので、綴りを 1 つにして困る場面が無い |

## Consequences

- **人は 1 人で 1 つの identity を持つ**。3 台の instance を所有していても credential は origin と端末の数だけで、token も設定も 1 つに集まる
- **instance を mesh に足しても、その instance には誰も入れない**。所有 record を書くまでは所有者が居ない。これは意図した性質で、mesh に加わることが入口を開けないための条件 (案 A の裏返し)
- **endpoint は住所に戻る**。引っ越しても credential も token も無効にならない。DR-0018 の「id を鍵にする物は endpoint の変更を跨いで生き残る」が、認証にもそのまま及ぶ
- **origin を移すことは全員の登録をやり直すこと**。ここは DR-0029 から変わらない。変わったのは endpoint 側で、そちらは動かしても登録が生きる
- **1 つの host に複数 instance を出す形が無くなる**。必要なら host を分ける。運用の制約が増えるのではなく、元々見分けられていなかった物が契約から消える
- **この束縛が防ぐのは、browser の中で別 origin の page が token を使うこと**。token が機械の外に出た後の防御ではなく、乗っ取られた自 origin の page は同じ origin なので通る。範囲は DR-0029 と同じ
- `webui` を持つ credential と token family、`sub` を持つ record は**無効**。契約は移行の形を持たない (下記)

### 現行 DR との対応

| 現行の判断 | 本 DR で |
|---|---|
| **DR-0020**: 契約が持つのは線上の形だけ、手順は daemon | 残る |
| DR-0020: 認証 op は HTTP で運び、属性表には載る | 残る (`auth.enroll` と `auth.account.read` が増える。後者は WS の op) |
| DR-0020: `needs_hello: false`、提供場所は `<endpoint>auth/*` | 残る |
| DR-0020: `RegisterClaims.endpoint` が base URL を名指す | **置き換わる** — `EnrollClaims.endpoint` は宛先で、照合しない |
| DR-0020: `auth.extend` は WS の op | 残る |
| DR-0020: `auth.resolve` / `auth.rotate` は発行者へ転送 | resolve は残る (`register` kind が `claims` kind に)。rotate は **§未決 Q1** |
| DR-0020: record は `auth.records` topic で複製、kv には載せない | 残る (載る record に `user` と `ownership` が増える) |
| DR-0020: retired は digest で持つ | 残る |
| **DR-0021**: 6 桁を別経路で要求する | 残る (`auth.enroll` にも同じく必須) |
| DR-0021: どちらの半分が失敗したかを述べない | 残る |
| DR-0021: 6 桁を判定するのは発行者だけ | 残る |
| DR-0021: challenge は発行者と一緒に旅する | 残る |
| DR-0021: claims が `user_id` を運び、page に決めさせない | **置き換わる** — ユーザに 1 つの値で、`create_user` の claims だけが運ぶ |
| **DR-0022** (archive) | 既に置き換え済み。archive の索引が指す先が本 DR になる |
| **DR-0028**: refresh は HttpOnly cookie、本文に出さない | 残る |
| DR-0028: 分割された cookie (CHIPS) を前提とする | 残る |
| DR-0028: cookie の属性は webui と endpoint が same-site かで決まる | **置き換わる** — 判定は credential の `origin` と endpoint の間で行う |
| DR-0028: identity を決める op は `Origin` と `Sec-Fetch-Site` を見る | 残る (`auth.enroll` が加わって 4 op) |
| DR-0028: `auth.challenge` はこの 2 つを見ない | 残る |
| DR-0028: 断り方は `auth_invalid` で、どのヘッダかは述べない | 残る |
| **DR-0029**: credential は endpoint と webui の 2 つに縛られる | **置き換わる** — `origin` 1 つ。instance は所有で決まる |
| DR-0029: endpoint 束縛 (base URL の下に届いた時だけ受ける) | **消える** |
| DR-0029: 保持は URL、比べるのは origin | **消える** — origin を持つので導出が無い |
| DR-0029: `originOf` / `rpIdOf` と `WebUi` 型 | **消える** — `Origin` 型 1 つに戻る |
| DR-0029: relying party は host に固定する | 残る (origin の host) |
| DR-0029: 登録 URL は webui と発行者の endpoint を名指す | **置き換わる** — origin (人を送る先) と endpoint (宛先) を名乗る |
| DR-0029: token family は credential の webui を引き継ぐ | **置き換わる** — `origin` を引き継ぐ |
| DR-0029: WS の handshake は `Origin` と照合する | 残る (加えて所有を照らす) |
| DR-0029: `Origin` の不在は不一致 | 残る |
| DR-0029: CORS は登録済み credential の origin + 生きている登録 URL の origin | **置き換わる** — 前者が「所有者たちの credential の origin」になる |
| DR-0029: 認証しない手掛かりを持つ / それで判定しない | 残る |
| DR-0029: webui の `connect-src` は契約の外 | 残る |
| **daemon DR-0001** §2.2 登録はローカルからしかできない | 残る。「所有者を足す」経路が 1 本増える |
| daemon DR-0001 §2.3 credential が何に縛られるか | **置き換わる** (既に DR-0029 へ委譲済みの節) |
| daemon DR-0001 §2.4 family は `sub` を持ち単一 writer | `sub` → `user` に置き換わる。単一 writer は **§未決 Q1** |
| daemon DR-0001 §2.6 tombstone は sub 単位 | **置き換わる** — key が対象を言い、user / credential / ownership の 3 種になる |
| daemon DR-0001 §2.7 人の入口はパスの末尾で照合する | 残る。path mount を持たないので、prefix の下に別 instance が居る形は無くなる |

supersede するのは **DR-0029** (全体)。**DR-0020 / DR-0021 / DR-0028 は立ったまま**で、上表の「置き換わる」行だけを本 DR が上書きする。実際の archive への移動と、archive 索引および daemon 側 DR の追従は**裁定後の作業**。

### 移行

既存の record は**作り直す**。移行コードは書かない。この契約は世代を 1 つしか持たず互換経路を持たない ([DR-0017](DR-0017-one-generation-no-compatibility-path.md)) し、今この mesh を使っている人は kawaz 1 人なので、失われるのは再登録 1 回分の手間だけである。旧 record を消す手順は daemon の作業。

## 未決 (kawaz 裁定待ち)

**Q1. rotate をどこでもできるようにするか。** 現行は family の `iss` だけが書き、他の instance が受けた rotate は `auth.rotate` で転送する。HA の裏では `iss` が落ちている時に refresh だけが通らなくなる (再 assert には落ちるが、user verification を求められる)。
統括推し: **どこでもできる**。所有者ならどの instance でも書けるのが本 DR の形と揃う。悪い面は、2 つの instance が同じ family を並行に rotate した時に世代が競合し、LWW でどちらかが消えること — 消えた側の値の提示は replay と見分けが付かないので、**family の失効が誤発火する**。避けるなら「retired に入った値の提示は失効させるが、猶予の中の前世代は複数あってよい」のような緩め方が要り、それは replay 検知を弱める。転送を残す (現行) なら Q1 は「`iss` が落ちている間は refresh できない」を受け入れることになる。

**Q2. 一覧 op の名前。** 仮に `auth.account.read` と置いた。`auth.self.read` / `auth.user.read` / `auth.credentials.read` も候補。
統括推し: **`auth.account.read`** — 答えるのがユーザ・passkey・所有 instance の 3 つなので、どれか 1 つを名前にすると他の 2 つが付属物に見える。

**Q3. 所有を外す操作を誰が持つか。** CLI (ローカル) だけか、認証済みチャンネルからも外せるか。
統括推し: **両方**。ただし「今入っている instance の所有を自分で外す」は塞ぐ (自分の足元を外す操作になる)。credential の remove が「今使っている物は消せない」のと同型。

**Q4. `display_name` をユーザが持つか。** §1 では持つ形で書いた。認証しない手掛かりなので DR-0029 の系列だが、ユーザ record に人が書く文字列が 1 つ増えることではある。
統括推し: **持つ。** 所有者が複数居る instance で一覧を読む時、user id の 22 文字だけが並ぶのは見分けの用を成さない。

**Q5. 1 つの instance が複数の所有者を持ってよいか。** §3 では「よい」と書いた。`granted_by` はその前提の手掛かり。
統括推し: **よい。** 禁じるなら所有 record は instance ごとに 1 行の上書きで済み、`granted_by` も要らなくなるので、ここは形が分かれる。今後 kawaz 以外の人がこの mesh に入る形があるかどうかで決まる。

**Q6. `auth.enroll` でも 6 桁を要るか。** 既存 passkey の assert が要るので、URL の所持 + user verification で既に 2 つの経路を通っている。6 桁はさらに「CLI の画面を見た」を足す。
統括推し: **要る。** assert が確かめるのは「このユーザ本人か」であって「この instance を足してよいと本人が今その端末の前で判断したか」ではない。6 桁は後者を確かめる唯一の材料で、離席中に本人の同期 passkey で第三者が instance を足す経路がそこで閉じる。

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は instance の住所であり、id は移転を跨ぐ
- [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) — 転送された要求は宛先で認可し直す
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — 認証 op の carrier と record の複製経路
- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録の 2 経路と、発行者だけが判定すること
- [DR-0028](DR-0028-refresh-cookie-across-sites.md) — refresh cookie と、認証 op が見るヘッダ
- [DR-0029](DR-0029-what-a-credential-is-bound-to.md) — 本 DR が置き換える判断
- `docs/issue/2026-09-09-passkey-list-for-people.md` — 認証済みチャンネルからの passkey の add / remove
- `docs/issue/2026-09-10-token-family-bound-to-endpoint.md` — token family の endpoint 束縛 (本 DR が採らない方向)
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — WebAuthn の検証と cookie / carrier の手順の正本
- `docs/DESIGN.md` §Authenticating a person
