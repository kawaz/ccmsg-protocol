# DR-0021: 登録は URL と 6 桁を別経路で要求し、判定は発行者だけが行う

- Status: Active — ✅ 実装済。一部を [DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md) が上書き (claims が運ぶ `user_id`。§「現行 DR との対応」参照)
- Date: 2026-09-14

## Context

登録 URL は人の手に渡る。URL を持っていることだけが条件なら、その URL が漏れた時点で登録できてしまう。また load balancer の下では、challenge を発行した instance、登録 URL を作った instance、登録要求を受けた instance が別々でありうる。

## Decision

- `auth.register` は URL の token に加えて、**コマンドラインが表示した 6 桁**を必須の引数として取る。2 つの半分が別々の経路で人に届くことが「URL の所持だけでは足りない」の実体であり、契約はそれを必須引数として述べる。数字を URL に含めない
- 誤った数字と使い切った URL は、どちらも既存の `auth_invalid` / `auth_expired` で答え、**どちらの半分が失敗したかは述べない**
- 6 桁を判定するのは **発行者だけ**。受け手は `auth.resolve` の `register` に token と並べて転送し、何も決めない。受け手が判定すれば、攻撃者は試行を複数の instance に分散でき、どこも数えない
- 登録は challenge と一緒に **発行者**を運ぶ (assertion も同じ)。値は `client_data_json` の中にもあるが、「誰がそれを使ってよいか」は入っていない。このフィールドが任意なので、受け手は値だけを持ち発行者を知らない状態にもなりうる。その場合は自分が持つ challenge だけを認め、残りは推測せずに断る
- 登録 URL の claims は `user_id` (発行 instance が subject ごとに 1 度決める 16 bytes の乱数) を運ぶ。page はそれを `user.id` として credential を作り、instance は `CredentialRecord.user_handle` として保持し、handle を名乗る assertion はそれに照らされる。page に決めさせないのは、authenticator が instance の手の届かない所でその値を保持するため — 1 人に 2 つの値があれば、その端末では 2 つのアカウントになる

## Alternatives Considered

- 案 A: 6 桁を URL に含める
  - 不採用理由: 経路が 1 つになり、URL の所持だけで登録できてしまう。別経路であることが条件そのもの
- 案 B: どちらの半分が失敗したかを答える
  - 不採用理由: 半分ずつ切り分けて試せるようになる。呼び手にとって次にすることは同じ (正しい URL と数字で出直す)
- 案 C: 受け手の instance が 6 桁を判定する
  - 不採用理由: 試行が instance に分散し、どこも合計を数えない
- 案 D: `user_id` を page が作る
  - 不採用理由: authenticator が保持する値なので、2 度作れば同じ人が 2 アカウントになり、instance からは直せない

## Consequences

- 登録は発行者が生きている間だけ成立する。発行者が落ちていれば転送先が無く、登録はできない
- challenge の発行者が任意である以上、受け手は「自分が知らない challenge は断る」以上のことをしない

## 関連

- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — 4 op の carrier と `auth.resolve` の転送
- [DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md) — 登録された credential が何に縛られ、誰の物になるか
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md`
- `docs/DESIGN.md` §Authenticating a person
