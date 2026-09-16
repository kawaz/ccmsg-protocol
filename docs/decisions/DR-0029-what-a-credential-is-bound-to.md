# DR-0029: credential は endpoint と webui の 2 つに縛られ、比べる値はどちらも URL から導く

- Status: Active — ✅ 実装済
- Date: 2026-09-16

## Context

passkey は人の identity を決める。では、登録された 1 つの credential は **何に対して**有効なのか。

3 つの単位が絡む。**authenticator が知る単位**は `rpId` = ドメインで、これが一番粗い。**instance の単位**は endpoint で、1 つの host に複数の instance が同居しうるから host より細かい ([DR-0018](DR-0018-instance-id-apart-from-endpoint.md))。**page の単位**は webui が publish されている origin で、webui は endpoint と別の origin から配られてよい。

authenticator の言い分だけに従うと、粗い方に合わせて受け入れることになる: ある instance に登録した鍵が隣の instance への入口になり、同じドメインの下の任意の page が ceremony を走らせられる。さらに、認証の後に残る token は「誰か」を言うだけで「何が持っているか」を言わないので、漏れた token はどの page からでも使える。

browser が述べる `Origin` は **その page がどの origin から来たか**を偽装なしに言う (page の script には書き換えられない)。言えないのは、その origin が本人の webui かどうか。だから `Origin` は、**こちらが先に「どこで作られた credential か」を覚えている時だけ**意味を持つ。

そして `Origin` が効く範囲は **browser の中だけ**。ヘッダを付けるのは browser であって、browser の外の呼び手は任意のヘッダを組み立てられる。つまりここで閉じられるのは「**同じ browser の中で、別 origin の page が token を使う**」経路であって、token が機械の外に持ち出された後ではない。後者に対しては、この契約のどの束縛も何もしない。

## Decision

### 何に縛るか

- credential は **2 つの値に縛られる**。`endpoint` = **どの instance に入ってよいか**、`webui` = **どの page から来てよいか**。答えている問いが違うので、片方が他方を代替しない。record は両方を持つ
- **endpoint 束縛**: assertion は登録された endpoint でだけ受ける。要求が届いた URL の scheme + authority が endpoint のそれと一致し、path がその base URL の下にあること。`https://h/` と `https://h/personal/` は 2 つの endpoint で、1 つの host・1 つの `rpId` であっても 2 つの登録を要する。**base URL に縛ることが、隣の instance への入口を塞ぐ**
- **webui 束縛**: ceremony が走ってよいのは登録された webui の origin だけ。認可の実体は「`clientDataJSON.origin` が record (登録では登録 URL の claims) の webui から導いた origin と一致すること」で、これは登録でも assertion でも同じ

### 何を持ち、何を導くか

- **保持する単位は URL、比べる単位は origin**。webui は base URL (path 込み、末尾スラッシュ必須) として持つ — それが **人を送る先** (登録 URL) であり、**運用者が設定する形**であり、**人が自分の一覧で見分ける形**だから。一方この契約が行う照合は `clientDataJSON.origin` / `Origin` ヘッダ / CORS の許可集合 / `rpIdHash` の 4 つで、**どれも origin か host の粒度**でしか比べられない (browser は `Origin` にも `clientDataJSON` にも path を書かない)。**同じ origin に載る別 path の webui は、ここでは区別されない**
- origin (`originOf`) と relying party (`rpIdOf` = その host) は **URL から毎回導き、record にも claims にも併記しない**。同じ URL から決まる値を別に持てば、食い違いうる写しが増えるだけ。導出の正規化 (小文字、既定 port の省略、address literal) は契約の関数 1 つが正本
- `Endpoint` と `WebUi` はどちらも base URL で、**1 つの場所に綴り方が 1 つ**になるよう型で縛る (末尾スラッシュ必須、host は小文字、既定 port は綴らない、punycode 済み)。`WebUi` はさらに **origin と relying party を必ず導ける**ことが型の責務 — 導出が例外になる値や、導いた結果が `Origin` の外に出る値を通せば、record を受理した後で読み出しが壊れる。そのため `WebUi` は **ceremony が成立しうる URL だけ**を通す (`https`、または browser が信頼する loopback 名の `http`。host に address literal は取れない — secure context と「relying party は domain」という authenticator 側の条件で、ここを通る値が「どの credential も作れなかった URL」にならないようにする)。`Endpoint` は relying party ではないので、この制限は掛けない
- **relying party は record にも claims にも持たず、webui の host に固定する** (`rpIdOf`)。`rpId` は host の suffix でもよい (それが WebAuthn の許す幅) が、広く取れば `a.example.com` の credential が `b.example.com` から出せることになる。**1 つの origin に縛るのは WebAuthn が強いる形ではなく契約の方針**であり、host に固定するのは認証器側の束縛を同じ幅に揃えて、片方だけを見た実装が緩い方に倒れないようにするため。daemon は authenticator data の `rpIdHash` を「webui の host の SHA-256」と比べ、**到達した endpoint の host は一切関与しない**

