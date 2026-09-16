# DR-0011: セッションの分類は instance が導出し、`state` として行に載せる

- Status: Superseded by DR-0001
- Date: 2026-09-14

## Context

セッションが今どうなっているか (答えを待っている / 動いている / ccmsg から操作できない / 止めた / 消えた) は、接続の有無、状態ファイル、停止の宣言といった複数の入力から決まる。これを client 側で組み立てさせるか、instance が決めて行に載せるかを決める必要がある。

## Decision

- 分類 (`state`) は **instance が導出して `peers` の行に載せる**。生の入力を返して client に組み立てさせない
- 語彙は接続のあるセッションに 3 つ (`waiting` / `live` / `live_unmanaged`)、失われたセッションに 2 つ (`paused` / `disappeared`) で、後者を分けるのは `stopped_at` の有無だけ
- 接続中と喪失は 2 つの一覧ではなく **1 種類の行**。セッションが現れることも失われることも、client が既に持っている行への更新として届き、行の同一性は保たれる

## Alternatives Considered

- 案 A: 生の入力を返し、client が分類を組み立てる
  - 不採用理由: instance ごと・client ごとに読みが分かれる。同じ状態が画面によって違う言葉になる
- 案 B: 接続中と喪失で topic を分ける
  - 不採用理由: 失われた瞬間に行が一方から他方へ移り、client は 2 つの一覧を突き合わせて同じセッションだと結び直すことになる

## Consequences

この判断は [DR-0001](../DR-0001-session-and-run.md) が置き換えた。`SessionState` と `peers.state` は削除され、分類が 1 語に押し込めていた軸 (プロセスの数、畳みの進行、人が答えるべきものの有無、停止の宣言) は、それぞれに答えるフィールドに分かれた。「instance が導出して行に載せる」という本 DR の姿勢のうち、観測されたフィールドを行に載せる部分は残り、導出そのものは契約が export する関数に移った。

## 関連

- [DR-0001](../DR-0001-session-and-run.md) — 本 DR を置き換えた判断
- [DR-0010](../DR-0010-session-meta-and-the-greeting.md) — 素性と停止の宣言 (置き換えの対象外)
- ccmsg (daemon) `docs/decisions/DR-0009-daemon-derives-session-state.md`
- `docs/DESIGN.md` §Session classification and retention
