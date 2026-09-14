# DR-0002: 全ての Request が `request_id` を持ち、1 接続の要求は並行に走る

- Status: Active
- Date: 2026-09-14

## Context

1 本の WebSocket 接続に複数の要求が同時に載る。応答を到着順で対応づけるなら、要求と応答の対は接続ごとの順序に依存し、遅い op が後続の全部を待たせる。ファイルを読む、transcript を畳む、別 instance へ転送する — どれも外部の完了を待つので、待たせる側になる op は例外ではなく常態である。

## Decision

- 全ての Request が `request_id` を持ち、Response がそれをそのまま返す (`RequestEnvelope` / `src/envelope.ts`)。一意性が要るのは **1 接続の in-flight な要求の中だけ**で、接続を跨いだ一意性は求めない
- 対応づけが id で付くので、instance は同一接続の要求を **並行に実行してよい**。到着順に流す義務は無い
- 1 要求 = 1 応答。途中経過を複数の応答に分けて返す形は取らない。進行中に見せたい物がある op は topic で述べる
- HTTP で運ぶ 4 つの op (`auth.*`) には要求を並べる接続が無いので、`request_id` は carrier が合成する

## Alternatives Considered

- 案 A: 対応づけを到着順 (FIFO) に任せ、`request_id` を持たない
  - 不採用理由: 遅い op が接続全体を止める。避けるには client が要求ごとに接続を張ることになり、挨拶と購読をやり直す羽目になる
- 案 B: 遅い op は複数の応答に分割して返す
  - 不採用理由: 遅い op が他を待たせないのは並行実行が担保している。1 要求 = 1 応答を崩すと、client は「まだ来るのか」を全 op について持つ
- 案 C: `request_id` を接続を跨いで一意にする (uuid 等を要求する)
  - 不採用理由: 対応づけは 1 接続の中の話で、それ以上の一意性は誰も読まない

## Consequences

- 並行実行は instance の責務であり、順序に依存した実装は契約違反ではなく単に遅い
- `auth.*` の 4 op は carrier が id を作るので、client はそこに値を持たない

## 関連

- ccmsg (daemon) `docs/decisions/DR-0015-async-io-principle.md` (外部の完了を待つものは全て非同期)
- `docs/DESIGN.md` §Authenticating a person (HTTP carrier が `request_id` を合成する)