### いつ照らすか

- **登録 URL は 2 つを名指す**。人を送る先の webui (名指さない URL は誰も開けない) と、**発行者自身の endpoint**。URL の secret も 6 桁の試行回数も発行者にしかないので、**登録が成立するのは発行者に届いた時だけ** ([DR-0021](DR-0021-registration-in-two-halves.md))
- **token family は認証された credential の webui を引き継ぐ**。WS の handshake は、その webui から導いた origin と `Origin` ヘッダの一致で通す。読むのは「この token を作った page と同じ origin から来たか」の 1 点。**WS で `Origin` を読むのはこの handshake だけ** — upgrade に CORS は効かず browser は `Origin` を送るだけなので、契約が自分で見る。接続が立った後の frame 上の op では見ない。CORS が効く HTTP 側で何を見るかは [DR-0028](DR-0028-refresh-cookie-across-sites.md)
- **`Origin` の不在は不一致**。WS の upgrade でも、HTTP で identity を決める 3 op でも同じで、ヘッダを付けない呼び手を通す例外を置かない。**全てのゲートを通ることが条件**であり、比べる物が無い呼び手は条件を満たしていない。「person の token を提示する接続は browser の page からしか来ない」は **観測ではなく契約が置く前提** — CLI は到達そのものが権限の Unix socket を使うので、person の token を要る場面がそもそも無い。前提である以上、それを満たさない呼び手を見分けて通す仕組みは用意せず、ヘッダが無ければ断る
- 一致しない handshake は **接続が成立しない** (upgrade の拒否) で、frame の error ではない。access token は挨拶の引数ではなく upgrade を受けた carrier が持つ物なので、断る時点でまだ frame を運ぶ接続が無い
- HTTP の認証 op は、**その endpoint に登録済みの credential の webui から導いた origin の集合**と、**その instance 自身が発行してまだ生きている登録 URL の webui から導いた origin** で CORS に答える。後者は **複製しない** — 発行者の手元にしかなく、発行者だけが答えればよい。許可一覧を設定にも管理 UI にも持たない (登録した場所がそのまま許可) 形はこれで保たれ、新しい webui での最初の 1 件も発行者に届けば通る。どのヘッダを見るかと断り方は [DR-0028](DR-0028-refresh-cookie-across-sites.md)
- どの束縛で落ちても、HTTP の答えは既存の `auth_invalid` で、どれが合わなかったかは述べない ([DR-0021](DR-0021-registration-in-two-halves.md) と同じ理由)

### 縛らないもの

- credential record は **認証しない手掛かり**も持つ: 登録 URL に管理者が書いた `issued_label`、本人が書いた `device_label`、登録時と最終使用時の住所と user agent、authenticator data の BE / BS (`backup_eligible` / `backup_state`)。token family の `last_refresh` (いつ・どこから・client が述べた `reason`) も同じ種類の物。**これらは何も認証せず、何も決めない** — 住所は要求する側が自由に選べるし、`reason` は無検査の申告で、**述べない refresh も述べる refresh と同じく有効**。あるのは **見分けるため**で、自分の一覧を読む本人が「自宅の回線で、いつも使う browser だから自分の行だ」と置ける、あるいは置けずに削除できる、という判断のためだけに置く
- 契約が持たないもの: webui 自身の `connect-src` allowlist。「この page がどの instance に繋いでよいか」は page を配る側の宣言であって線上の形ではなく、webui リポの責務

