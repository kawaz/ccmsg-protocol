# DR-0005: 観測は購読 1 つ、snapshot と delta が同じ型で届く

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

観測できる物には「今の値」と「その後の変化」の 2 つの読み方がある。読み取り op と更新 frame を別に持つと、両者は別の型になり、client は「読んでから購読するまでの隙間」を自分で埋めることになる。隙間で起きた変化は、どちらの経路にも現れない。

## Decision

- **観測できる物は全て topic**。`topic.subscribe` の直後に現在値が `snapshot: true` の frame で 1 回届き、以後の frame は同じ payload 型で変化を運ぶ。一度読むだけの op は作らない (購読して即解除すれば同じ値が得られる)
- 全ての frame が出所の `instance` を名乗る
- 1 つの型で答えられない唯一の問い —「後から来た frame が、既に保持している値に何をするか」— を `TOPIC_ATTRIBUTES` の `granularity` として契約が持つ。daemon と web UI が同じ表を読んで同じ畳み方をする

| granularity | frame が運ぶ物 | 畳み方 | snapshot |
|---|---|---|---|
| `whole` | 値の全部 | 保持している物を置き換える | あり |
| `per_instance_whole` | その `instance` が知る全部 | その instance の分だけ置き換える (保持は instance 横断の和) | あり |
| `element` | 変化した要素 | 要素の id で照合して追加・更新、触れられていない要素はそのまま | あり |
| `append` | 前の frame 以降に増えた分 | 後ろに足す。既にある物は書き換えない | あり |
| `event` | 値ではなく出来事 | 何も保持しない | なし |

どれを取るかは値の性質から従う。独立に動く行は `element`、丸ごとでしか意味を持たない値は `whole` (instance ごとに一部を持つなら `per_instance_whole`)、増えるだけの物は `append`、出来事は `event`。迷った時の問いは「ある要素が変わったことを理由に、別の要素を述べ直す理由があるか」。

`element` の削除は **印の付いた要素**として届く。変化の一覧における不在は何も述べない。

**snapshot が述べるのは「今保持している物」だけで、「まだ何かが動いている」ではない**。`transcript:<sid>` は、二度と書かれないファイルについても書かれている最中のファイルについても、購読した瞬間のファイル末尾を答える。生きているかどうかは `peers` が述べる。

## Alternatives Considered

- 案 A: 読み取り op + 別型の更新 frame
  - 不採用理由: 読みと購読の境目で変化を取りこぼす。型が 2 つになり、client は同じ値に 2 通りの畳み方を持つ
- 案 B: `granularity` を各実装が自分の表で持つ
  - 不採用理由: 折り方が食い違えば、同じ frame 列から違う値が組み上がる。線上の形からは折り方が読めないので、契約が述べる以外に一致させる手が無い
- 案 C: 削除を「次の snapshot で消えていること」で表す
  - 不採用理由: delta の一覧に現れないことは「変わっていない」と読めるので、削除と無変化が区別できない
- 案 D: snapshot に「進行中かどうか」を載せる
  - 不採用理由: それは観測している値ではなく、別の問い (生きているか) への答え。`peers` が持つ物を各 topic が重ねて述べることになる

## Consequences

- 観測したい物が増えるたびに op ではなく topic が 1 つ増え、属性表に `granularity` が 1 行増える
- `event` (`notify`) だけは購読しても何も来ない状態が正常で、次の出来事まで待つ

## 関連

- [DR-0007](DR-0007-undelivered-waits-in-the-inbox.md) — `inbox` topic の削除要素と理由
- ccmsg (daemon) `docs/decisions/DR-0010-one-topic-mechanism-one-egress-layer.md`
- `docs/DESIGN.md` §Observation is snapshot plus delta, in one shape
