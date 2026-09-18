# DR-0030: identity はユーザで、instance はその人の所有物。credential はユーザ × origin × 認証器に 1 つ

- Status: Accepted
- Date: 2026-09-17

## Context

1 つの hosting (`ccmsg2.<host>`) の裏に 3 つの instance が並び、どの要求がどれに落ちるかは load balancer が決める。3 つは同格のピアで、互いを同じだけ信頼する。各 instance は自分だけの endpoint も別に持ち、そちらから直に入ることもある。これが実際の運用の姿で、人はそのうちのどれに入っているかを意識しない。

この姿に今の契約が噛み合わない。

**credential が endpoint に縛られている**。assertion は登録された base URL に届いた時だけ受ける、という条件は、hosting の FQDN で来た要求がどの instance の endpoint とも一致しないという形で最初から満たされない。満たすには hosting 自体をどれか 1 つの instance の endpoint と名乗らせるしかなく、そうすると 3 つのうち 1 つだけが人の入口になり、HA の意味が消える。

**複製と束縛が逆を向いている**。credential record と token family は mesh 全体に複製される ([DR-0020](DR-0020-auth-shape-on-the-wire.md))。複製する理由は「登録した instance が落ちていても人が入れること」以外にない。ところが endpoint 束縛は、複製された record を受け取った隣の instance に「これは自分の endpoint ではないから受けない」と言わせる。全部の instance が同じ record を持ち、1 つを除いて誰も使えない。**複製の目的と束縛の条件が同じ判断の中で矛盾している。**

**人が instance の数だけ増える**。`sub` は登録 URL を出した instance が付ける名前 (`<unit>-<連番>`) で、WebAuthn の user handle もその `sub` ごとに決まる ([DR-0021](DR-0021-registration-in-two-halves.md))。3 台に登録すれば 1 人が 3 つの subject になり、認証器の中では 3 つのアカウントとして並び、token も、いずれサーバに置く設定も、3 つに割れる。同じ人が同じ browser で同じ mesh を見ているのに。

**path で instance を分ける形が、比べられない粒度を要求している**。現行の契約は webui を path 込みの URL で持ちながら、照合は全て origin か host でしか行えない。browser は `Origin` にも `clientDataJSON` にも path を書かない。持っているが比べられない値がそこにある。

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
- 1 人が 2 つの origin の webui を使うなら credential は 2 つ、2 台の端末を使うならさらに 2 つ。**その掛け算が credential の数**であり、instance の数も endpoint の本数も掛からない。数えるのは **ユーザ × hosting origin × 認証器**で、hosting origin が別なら「ユーザに passkey を 1 つ足す」であって別のユーザにはならない
- **origin が許可集合に入るのは明示の操作ではない**。その origin で最初の credential が成立した時点で入る (それまでの入口は、発行者が出して生きている登録 URL がその origin を名乗っていること)。その origin の credential を全部消せば、許可からも消える。origin を足す op も設定項目も持たない

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
- **endpoint は 2 種類あり、mesh のピアが使うものは instance に 1 対 1 で届く住所でなければならない**。HA の住所 (hosting の FQDN) は、そこへ送っても load balancer がどれに落とすか決めるので、ピアが特定のピアへ届ける用途には使えない。人が繋ぐ住所としての HA の住所は、それとは別に持つ。`iss` は endpoint ではなく instance id なので ([DR-0018](DR-0018-instance-id-apart-from-endpoint.md))、HA の裏に何台居ても発行者は一意に指せる
- **mesh は束縛の単位ではない**。mesh は record を運ぶ経路であって、「mesh に居ること」は何も許さない。mesh id のような値は持たない — 持てば「同じ mesh なら入れる」という 2 枚目の認可ができ、instance を 1 つ足すたびに全ユーザの権限が黙って広がる
- 1 つの instance が複数のユーザを所有者に持ってよい。1 人のユーザが複数の instance を所有してよい。`granted_by` はその前提の手掛かりで、複数居る一覧を人が読む時に誰が足したかを言う
- **`granted_by` は「人」と「instance」の 2 形を持つ**。認証済みチャンネルからの granting は足した人 (`{ kind: "user", … }`)、CLI からの granting はその CLI の instance (`{ kind: "instance", … }`)。**どの instance にとっても最初の granting は端末から作られ、そこには名指せる人が居ない** — 人しか入らない欄にすると、一覧を最初に読む場面でちょうど空になる。裸の id 1 本にしないのは、読み手がどちらを持っているか判らなくなるため。役割は **人が読む手掛かりのまま**で、決定には一切使わない。**「実際にどの instance が書いたか」の保証はこの欄の仕事ではなく**、複製する record への署名 (Consequences の「後続の拡張」) が担う
- **所有 record は、書く instance 自身の分に限らずピアの分も書ける**。ピアは互いを同じだけ信頼する同格の存在なので (Context)、iA の操作者が iB / iC の所有 record を書いてよい。書いた instance と所有される instance が同じである必要は無く、「自分の分しか書けない」は所有が mesh に依らないことと両立しない (それを課すと、新しい instance を足すたびに人がそこへ物理的に行かねばならなくなる)。CLI の `user create --all` / `user add <user> --all` はこれを使い、**その時点で知っている peers 全部に所有を付ける** (URL を経由する経路では、その集合を claims の `instances` が運び、書くのは ceremony が成立した時 — §4)
- **所有を外す経路は CLI と認証済みチャンネルの両方**。線上は `auth.ownership.remove(instance)` で、持っていない物を名指せば `not_found` (既存の語彙が record を含む)。名指すのは外す対象だけ (誰の物かは接続が言っているので、ユーザを引数に取れば他人の物を外す形ができる)。ただし **今繋いでいる instance の自分の所有は外せない** — 自分の足元を外す操作になる。credential の remove (`auth.credential.remove(credential_id)`) が「今使っている物は消せない」のと同型で、どちらも `auth_in_use` で断り、外す先を他の経路から選び直せば済む。`forbidden` と別の code にするのは、呼び手の資格の問題ではない (本人の物である) から。「今使っているか」の判定は daemon

