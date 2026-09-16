# DR-0027: webui の URL は instance の endpoint と別物で、credential は作られた 1 つの webui を持つ

- Status: Active
- Date: 2026-09-16

## Context

人が webui を開いている URL は、これまで接続先 instance の endpoint そのものだった。別の site から配られた webui が instance に繋ぐことを認めると、信頼の向きが裏返る — 今は「endpoint が配った webui を信じる」だが、分ければ「どこかから読み込んだ page に自分の instance の token を渡す」ことになる。

browser が述べる `Origin` が言えるのは **その page がどの site から来たか**だけで、それは page の script に偽装できない。言えないのは、その site が本人の webui かどうか。token は人を識別するが page を識別しないので、token だけでは「本人の browser が、本人の知らない page から繋いでいる」を区別できない。

層ごとに効く物も違う。WS の upgrade に CORS は効かず、browser は `Origin` を送るだけで、認証は token が行う (契約はこれまで `Origin` を見ていなかった)。HTTP で運ぶ認証 op ([DR-0020](DR-0020-auth-shape-on-the-wire.md)) には CORS が効く。

## Decision

- **webui の URL と endpoint は別の値**で、どちらも base URL。`WebUi` は webui が mount されている URL (path まで含み、末尾スラッシュ必須)、`Endpoint` は instance のそれ ([DR-0018](DR-0018-instance-id-apart-from-endpoint.md))。どちらも **1 つの場所に綴り方が 1 つ**になるよう型で縛る (末尾スラッシュ必須、host は小文字、既定 port は綴らない、punycode 済み)。`WebUi` はさらに **origin を必ず導ける**ことが型の責務 — 導出が例外になる値や、導いた結果が `Origin` の外に出る値を通せば、「URL を正本に毎回導く」形が record を受理した後で破れる
- **保持する単位は URL、比べる単位は origin**。この 2 つは違う。path まで持つのは、それが **人を送る先** (登録 URL) であり、**運用者が設定する形**であり、**人が自分の一覧で見分ける形**だから。一方、契約が行う照合は `clientDataJSON.origin` / `Origin` ヘッダ / CORS の許可集合 / `rpIdHash` の 4 つで、**どれも origin (または host) 粒度**でしか比べられない — browser は `Origin` にも `clientDataJSON` にも path を書かないので、path で比べる材料が線上に無い。**同じ origin に載る別 path の webui は、この契約では区別されない**
- **`Origin` と比べる値は URL から導く** (`originOf`)。origin は URL の scheme + authority で、browser が `Origin` ヘッダと `clientDataJSON.origin` に綴る形。record が持つのは **URL の側**で、origin を隣に併記しない — 人を送る先は URL であって、2 つ持てば食い違いうる 1 つの事実になる。導出の正規化 (小文字、既定 port の省略、address literal) は契約の関数 1 つが正本
- **credential record は作られた webui を 1 つ持ち、その origin でしか使えない**。これは WebAuthn が強いる形ではなく **契約が定める方針**で、認可の実体は「ceremony の `clientDataJSON.origin` が record (登録では登録 URL の claims) の webui から導いた origin と一致すること」。WebAuthn の `rpId` 束縛だけなら同じドメインの下の別 origin からも使えてしまうので、それに任せず契約が 1 つの origin に絞る。別の origin の webui を使う人は credential を 2 つ持つ
- **relying party も webui の URL から導く** (`rpIdOf` = その host)。origin と同じ理由で record にも claims にも持たない — 同じ URL から決まる値を別に持てば、食い違いうる写しが増えるだけ。client は rpId を page の origin に照らす (effective domain かその registrable suffix) ので、host と一致させておけば契約の照合 (`clientDataJSON.origin`) と認証器の束縛 (`rpIdHash`) が同じ 1 つの site を指す。daemon は authenticator data の `rpIdHash` を「webui の host の SHA-256」と比べる。endpoint の host は一切関与しない
- 登録 URL の claims も webui を運ぶ。**登録 URL は webui を名指して発行される** — 人をどこへ送るかがまさにその URL であり、名指さない登録 URL は誰も開けない
- token family は認証された webui を持ち、**WS の handshake は token の webui から導いた origin と `Origin` ヘッダの一致で通す**。読むのは「この token を作った page と同じ site から来たか」の 1 点。WS で `Origin` を読むのはここだけで、HTTP の認証 op が読む分は [DR-0028](DR-0028-refresh-cookie-across-sites.md)
- **`Origin` の不在は不一致**。WS の upgrade でも HTTP の 3 op でも同じで、ヘッダを付けない呼び手を通す例外を置かない。**全てのゲートを通ることが条件**であり、比べる物が無い呼び手は条件を満たしていない呼び手。person の token を提示する接続は browser の page からしか来ない (CLI は到達そのものが権限の Unix socket を使う)
- 一致しない handshake は **接続が成立しない** (upgrade の拒否) で、frame の error ではない。access token は挨拶の引数ではなく upgrade を受けた carrier が持つ物なので、断る時点でまだ frame を運ぶ接続が無い
- **登録 URL は発行 instance 自身の endpoint を名指し、登録はその instance に届く**。URL の secret も 6 桁の試行回数もそこにしか無いので、登録が成立するのは発行者に届いた時だけ ([DR-0021](DR-0021-registration-in-two-halves.md))
- HTTP の認証 op は、**その endpoint に登録済みの credential の webui から導いた origin の集合**と、**その instance 自身が発行してまだ生きている登録 URL の webui から導いた origin** で CORS に答える。後者は **複製しない** — 発行者の手元にしか無く、発行者だけが答えればよい。許可一覧を設定にも管理 UI にも持たない、登録した場所がそのまま許可という形はこれで保たれ、**新しい webui での最初の 1 件も発行者に届けば通る**
- HTTP の認証 op がどの束縛で落ちても、答えは既存の `auth_invalid` で、どれが合わなかったかは述べない ([DR-0021](DR-0021-registration-in-two-halves.md) と同じ理由)
- credential の **endpoint 束縛はそのまま残る** ([DR-0022](DR-0022-credential-bound-to-an-endpoint.md))。webui は「どの page から来てよいか」、endpoint は「どの instance に入ってよいか」で、答えている問いが違う
- 契約が持たないもの: webui 自身の `connect-src` allowlist。「この page がどの instance に繋いでよいか」は page を配る側の宣言であって線上の形ではなく、webui リポの責務

