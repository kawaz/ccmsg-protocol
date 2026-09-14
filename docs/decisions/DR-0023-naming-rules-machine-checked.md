# DR-0023: 名前の規則を決め、全 schema を歩いて機械検査する

- Status: Active
- Date: 2026-09-14

## Context

op・topic・item 型・フィールドの名前は、複数の面と複数の実装に跨って増える。文章で規則を述べても、名前を足す時に読まれるとは限らない。

## Decision

規則を定め、`test/conventions.test.ts` が全ての schema を歩いて検査する。

- 時刻は Unix ミリ秒の整数で `*_at`、期間は単位を綴る (`*_ms` / `*_secs`)
- 名前は `.` 区切りの階層を左から右に読む (prefix が配下の全部を名指す)。op は `<主語の階層>.<動詞>` で動詞で終わり (`file.read`、`session.env.read`)、topic と item 型は名詞で終わる (`llm.status`、`message.user.in`)。フィールドは snake_case
- `:` は引数 — その前に名指した主語の id — を運び、**名前全体の末尾に 1 度だけ**現れる (`transcript.items:<sid>` であって `transcript:<sid>.items` ではない)
- `_` は 1 つの語の中を繋ぐ物で、2 つの語を繋がない。`stat_batch` は 2 語なので `file.stat` と綴る。1 語として読む segment は `test/conventions.test.ts` の一覧に書き下す (現在は空)
- 開いた 3 家族の末尾 (`tool.<Name>` / `system.attachment.<kind>` / `hook.<Event>`) は harness の綴りで、この規則の外。`[A-Za-z0-9_-]+` で `.` を含まない (`.` を持つ harness 名は型を coin する側が `_` で綴る) ので、どの型名も `.` で分割すれば階層になる
- 根に置くのは、特定の主語に属さない名前だけ: 挨拶と、全体の集合である topic (`peers` / `agents` / `instances` / `inbox` / `notify`)。これらが複数形なのは集合だから (呼び手が到達した 1 つの instance を指す単数の `instance.*` op と対になる)
- 「不明」は省略し、「無し」は空配列

## Alternatives Considered

- 案 A: 規則を文章だけで持つ
  - 不採用理由: 名前を足す時に読まれるとは限らない。CI は必ず読まれる
- 案 B: `_` の規則も形から機械的に判定する
  - 不採用理由: 形だけでは 1 語と 2 語を区別できない。人が「これは 1 語として読む」と書き下す以外に判定の根拠が無い
- 案 C: 開いた家族の末尾にも規則を適用する (snake_case に直す)
  - 不採用理由: harness が coin した名前を書き換えることになり、元の名前と対応が付かなくなる

## Consequences

- 2 語からなる segment は、一覧に書き下されるまでテストが落ちる。落ちた時の正しい対応は、多くの場合 1 語に直すのではなく名前を分けること
- 名前の規則を変える時は、検査も同じ変更で動く

## 関連

- ccmsg (daemon) `docs/decisions/DR-0003-naming-rules.md`
- `docs/DESIGN.md` §Conventions (machine-checked)