```ts
OwnershipRecord = {
  kind: "ownership",
  user: UserId,
  instance: InstanceId,
  grant: Base64Url,          // この granting の id。乱数、毎回新しい
  granted_at: Timestamp,
  granted_by?:               // 手掛かり。誰が / どの instance が足したか
    | { kind: "user", user: UserId }
    | { kind: "instance", instance: InstanceId },
}
```

key は `ownership/<instance>/<user>/<grant>`、credential は `credential/<credential_id>`、ユーザは `user/<user>`、family は現行どおり。削除は現行と同じく tombstone の要素として運び、tombstone が何を指すかは key が言うので、record 自身は `sub` のような対象フィールドを持たない (tombstone の種類は key の側で user / credential / ownership / family の 4 つ)。

**所有の key が granting の id を持つ理由**。tombstone は **その key への以後の書き込みを永久に拒む**。key が `<instance>/<user>` だけだと、一度所有を外した時点でその組み合わせの key が死に、**同じ人を同じ instance に二度と足せなくなる** — 誤って外した所有者を戻す手段が契約から失われる。credential にこの問題が無いのは id が登録ごとに新しいからで、同じ性質を所有にも持たせる。したがって:

- **granting ごとに乱数の id を 1 つ**持ち、それが key の末尾に入る
- **「今その人がその instance を所有しているか」は、その (instance, user) に生きている granting が 1 つでもあるか**で決まる (record 1 つの有無ではない)
- **外す** = その (instance, user) の生きている granting 全部に tombstone を置く。`auth.ownership.remove` は instance しか名指さないので、「2 つある granting の片方だけ外す」形は持たない
- **足し直す** = 新しい granting を 1 つ書く。key が違うので、前の tombstone は何も拒まない

tombstone を期限付きにして LWW に委ねる案は採らない。分断から戻った peer が古い ownership を「新しい知らせ」として運び直す窓ができ、外した所有者が黙って復活しうる。永久 tombstone + 新しい id の方が、どちらの向きにも取り違えが無い。

### 4. 登録の操作は 2 つ

**(a) ユーザを作る** (初回)。CLI が登録 URL と 6 桁を出し、人がそれを browser で開いて passkey を作る。成立した瞬間に **ユーザ・credential・所有 record の 3 つが同時に生まれ**、その instance の所有者になる。線上の op は現行の `auth.register` のまま。

**(b) instance をユーザに紐付ける** (2 台目以降)。経路は 2 つで、既定は前者:

