# DR-0027: page の origin は instance の endpoint と別物で、credential は作られた 1 つの origin を持つ

- Status: Active
- Date: 2026-09-16

## Context

人が webui を開いている URL は、これまで接続先 instance の endpoint そのものだった。別の site から配られた webui が instance に繋ぐことを認めると、信頼の向きが裏返る — 今は「endpoint が配った webui を信じる」だが、分ければ「どこかから読み込んだ page に自分の instance の token を渡す」ことになる。

browser が述べる `Origin` が言えるのは **その page がどの site から来たか**だけで、それは page の script に偽装できない。言えないのは、その site が本人の webui かどうか。token は人を識別するが page を識別しないので、token だけでは「本人の browser が、本人の知らない page から繋いでいる」を区別できない。

層ごとに効く物も違う。WS の upgrade に CORS は効かず、browser は `Origin` を送るだけで、認証は token が行う (契約はこれまで `Origin` を見ていなかった)。HTTP で運ぶ認証 op ([DR-0020](DR-0020-auth-shape-on-the-wire.md)) には CORS が効く。

## Decision

- **page の origin と endpoint は別の値**で、別の型を持つ。`Origin` は scheme と authority だけ (path も末尾スラッシュも持たない)、`Endpoint` は path まで含む base URL ([DR-0018](DR-0018-instance-id-apart-from-endpoint.md))。比較の単位が違う物を 1 つの型で綴らない
- **credential record は作られた origin を 1 つ持つ**。passkey は `rpId` に束縛され、登録も認証も `rpId` が page の origin のドメインと一致する page でしか走らない — つまり credential ごとに origin は 1 つしかありえない。2 つの hosting site を使う人は credential も 2 つ持つ。`clientDataJSON.origin` は ceremony のたびに検証されるので、record に origin を書くのは **WebAuthn が既に持っている束縛を索引に写すだけ**であり、新しい判定を足してはいない
- 登録 URL の claims も origin を運ぶ。URL は hosting site を指して作られるので、`rp_id` はその **origin の host の登録可能な suffix** であって、endpoint の host からは導かない
- token family は認証された origin を持ち、**WS の handshake は token の origin と `Origin` ヘッダの一致で通す**。契約が `Origin` を読むのはここだけで、読むのは「この token を作った page と同じ site から来たか」の 1 点
- HTTP の認証 op は、**その endpoint に登録済みの credential の origin と、まだ生きている登録 URL が名指す origin** で CORS に答える。許可一覧を設定にも管理 UI にも持たない — 登録した場所がそのまま許可であり、登録 URL が origin を運ぶことで最初の 1 つも同じ規則で答えられる
- どの束縛で落ちても答えは既存の `auth_invalid` で、どれが合わなかったかは述べない ([DR-0021](DR-0021-registration-in-two-halves.md) と同じ理由)
- credential の **endpoint 束縛はそのまま残る** ([DR-0022](DR-0022-credential-bound-to-an-endpoint.md))。origin は「どの page から来てよいか」、endpoint は「どの instance に入ってよいか」で、答えている問いが違う
- 契約が持たないもの: webui 自身の `connect-src` allowlist。「この page がどの instance に繋いでよいか」は page を配る側の宣言であって線上の形ではなく、webui リポの責務

## Alternatives Considered

- 案 B: 分けない (endpoint が配る webui だけを認める)
  - 不採用理由: instance ごとに webui を配る以外の運用ができない。1 つの site から複数 instance を見る形が、線上の形を変えずに済むのに閉じたままになる
- 案 C: 分けるが origin を束縛せず token だけで認める
  - 不採用理由: 漏れた token を別 origin の page から使える経路が残る。token は人を識別するだけで、どの page が持っているかを言わない
- 案 D: 許可する origin の一覧を instance の設定に持たせる
  - 不採用理由: credential が既に 1 つの origin を持つので、一覧はその写しにしかならない。同じ事実が 2 箇所に綴られ、食い違えば設定の側が入口を増やす
- 案 E: endpoint 束縛をやめて origin 束縛に置き換える
  - 不採用理由: 1 つの origin に同居する隣の instance への入口になる ([DR-0022](DR-0022-credential-bound-to-an-endpoint.md) 案 A と同じ)

## Consequences

- 2 つの hosting site から使う人は、site ごとに登録する。webui を配る site を変えることは、全員の登録をやり直すこと
- instance が答える CORS の集合は、人が登録するたびに増える。これは設定の変更ではなく登録の結果なので、増やす操作も減らす操作も credential の追加と削除しかない
- `Origin` を送らない client (非 browser) は、この束縛の対象ではない — token の origin と比べる物が無い経路は、そもそも browser の同一生成元規則の外にある

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は path まで含めて比べる
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — HTTP で運ぶ 4 op と record の複製経路
- [DR-0021](DR-0021-registration-in-two-halves.md) — 登録 URL の claims と、失敗の述べ方
- [DR-0022](DR-0022-credential-bound-to-an-endpoint.md) — credential の endpoint 束縛
- [DR-0028](DR-0028-refresh-cookie-across-sites.md) — site をまたいだときの refresh cookie
- `docs/DESIGN.md` §Authenticating a person
