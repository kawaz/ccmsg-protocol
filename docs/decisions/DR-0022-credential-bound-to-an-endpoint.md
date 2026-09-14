# DR-0022: credential は endpoint に束縛し、認証しない手掛かりを併せて持つ

- Status: Active
- Date: 2026-09-14

## Context

1 つの host に複数の instance が同居しうる ([DR-0018](DR-0018-instance-id-apart-from-endpoint.md))。passkey が答えるのはドメイン単位なので、authenticator の側の単位 (RP ID) は「どの instance に入れたか」より粗い。粗い方に合わせて受け入れると、ある instance に登録した鍵が隣の instance への入口になる。

## Decision

- credential record は登録された `endpoint` を保持し、assertion は **そこでだけ**受ける。origin が一致し、要求の path がその base URL の下にあること。`https://h/` と `https://h/personal/` は 2 つの endpoint で、1 つの host・1 つの RP ID であっても 2 つの登録を要する。**base URL に束縛することが、隣の instance への入口を塞ぐ**
- credential record は登録時の `rp_id` も保持する。passkey は作られたドメインにしか答えないので、assertion の `rpIdHash` は **それ**と比べる (到達した endpoint の host とではなく)
- 2 つの名前が登録と一緒に旅をする。`RegisterClaims.issued_label` は管理者が「誰のための URL か」を書いた物、`auth.register` の `device_label` は本人が「どの端末か」を書いた物。record は両方と、登録時および最終使用時の住所と user agent を保つ
- authenticator data の BE / BS (`backup_eligible` / `backup_state`) と、token family の直近の rotate (`last_refresh`: いつ・どこから・client が述べた `reason`) も同じ種類の物
- **これらは何も認証せず、何も決めない**。住所は要求する側が自由に選べるし、`reason` は無検査の申告で、述べない refresh も述べる refresh と同じく有効。あるのは **見分けるため** — 自分の一覧を読む本人が、住所が自分の回線で browser が自分の使う物だから自分の行だと置ける、あるいは置けずに削除できる

## Alternatives Considered

- 案 A: origin に束縛する
  - 不採用理由: 同じ origin に同居する隣の instance への入口になる
- 案 B: 到達した endpoint の host で `rpIdHash` を比べる
  - 不採用理由: passkey は作られたドメインにしか答えない。到達先の host と一致する保証が無い
- 案 C: 手掛かりを持たない
  - 不採用理由: 人は自分の一覧の行を自分の物だと置けず、身に覚えの無い行を見分けて消すこともできない
- 案 D: 手掛かりで受け入れを判定する (住所や BE/BS を条件にする)
  - 不採用理由: どれも要求する側が自由に決められる値で、判定の根拠にすると自由入力が認可になる

## Consequences

- 1 つの host で複数の instance を運用する場合、人は instance ごとに登録する
- 手掛かりの追加は認可に影響しないので、増やす判断は「人が見分けられるか」だけで決まる

## 関連

- [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) — endpoint は path まで含めて比べる
- [DR-0020](DR-0020-auth-shape-on-the-wire.md) — record の複製経路
- ccmsg (daemon) `docs/decisions/DR-0001-passkey-auth-for-people.md`
- `docs/DESIGN.md` §Authenticating a person