- **その instance の CLI で `owner add <user>`**。mesh の複製でそのユーザを既に知っているなら、確かめる物は全て手元にあり、**URL も browser も要らない**。所有 record を 1 行書くだけで、線上には record の形しか現れない。peers 全部に足す形 (`--all`) も同じ操作の範囲
- **enroll URL + 既存 passkey の assert**。**受ける instance が、複製でそのユーザの credential を既に持っていることが前提**: assert の検証には公開鍵が要り、それが届く経路は `auth.records` の複製しか無い。したがってこれは「mesh には居るが、この人にはまだ渡していない instance」のための経路であって、mesh の外の instance のための経路ではない — 複製が届かない instance は別の mesh であり、そこで人が入るには `auth.register` で作り直す。HA の裏では ceremony がどの peer に着弾しても、その peer が同じ複製を持っているので成立する。CLI が「所有者を足す」URL と 6 桁を出し、人が browser で開いて **既存の passkey で assert する**。通れば所有 record が 1 つ増える。新しい passkey は作らない。**6 桁はここでも必須**で、assert が確かめるのは「このユーザ本人か」であって「この instance を足してよいと本人が今その端末の前で判断したか」ではない。後者を確かめる材料は 6 桁しかなく、離席中に本人の同期 passkey で第三者が instance を足す経路がそこで閉じる。op を分けて `auth.enroll` とする — 答えている問いが違う (register は人を作り、enroll は持ち物を足す) し、運ぶ ceremony も違う (create と get)

**endpoint のための手順は無い** (HA の住所も同じ)。endpoint は何にも縛られないので、足すことも紐付けることもない。ただし cookie は endpoint host ごとに別なので ([DR-0028](DR-0028-refresh-cookie-across-sites.md))、**新しい endpoint host に初めて繋ぐ時は 1 回 assert してその host の cookie をもらう**。これは登録でも紐付けでもなく、ただのサインインである。

**認証器を足す** (2 台目の端末) は上のどちらでもなく「ユーザに passkey を足す」で、経路は 3 つ。いずれも **同じ user handle (そのユーザの id) を渡す**ので、増えるのは credential だけでユーザは増えない:

- 認証済み画面から WebAuthn の cross-device (QR) で別端末の認証器に作る (**既定**)
- 認証済み画面から add URL (+ 6 桁) を出し、別端末の browser で開いて作る
- CLI から add URL を出す

hosting origin が別なら、同じ端末の同じ認証器でもそこで 1 つ作ることになる (§2)。本 DR は **足す**経路の線上の形を決めず (issue `passkey-list-for-people`)、**ユーザに対して足す物であって instance に対して足す物ではない**という位置づけと、user handle が 1 つであることだけを置く。**外す**方は §3 と同じ形で契約が持つ — `auth.credential.remove(credential_id)`、今使っている物は `auth_in_use`。

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
  display_name?: string,     // 認証器に見せるアカウント名の初期値
  instances?: InstanceId[],  // この URL が渡す instance 全部。着弾した instance が書く
}
```

- **既にその instance の所有者である人の `auth.enroll` は成功する**。所有 record は増えず、既にある granting もそのままで、応答は普通の `AuthSession`。拒否にすると page からは `auth_invalid` としか見えず (どれが合わなかったかは述べない規則)、人には「6 桁を打ち間違えた」と区別が付かない。所有は「持っているか否か」であって回数ではないので、2 度目を成立させても何も広がらない
- **`endpoint` は宛先であって束縛ではない**。page はどこかに POST しなければならず、その URL を URL 自身が名乗る以外に知らせる手段が無い。hosting の FQDN でもよく、どの instance に落ちても成立する (下記)。**受け取った側は endpoint を何とも照合しない** — 照合する物が無いことがこの DR の眼目である
- したがって **発行 instance の endpoint が browser から到達できなくてよい**。mesh がローカルに閉じ、HA の住所だけが公開されている構成でも、初回登録から全部その住所 1 つで済む
- `user` を `create_user` の時だけ claims が運ぶのは、認証器が instance の手の届かない所でその値を保持するため (DR-0021 の理由はそのまま生きる)。page に決めさせれば、1 人に 2 つの値ができた時に instance からは直せない。`add_owner` では誰が来るかが assert の結果で決まるので、claims は持たない
- **`display_name` は認証器に見せるアカウント名で、claims が初期値を運び、人が確定した値を `auth.register` が返す**。page は credential を作る前にアカウント名を決めねばならず、それを知る手段は URL しか無い (passkey manager は ceremony で渡された名前を保存して一覧に出すので、運ばなければ 16 byte の乱数が本人の前に出続ける)。`issued_label` と分けるのは、あちらが「誰に渡した URL か」という管理者のメモで credential に残る物だからで、1 つの値に両方を兼ねさせると管理者の私的なメモが本人の名前として表示され、どちらも片方を巻き込まずには直せなくなる。登録画面はこの値を入れた入力欄を見せ、**人が確定した値が `auth.register.display_name`**、それが user record の `display_name` になる (省略すれば claims の値が立つ)。既に居る人に passkey を足す URL では、その人が既に読んでいる名前を claims が運び、**登録は改名しない** (足される先は本人が既に名付けた account である)
- 登録 URL の送り先は **origin の直下**。path mount は持たない (§7)
- **`instances` は、この URL が渡す instance 全部を名乗る**。所有 record を書くのは **ceremony が成立した時**で、書くのは着弾した instance (`granted_by` は発行 instance)。集合を端末で決めて claims で運ぶのは、「この instance が知っている peers」が端末でだけ人に見える問いだからで、着弾側が自分の知識で書くと、`--all` が問うたのとは違う問いに答えることになる。**発行時に書かない**のは、登録されなかった URL の granting が、どの user record も答えない人を名指したまま複製の集合に残るため — 誰も認証できないので無害だが、意味のある granting と見分けが付かない。省略は発行者自身の 1 台だけ (= `instance` が既に言っていること) を意味し、2 台以上を渡す時にここで名乗る。`add_owner` も同じく運ぶ (どちらも instance を渡す操作で、違うのは誰が来るかの決まり方だけ)

op の形:

```ts
// ユーザを作る。現行と同じ引数
auth.register(token, code, device_label?, display_name?, challenge?, credential: RegistrationCredential) -> AuthSession

