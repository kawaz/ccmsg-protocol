# DR-0016: 送り手が守れる上限だけを契約が持つ

- Status: Active
- Date: 2026-09-14

## Context

上限には 2 種類ある。送り手が送る前に守れる物 (frame の大きさ、文字数) と、受け手しか知らない物 (どれだけ溜まっているか)。後者を契約に書いても送り手は自分の拒否をそれに照らして読めないし、前者を各実装の裁量にすると、送り手は何を守れば通るのかを知らないまま送ることになる。

## Decision

- **送り手だけが守れる上限を契約が持つ**
  - `MAX_FRAME_BYTES` は 1 MiB。改行区切り 1 行 (要求・応答・topic frame のいずれも) の上限で、超えた frame は `bad_request` で答え、**接続は保つ**。それを超える本文をどうするか (分割する、ファイルに書いて参照を送る) は呼び手の判断なので、契約は上限を述べて対処は述べない
  - `TITLE_MAX_CHARS` は 200 で、`session.rename` の `title` の上限。schema の `maxLength` も同じ値。端末に打ち込まれてセッションの 1 行目になる物なので、端末が受け付ける限界ではなく読める長さで止める
- 受け手が持つ上限のうち送り手が読めるのは `rate_limited` だけ。読み手に積む物が埋まった時の答えで、`internal_error` とは別にする — 何も失敗しておらず、見直すべきは引数でもない (読み手が追いつけば同じ呼び出しが通る)。宣言するのは読み手に積む op (`notify.send` / `say.post`) だけで、読んでいないセッション宛のメッセージには要らない (待つ場所は inbox)

## Alternatives Considered

- 案 A: frame の上限を実装ごとの設定にする
  - 不採用理由: 送り手は自分が受けた拒否を大きさのせいだと帰属できない
- 案 B: 上限超過で接続を落とす
  - 不採用理由: 1 つの frame の誤りで挨拶も購読もやり直しになる。答えて接続を保てば、呼び手はその 1 件だけを直せる
- 案 C: 契約が対処 (分割の仕方) まで述べる
  - 不採用理由: 大きな本文をどうするかは呼び手の設計で、ファイルに書く経路を持つ呼び手と持たない呼び手で答えが違う
- 案 D: `rate_limited` を `internal_error` に含める
  - 不採用理由: 失敗ではないし、引数を見直しても変わらない。区別できなければ呼び手は再試行の可否を判断できない

## Consequences

- 契約に無い上限で拒まれた呼び手は、その理由を契約から読めない。よって受け手側の上限を増やす時は、読める答え (`rate_limited`) を持つ op に限る
- 保持の期限と件数は別の判断として契約が持つ ([DR-0012](DR-0012-retention-windows-in-the-contract.md))

## 関連

- [DR-0012](DR-0012-retention-windows-in-the-contract.md) — 保持の期限と件数
- ccmsg (daemon) `docs/decisions/DR-0010-one-topic-mechanism-one-egress-layer.md`
- `docs/DESIGN.md` §Limits the sender keeps to