## Alternatives Considered

- 案 B: 分けない (endpoint が配る webui だけを認める)
  - 不採用理由: instance ごとに webui を配る以外の運用ができない。1 つの site から複数 instance を見る形が、線上の形を変えずに済むのに閉じたままになる
- 案 C: 分けるが origin を束縛せず token だけで認める
  - 不採用理由: 漏れた token を別 origin の page から使える経路が残る。token は人を識別するだけで、どの page が持っているかを言わない
- 案 D: 許可する origin の一覧を instance の設定に持たせる
  - 不採用理由: credential が既に 1 つの webui を持つので、一覧はその写しにしかならない。同じ事実が 2 箇所に綴られ、食い違えば設定の側が入口を増やす
- 案 E: endpoint 束縛をやめて origin 束縛に置き換える
  - 不採用理由: 1 つの origin に同居する隣の instance への入口になる ([DR-0022](DR-0022-credential-bound-to-an-endpoint.md) 案 A と同じ)
- 案 F: relying party に host の suffix (`a.example.com` の credential に `example.com`) を許し、登録時に決めた値を record / claims に固定して持つ
  - 不採用理由: WebAuthn は suffix を許すが、許した瞬間に同じ suffix の下の別 origin から同じ credential で ceremony が走る。契約の側で `clientDataJSON.origin` を照合すれば断れるものの、認証器の束縛と契約の方針が食い違ったまま並ぶことになり、片方だけを見た実装が緩い方に倒れる。**値を持たせること自体がこの案の帰結**でもある — host に固定するなら webui の URL から毎回導けるので、持つ意味があるのは「URL から導けない値を選べる」時だけであり、それはまさに緩める時。導出にすれば両者が食い違う状態を表現できない
- 案 G: 生きている登録 URL を mesh に複製し、どの instance でも「その origin は登録の途中か」を答えられるようにする
  - 不採用理由: 複製する record が 1 種増え、未消費の登録という短命な状態が mesh 全体に配られる。答えられる instance を増やしても、登録そのものは発行者にしか成立しない (secret も試行回数もそこにある) ので、増えるのは「CORS だけ通って登録は断られる」経路。発行者が自分の分だけ答えれば足りる

## Consequences

- 別の origin の webui から使う人は、origin ごとに登録する。webui を別の origin へ移すことは、全員の登録をやり直すこと (同じ origin の中で path を動かすだけなら、契約は何も見ていないので登録は生きたまま)
- instance が答える CORS の集合は、人が登録するたびに増える。これは設定の変更ではなく登録の結果なので、増やす操作も減らす操作も credential の追加と削除しかない
- この束縛が防ぐのは、**browser の中で別 origin の page が token を使うこと**。token が機械の外に出た後の防御ではないし、乗っ取られた自 origin の page も (同じ origin なので) 通る。防ぐ範囲を取り違えないこと
- `webui` を持たない credential と token family は **無効**。契約は移行の形を持たず、人は登録し直す (旧 record を消す手順は daemon の作業)
- 新しい webui での最初の登録は、**発行者に届いた時だけ**通る。load balancer の下で別の instance に落ちれば、その instance はまだその origin を知らないので CORS で断る。`auth.resolve` による転送が消えるわけではない (同じ endpoint に既にその origin の credential があれば、どの instance でも CORS は通り、判定だけが発行者に転送される)

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は path まで含めて比べる
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — HTTP で運ぶ 4 op と record の複製経路
- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録 URL の claims と、失敗の述べ方
- [DR-0022](DR-0022-credential-bound-to-an-endpoint.md) — credential の endpoint 束縛
- [DR-0028](DR-0028-refresh-cookie-across-sites.md) — site をまたいだときの refresh cookie
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md` — 手順の正本。`rp_id` と `clientDataJSON.origin` を endpoint から導く §42 と、webui を endpoint と別 site に置く構成を非対応とする §55 は本 DR が置き換える (daemon 側の DR 更新が要る)
- `docs/DESIGN.md` §Authenticating a person