// instance を足す。既存 passkey の assert を運ぶ
auth.enroll(token, code, challenge: AuthChallenge, credential: AssertionCredential) -> AuthSession

// ユーザとして入る。現行のまま
auth.assert(challenge, credential: AssertionCredential) -> AuthSession

// 持っている物を手放す。名指すのは外す対象だけ
auth.ownership.remove(instance: InstanceId) -> {}
auth.credential.remove(credential_id: Base64Url) -> {}

AuthSession = { user: UserId, access: { value, expires_at } }
```

**HA の裏で、登録が発行 instance 以外に着弾しても成立する。** 受けた instance が自分で検査し、自分で record を書き、自分で応答する。発行者に問うのは **発行者のメモリにしか無い物だけ**で、それは `auth.resolve` の転送 ([DR-0021](DR-0021-registration-in-two-halves.md) の中継、[DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) のとおり宛先で認可し直す)。

| 確かめる物 | 受けた instance | 発行者 (`iss`) |
|---|---|---|
| 登録 token の真正・`jti` の未消費・期限 | — | ✅ (メモリにしか無い) |
| 6 桁とその試行回数 | — | ✅ (同上、[DR-0021](DR-0021-registration-in-two-halves.md)) |
| claims の中身 (`purpose` / `origin` / `user` / `instance`) | resolve の答えを使う | ✅ (答えとして返す) |
| `Origin` / `Sec-Fetch-Site` | ✅ | — |
| `clientDataJSON.origin` / `challenge` | ✅ | — |
| `rpIdHash` / attestation / 署名 | ✅ | — |
| record を書く・複製する・応答する | ✅ | — |

このため **登録 op (`auth.register` と `auth.challenge`) の CORS は全 origin に開く**。登録を守っているのは token と 6 桁と発行者の判定であって CORS ではなく、どの instance に落ちても page が最初の POST を出せる必要がある。assert / refresh の CORS は登録済み origin の集合のまま (§9)。

`auth.enroll` の属性は他の HTTP op と揃える (`plane: "common"`、全 role、`needs_hello: false`、`locality: "any_instance"`、`carrier: "http"`、errors は `auth.register` と同じ)。`auth.resolve` の `register` kind は `claims` kind になり、purpose は返る claims が言う (検査する物 — token・6 桁・試行回数 — が 2 経路で同じなので、resolve を 2 つに割らない)。

### 5. token family

- family はユーザの物で、mesh に複製する。`sub` は `user` になり、`webui` は `origin` になる。他は変わらない (単一世代 + 前世代の猶予 + retired の digest)
- 接続が照らされるのは **family の origin と `Origin` ヘッダ**、そして **そのユーザが到達した instance の所有者であること**。到達した endpoint は見ない
- **rotate は所有されているどの instance でも行える**。発行者 (`iss`) への転送は無くなり、`auth.rotate` の中継も要らない。family は単一 writer ではなくなり、**`iss` は mint した instance の記録として残るだけで、書き手を制限しない**。所有者ならどの instance でも書けるのが本 DR の形と揃い、`iss` が落ちている間だけ refresh が通らない、という穴が閉じる
- **競合した時は負けた側の端末がサインインし直す**。2 つの instance が同じ family を並行に rotate すれば世代は競合し、収束の後、負けた側が client に渡した値は **family のどの世代にも無い値**になる — 今立っている `refresh` でも、猶予中の `previous_refresh` でも、`retired` の digest でもない。**family が知らない値の提示は `auth_invalid` で断るだけで、family は失効させない**。失効させるのは **`retired` の digest に一致した時だけ**で、それが replay の検知そのものである。両者を混ぜて「知らない値も replay 扱い」にすると、並行 rotate のたびに同じ family の他の端末まで巻き添えで落ちる。負けた側は passkey で入り直す。分断が起きるのは稀で、代償は user verification 1 回であり、replay 検知を弱める代償より小さい

**cookie の名前もユーザで決まり、instance を含めない** (`__Secure-ccmsg-<digest(user id)>`)。値は family の refresh token で、受けた instance は複製済みの family から値で引く。名前に instance が入っていると、HA の住所の裏で別の instance が置いた cookie を自分のものと認識できず、family が複製されていても refresh が通らない — rotate をどこでもできるようにしたことが、cookie の名前にもそのまま及ぶ。host は endpoint の host (host-only)、path は `<endpoint の path>auth/` まで (同じ origin の下の別 endpoint で cookie が分かれるため)。同じブラウザに複数の人の cookie が居る時は、受けた instance が自分の family に一致するものを値で選ぶ。綴りそのものは daemon の持ち物で、契約が持つのは「ユーザで決まり instance を含めない」という規則だけ ([DR-0020](DR-0020-auth-shape-on-the-wire.md) の境界)。

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
  instances: { instance: InstanceId, endpoint?: Endpoint, granted_at, granted_by? }[],  // granted_by は §3 の 2 形
}
```

