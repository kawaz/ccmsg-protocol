# DR-0008: 直送メッセージの本文の語彙は契約が持つ

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

受け手が 1 つだけ frame を読めない。harness 自身の messaging socket へ書き込む経路では、受け手は client ではなくモデルで、届くのは 1 塊のテキストである。見る封筒が無いので、**本文に `mid` と `from` が無いメッセージは答えようがない** — 何かが来たことは分かるが、何に何と答えるかが分からない。

## Decision

この 1 つの文言だけを契約が持つ (`renderDirectDelivery` / `parseDirectDelivery`、`src/messaging/direct-delivery.ts`)。

- 形は harness 自身の送り主表記 (`<cross-session-message>` を本文に埋める)。`from` / `from-name` / `from-mode` は受け手の harness が読む出所で、`ccmsg-mid` / `ccmsg-from` / `ccmsg-reply-to` がこの契約の識別子
- 本文の `from` は常に `ccmsg` で、sid も `uds:` パスも置かない。それらは harness が実際にダイヤルする住所で、消えた宛先をダイヤルすると受け手のターンが失敗で終わる
- それが書かれている frame の `from` は別の住所で、そこでは instance が配送状態を受ける自分の `uds:` socket を名乗れる。**受領は否定だけ** (`refused` / `denied` / `dropped` / `expired` / `held`) なので、窓の中の沈黙が配送を意味する
- 返し方は本文末尾の 1 行 (`Reply with: ccmsg reply <mid> --to <sid> <text>`) で、受け手が自分で実行する。sid を綴るのは、`mid` が送り主を名指さないため
- 送り主が人 (`from` が `user`) の時だけ `--to` が落ちる。`user` は sid ではないので `--to user` はどこにも届かない住所になる。その答えが何になるかは instance が決め、受け手は行を実行するだけでよい
- `text` は無加工で運ぶ。モデルが読むのはその文字そのもので、entity に置き換えれば壊れた本文を読ませることになる。閉じタグを含む本文も拒まず配送し (1 つの部分文字列でメッセージを失わない)、閉じタグは末尾から探す。escape するのは属性値の `&` `<` `>` `"` だけ (値が引用符から出られないように)

## Alternatives Considered

- 案 A: 本文の `from` に sid や `uds:` パスを置く
  - 不採用理由: harness がそれをダイヤルする。宛先が消えていれば受け手のターンが失敗で終わる
- 案 B: `mid` から送り主を引ける op を足し、返し方の行から sid を落とす
  - 不採用理由: その op のために、daemon が他に必要としない送信 index を持つことになる
- 案 C: 閉じタグを含む本文を拒否する
  - 不採用理由: 1 つの部分文字列が含まれるという理由でメッセージを失う。末尾から探せば済む
- 案 D: `text` も escape する
  - 不採用理由: モデルが読むのはその文字列で、entity 化した本文に答えさせることになる
- 案 E: 肯定の受領も返す
  - 不採用理由: 窓の中の沈黙が配送、という単純な読みが失われ、受け手が居ない場合と区別するために別の待ちが要る

## Consequences

- harness の送り主表記が変われば、契約のこの関数が追従する箇所になる
- 契約が文言を持つのはこの経路だけで、frame を読める受け手には何も文章を約束しない

## 関連

- [DR-0006](DR-0006-message-addressed-to-one-sid.md) — `Sender` と返路
- ccmsg (daemon) `docs/decisions/DR-0008-direct-route-first-inbox-persisted.md`
- `docs/DESIGN.md` §Wording a message handed over directly