## Alternatives Considered

| 案 | 内容 | 不採用理由 |
|---|---|---|
| A | endpoint から path を落とした scheme + authority に縛る | そこに同居する隣の instance への入口になる |
| B | 到達した endpoint の host で `rpIdHash` を比べる | passkey は作られたドメインにしか答えない。到達先の host と一致する保証が無い |
| C | webui と endpoint を分けない (endpoint が配る webui だけを認める) | instance ごとに webui を配る以外の運用ができない。1 つの origin の webui から複数 instance を見る形が、線上の形を変えずに済むのに閉じたままになる |
| D | 分けるが webui を縛らず token だけで認める | 同じ browser の中で、漏れた token を別 origin の page から使える経路が残る。token は人を識別するだけで、どの page が持っているかを言わない。browser の外に出た token はどの案でも防げないが、それは閉じられる経路を開けたままにする理由にならない |
| E | 許可する origin の一覧を instance の設定に持たせる | credential が既に webui を持つので、一覧はその写しにしかならない。同じ事実が 2 箇所に綴られ、食い違えば設定の側が入口を増やす |
| F | `rpId` に host の suffix を許し、登録時に決めた値を record / claims に固定して持つ | WebAuthn は suffix を許すが、許した瞬間に同じ suffix の下の別 origin から同じ credential で ceremony が走る。値を持たせること自体がこの案の帰結でもある — host に固定するなら URL から毎回導けるので、持つ意味があるのは「URL から導けない値を選べる」時だけであり、それはまさに緩める時。導出にすれば、両者が食い違う状態をそもそも表現できない |
| G | 生きている登録 URL を mesh に複製し、どの instance でも CORS に答えられるようにする | 複製する record が 1 種増え、未消費の登録という短命な状態が全体に配られる。登録自体は発行者にしか成立しないので、増えるのは「CORS だけ通って登録は断られる」経路 |
| H | 手掛かり (住所・BE / BS 等) を持たない | 人は自分の一覧の行を自分の物だと置けず、身に覚えの無い行を見分けて消すこともできない |
| I | 手掛かりで受け入れを判定する | どれも要求する側が自由に決められる値で、判定の根拠にすると自由入力が認可になる |

## Consequences

- 1 つの host で複数の instance を運用する場合、人は **instance ごとに**登録する。別の origin の webui から使う場合も **origin ごとに**登録する。同じ origin の中で webui の path を動かすだけなら、契約は何も見ていないので登録は生きたまま
- webui を別の origin へ移すことは、全員の登録をやり直すこと
- instance が答える CORS の集合は、人が登録するたびに増える。設定の変更ではなく登録の結果なので、増やす操作も減らす操作も credential の追加と削除しかない
- 新しい webui での最初の登録は、**発行者に届いた時だけ**通る。load balancer の下で別の instance に落ちれば、その instance はまだその origin を知らないので CORS で断る。`auth.resolve` による転送が消えるわけではない — 同じ endpoint に既にその origin の credential があれば、どの instance でも CORS は通り、判定だけが発行者に転送される
- この束縛が防ぐのは、**browser の中で別 origin の page が token を使うこと**。token が機械の外に出た後の防御ではないし、乗っ取られた自 origin の page は同じ origin なので通る。防ぐ範囲を取り違えないこと
- `webui` を持たない credential と token family は **無効**。契約は移行の形を持たず、人は登録し直す (旧 record を消す手順は daemon の作業)
- 手掛かりの追加は認可に影響しないので、増やす判断は「人が見分けられるか」だけで決まる

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は path まで含めて比べる
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — HTTP で運ぶ 4 op と record の複製経路
- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録の 2 経路と、発行者だけが判定すること
- [DR-0028](DR-0028-refresh-cookie-across-sites.md) — site をまたいだときの refresh cookie と、認証 op が見るヘッダ
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — WebAuthn の検証と cookie / carrier の手順の正本
- `docs/DESIGN.md` §Authenticating a person