`roles: ["user"]`、`needs_hello: true`、`scope: "role"` (答えるのは**呼び手自身の**ユーザの分だけ。他人の分を読む形は持たない)、`locality: "any_instance"`。**名前は `auth.account.read`** — 答えるのがユーザ・passkey・所有 instance の 3 つなので、どれか 1 つを名前にすると他の 2 つが付属物に見える。

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
- **`Origin` の不在は不一致**。全てのゲートを通ることが条件で、比べる物が無い呼び手は条件を満たしていない
- **`endpoint` の列は無い**。どの列にも現れないことがこの DR である
- どの検査で落ちても答えは `auth_invalid` で、どれが合わなかったかは述べない
- CORS は op で 2 通り。**`auth.register` と `auth.challenge` は全 origin に開く** — 人を作る ceremony は、その origin の credential がまだ 1 つも無い所から始まるので、照らせる集合が存在しない。守っているのは token と 6 桁と発行者の判定であって CORS ではない。**それ以外 (`auth.enroll` / `auth.assert` / `auth.token.refresh`) の許可集合は「その instance が持っている credential record の origin」**。所有で絞らないのは、この集合が「その page を知っているか」を答える物であって「その人が入ってよいか」を答える物ではないから — 後者は所有が答え、両方を CORS に負わせると、複製で credential を知っているのに所有がまだ無い instance (= enroll が成立すべきちょうどその場面) で preflight が落ちる。生きている登録 URL の origin を発行者だけが足す形は、`register` が全 origin に開いたことで要らなくなり、**消える**

## Alternatives Considered

| 案 | 内容 | 不採用理由 |
|---|---|---|
| A | mesh を束縛の単位にする (mesh id を持ち、credential をそれに縛る) | 「同じ mesh なら入れる」という 2 枚目の認可ができる。instance を 1 つ足すと全ユーザの権限が黙って広がり、外したい 1 台だけを外す操作が無い。所有 record なら足すも外すも 1 行で、mesh の形と独立している |
| B | endpoint 束縛のまま (現行) | hosting の FQDN がどの endpoint とも一致せず、HA の裏に入れない。複製した record を隣の instance が使えないので、複製の目的 (登録先が落ちていても入れる) が果たされない。Context の矛盾そのもの |
| C | credential を endpoint ごとに作る (現行の運用として受け入れる) | 1 人が instance の数だけ passkey を持ち、認証器の中で同じ人が複数アカウントとして並ぶ。増えるのは安全性ではなく人が管理する鍵の本数で、どれを消せるか分からなくなる方に効く |
| D | path mount を残す (`WebUi` を path 込みで持ち続ける) | 持てるが比べられない。browser は `Origin` にも `clientDataJSON` にも path を書かないので、同じ origin の別 path はこの契約の全ての検査で同一物になる。区別できない値を record に持つのは、区別されていると読み違える余地を作るだけ |
| E | 所有 record を持たず「mesh の全 instance を所有」と読む | A と同じ帰結を record 無しで得るだけで、外す操作がさらに無い。所有を明示的な record にすると、一覧に出せて、消せて、複製の対象になる (§8 の 3 段目がそれ) |
| F | `auth.enroll` を作らず `auth.assert` に token と 6 桁を optional で足す | 1 つの op が「入る」と「持ち物を足す」の 2 つを答えることになり、属性表からは同じ 1 行に見える。引数の有無で副作用が変わる op は、認可を表の外に置くのと同じ形をしている |
| G | `sub` を人が付ける名前のまま残す (`<unit>-<連番>`) | 名前を付けた instance が identity の所有者になる。引っ越しと HA で名前の由来が意味を失い、同じ人の 2 つの `sub` を後から 1 つにする手段が無い。人が読む名前は `display_name` として認証しない側に置けば足りる |
| H | ユーザ id と user handle を別の値にする | 同じ事実の 2 つ目の写しで、食い違えば認証器の中の人と record の人が別人になる。比較は全て文字列の一致なので、綴りを 1 つにして困る場面が無い |


## Consequences

- **人は 1 人で 1 つの identity を持つ**。3 台の instance を所有していても credential は origin と端末の数だけで、token も設定も 1 つに集まる
- **instance を mesh に足しても、その instance には誰も入れない**。所有 record を書くまでは所有者が居ない。これは意図した性質で、mesh に加わることが入口を開けないための条件 (案 A の裏返し)
- **HA の裏でも登録に順番が要らない**。どの instance に着弾しても成立するので、人は「発行した instance に当たるまで引く」ことをしない。代わりに **登録 op は全 origin から呼べる** — 守っているのは token と 6 桁と発行者の判定で、CORS はここでは何も守っていない
- **mesh をローカルに閉じたまま運用できる**。browser から見えるのは HA の住所 1 つでよく、instance 個別の endpoint はピア同士が 1 対 1 で届くためだけに要る。ピア用の住所に HA の住所を書くことはできない
- **endpoint を足す操作が無い**。新しい endpoint host に初めて繋いだ人は、cookie を貰うために 1 回 assert する。それは登録でも紐付けでもないので、記録も増えない
- **endpoint は住所に戻る**。引っ越しても credential も token も無効にならない。DR-0018 の「id を鍵にする物は endpoint の変更を跨いで生き残る」が、認証にもそのまま及ぶ
- **origin を移すことは全員の登録をやり直すこと**。ここは現行から変わらない。変わったのは endpoint 側で、そちらは動かしても登録が生きる
- **1 つの host に複数 instance を出す形が無くなる**。必要なら host を分ける。運用の制約が増えるのではなく、元々見分けられていなかった物が契約から消える
- **この束縛が防ぐのは、browser の中で別 origin の page が token を使うこと**。token が機械の外に出た後の防御ではなく、乗っ取られた自 origin の page は同じ origin なので通る。範囲は現行と同じ
- `webui` を持つ credential と token family、`sub` を持つ record は**無効**。契約は移行の形を持たない (下記)

### 後続の拡張 (本 DR では実装しない)

複製する record (credential / 所有 / family / tombstone) に **書き手の署名**を付ける拡張が、この形の上に素直に乗る。instance が初回起動で自分の署名鍵を生成して OS の鍵保管 (Keychain / Secure Enclave 等) に置き、公開鍵 (JWK) を peers に配り、自分が書いた record に署名する。得るのは **mesh 内の帰属と改竄検知** — 1 台が乗っ取られても、その instance は他 instance の名で record を書けず、複製されてきた record がどの instance の手による物かが受け側で確かめられる。得ないのは **乗っ取られた instance 自身の全権**で、そのプロセスが自分の鍵で署名できる以上、その場で自分の名において濫用することは防げない。信頼の根が「その instance をローカルで操作できる者」であることは本 DR から変わらない。

やるべきなのは、この拡張が **`signature` 欄 1 つの追加 (minor) で済む形に record を保っておくこと**で、そのためには **record の正規化された表現** (署名対象のバイト列をどう作るか) を決めておく必要がある。決め方自体は後続の判断に譲るが、`signature` を持つ record が「自分自身を除いた残り」を対象に署名する形になるので、フィールドを 1 つ足すことが既存の署名を壊さない並びであること — それだけをここで意図しておく。

### 現行 DR との対応

| 現行の判断 | 本 DR で |
|---|---|
| **DR-0020**: 契約が持つのは線上の形だけ、手順は daemon | 残る |
| DR-0020: 認証 op は HTTP で運び、属性表には載る | 残る (`auth.enroll` と `auth.account.read` が増える。後者は WS の op) |
| DR-0020: `needs_hello: false`、提供場所は `<endpoint>auth/*` | 残る |
| DR-0020: `RegisterClaims.endpoint` が base URL を名指す | **置き換わる** — `EnrollClaims.endpoint` は宛先で、照合しない |
| DR-0020: `auth.extend` は WS の op | 残る |
| DR-0020: `auth.resolve` / `auth.rotate` は発行者へ転送 | resolve は残る (`register` kind が `claims` kind に)。rotate の転送は **消える** — 所有されているどの instance でも書ける |
| DR-0020: record は `auth.records` topic で複製、kv には載せない | 残る (載る record に `user` と `ownership` が増える) |
| DR-0020: retired は digest で持つ | 残る |
| **DR-0021**: 6 桁を別経路で要求する | 残る (`auth.enroll` にも同じく必須) |
| DR-0021: どちらの半分が失敗したかを述べない | 残る |
| DR-0021: 6 桁を判定するのは発行者だけ | 残る |
| DR-0021: challenge は発行者と一緒に旅する | 残る |
| DR-0021: claims が `user_id` を運び、page に決めさせない | **置き換わる** — ユーザに 1 つの値で、`create_user` の claims だけが運ぶ |
| **DR-0028**: refresh は HttpOnly cookie、本文に出さない | 残る |
| DR-0028: 分割された cookie (CHIPS) を前提とする | 残る |
| DR-0028: cookie の属性は webui と endpoint が same-site かで決まる | **置き換わる** — 判定は credential の `origin` と endpoint の間で行う |
| DR-0028: identity を決める op は `Origin` と `Sec-Fetch-Site` を見る | 残る (`auth.enroll` が加わって 4 op) |
| DR-0028: `auth.challenge` はこの 2 つを見ない | 残る |
| DR-0028: 断り方は `auth_invalid` で、どのヘッダかは述べない | 残る |
| **現行の credential 束縛**: endpoint と webui の 2 つに縛られる | **置き換わる** — `origin` 1 つ。instance は所有で決まる |
| 現行: endpoint 束縛 (base URL の下に届いた時だけ受ける) | **消える** |
| 現行: 保持は URL、比べるのは origin | **消える** — origin を持つので導出が無い |
| 現行: `originOf` / `rpIdOf` と `WebUi` 型 | **消える** — `Origin` 型 1 つに戻る |
| 現行: relying party は host に固定する | 残る (origin の host) |
| 現行: 登録 URL は webui と発行者の endpoint を名指す | **置き換わる** — origin (人を送る先) と endpoint (宛先)、そして渡す instance 全部を名乗る |
| 現行: token family は credential の webui を引き継ぐ | **置き換わる** — `origin` を引き継ぐ |
| 現行: WS の handshake は `Origin` と照合する | 残る (加えて所有を照らす) |
| 現行: `Origin` の不在は不一致 | 残る |
| 現行: CORS は登録済み credential の origin + 生きている登録 URL の origin | **置き換わる** — 前者は「所有者たちの credential の origin」になり、後者は登録 op を全 origin に開くことで不要になる |
| 現行: 新しい webui での最初の登録は発行者に届いた時だけ通る | **置き換わる** — どの instance に着弾しても成立し、発行者に問うのは token と 6 桁だけ |
| 現行: cookie の名前が instance を含む | **置き換わる** — ユーザで決まり、instance を含めない (§5) |
| 現行: 認証しない手掛かりを持つ / それで判定しない | 残る |
| 現行: webui の `connect-src` は契約の外 | 残る |
| **daemon DR-0001** §2.2 登録はローカルからしかできない | 残る。「所有者を足す」経路が 1 本増える |
| daemon DR-0001 §2.3 credential が何に縛られるか | **置き換わる** (既に委譲済みの節) |
| daemon DR-0001 §2.4 family は `sub` を持ち単一 writer | **置き換わる** — `sub` は `user` になり、単一 writer は無くなる (所有されているどの instance でも rotate できる) |
| daemon DR-0001 §2.6 tombstone は sub 単位 | **置き換わる** — key が対象を言い、user / credential / ownership / family の 4 種になる |
| daemon DR-0001 §2.7 人の入口はパスの末尾で照合する | 残る。path mount を持たないので、prefix の下に別 instance が居る形は無くなる |

**DR-0020 / DR-0021 / DR-0028 は立ったまま**で、上表の「置き換わる」行だけを本 DR が上書きする。daemon 側 DR の追従は daemon リポの作業。

### 移行

既存の record は**作り直す**。移行コードは書かない。この契約は世代を 1 つしか持たず互換経路を持たない ([DR-0017](DR-0017-one-generation-no-compatibility-path.md)) し、今この mesh を使っている人は kawaz 1 人なので、失われるのは再登録 1 回分の手間だけである。旧 record を消す手順は daemon の作業。

## 裁定の記録

Decision の内容は下記の裁定を織り込んだ後の姿で、ここは問いと答えだけを残す (kawaz 裁定 2026-09-18)。

**Q1. rotate をどこでもできるようにするか** (§5) — **どこでもできる**。所有されているどの instance でも family を書ける。並行 rotate が競合した時、負けた側の値は family のどの世代にも無い値になり、`auth_invalid` で断るだけで family は失効させない (失効は `retired` に一致した時 = replay の時だけ)。その端末は passkey でサインインし直す。猶予を広げて見分けようとはしない。

**Q2. 一覧 op の名前** (§8) — **`auth.account.read`**。

**Q3. 所有を外す操作を誰が持つか** (§3) — **CLI と認証済みチャンネルの両方**。ただし今繋いでいる instance の自分の所有は外せない。(kawaz 裁定 2026-09-18: 線上は `auth.ownership.remove` / `auth.credential.remove`、`roles: ["user"]` / `scope: "role"`、断りは `auth_in_use`。)

**Q4. `display_name` をユーザが持つか** (§1) — **持つ**。

**Q5. 1 つの instance が複数の所有者を持ってよいか** (§3) — **よい**。

**Q6. `auth.enroll` でも 6 桁を要るか** (§4) — **要る**。

## 付録: daemon に渡すもの

本 DR は wire の形しか決めない ([DR-0020](DR-0020-auth-shape-on-the-wire.md) の境界)。手順の側で daemon が持つ項目を、契約が何を言っているかと合わせて並べる。daemon リポの追従作業はこの表を指示書として使う (起票は契約側の作業ではない)。

| 項目 | 契約 / 本 DR が言うこと | daemon 側の現状 (DR-0001) |
|---|---|---|
| 「今使っているか」の判定 (`auth_in_use`) | 判定は daemon。契約は code を 1 つ持つだけ | 無し。「今の接続の instance」「この session が assert した credential」の定義から要る |
| cookie の名前 | `__Secure-ccmsg-<digest(user id)>`、instance を含めない (§5)。綴りは daemon | §2.4 が `sha256(instance id + "\n" + sub)`。**矛盾** |
| rotate の writer と競合 | 所有されているどの instance でも書ける。負けた側の値は family が知らない値として `auth_invalid`、family は失効させない (§5) | §2.4 が「単一 writer で LWW 衝突を避ける」。**矛盾** |
| 所有の再付与と tombstone | granting ごとに id を持ち、外す = その granting の tombstone、足し直す = 新しい granting (§3) | 無し。§2.6 の tombstone は sub 単位 |
| `owner add <user>` / `--all` の CLI | 経路として §4 (b) が決めている。線上には record の形しか現れない | 無し |
| 既に所有者である人の `auth.enroll` | **成功、ownership を増やさない** (§4)。契約が決めているので daemon は従うだけ | 無し |
| 最後の credential を消した時 | 契約は禁じない。消えた credential で始まった family をどうするかは daemon (issue `passkey-list-for-people` の残論点) | §2.5 は「該当 sub の family を全部失効」で sub 前提 |
| user の tombstone | ユーザを消す op を契約は持たない。key (`user/<user>`) だけが用意されている | 無し |
| 6 桁の試行回数の上限 | 発行者だけが数える ([DR-0021](DR-0021-registration-in-two-halves.md)) | §2.10 にあり。現状維持 |
| ヘッダと ceremony の検査手順 | §9 の表。`Origin` は登録 URL (register / enroll) か credential (assert / refresh) の origin と比べる | §2.5 が endpoint の origin と比べる旧手順。**要更新** |
| CORS の 2 通り | `register` / `challenge` は全 origin、`enroll` / `assert` / `refresh` はその instance が持つ credential record の origin (§9) | §2.4 が「credential の webui + 生きている登録 URL」。**要更新** |
| WS upgrade で所有を照らす | §9 の表の `WS upgrade` 行 | 無し |
| 旧 record の削除 (移行) | 作り直す。移行コードは書かない (「移行」節) | 無し |

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は instance の住所であり、id は移転を跨ぐ
- [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) — 転送された要求は宛先で認可し直す
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — 認証 op の carrier と record の複製経路
- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録の 2 経路と、発行者だけが判定すること
- [DR-0028](DR-0028-refresh-cookie-across-sites.md) — refresh cookie と、認証 op が見るヘッダ
- `docs/issue/2026-09-09-passkey-list-for-people.md` — 認証済みチャンネルからの passkey の add / remove
- `docs/issue/2026-09-10-token-family-bound-to-endpoint.md` — token family の endpoint 束縛 (本 DR が採らない方向)
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — WebAuthn の検証と cookie / carrier の手順の正本
- `docs/DESIGN.md` §Authenticating a person
