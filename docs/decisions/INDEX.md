# Decision Records

このリポの判断記録 (DR) の索引。**なぜそう決めたか / 何を捨てたか**はここにあり、[docs/DESIGN.md](../DESIGN.md) / [DESIGN-ja.md](../DESIGN-ja.md) は今の姿だけを述べる。

Status は各 DR ファイルの `Status:` 行が正本。

## Active

| DR | 要旨 |
|---|---|
| [DR-0001](DR-0001-session-and-run.md) | セッションと run を分け、`SessionState` を観測されるフィールド (`runs` / `session_status` / `agents.sid` / `terminal_id` の scheme) に置き換える |
| [DR-0002](DR-0002-request-id-and-concurrency.md) | 全ての Request が `request_id` を持ち、1 接続の要求は並行に走る。1 要求 = 1 応答 |
| [DR-0003](DR-0003-hello-before-anything-else.md) | 接続直後に通るのは `hello.*` だけ。挨拶が role と `sid` を束縛する |
| [DR-0004](DR-0004-op-attribute-table.md) | 認可・capability・配置は op 属性表 1 枚から読む。carrier は運び方だけを決める |
| [DR-0005](DR-0005-observation-is-snapshot-plus-delta.md) | 観測は購読 1 つ、snapshot と delta が同じ型で届く。折り方は `granularity` が持つ |
| [DR-0006](DR-0006-message-addressed-to-one-sid.md) | メッセージは 1 つの sid 宛、送り主は `Sid \| "user"`。返路は frame の `from` |
| [DR-0007](DR-0007-undelivered-waits-in-the-inbox.md) | 渡らなかったメッセージは inbox で待つ。人が読んでも消費されず、退場は理由付き |
| [DR-0008](DR-0008-wording-of-a-direct-delivery.md) | frame を読めない受け手のため、直送メッセージの本文の語彙だけを契約が持つ |
| [DR-0009](DR-0009-shared-kv-promises-key-uniqueness.md) | 共有 kv が約束するのは namespace 内の key の一意性だけ。どの instance でも答える |
| [DR-0010](DR-0010-session-meta-and-the-greeting.md) | セッションの素性は 1 箇所で述べ、挨拶はフィールド単位。停止の入口は `session.stopping` |
| [DR-0012](DR-0012-retention-windows-in-the-contract.md) | 未配送メッセージと失われた行の保持期限 (7 日 / 256 件) を契約が持ち、2 つを分けない |
| [DR-0013](DR-0013-contract-holds-the-item-types.md) | 契約が持つのは transcript の語彙 (item 型) だけ。行を読むのは daemon |
| [DR-0014](DR-0014-call-and-result-are-two-items.md) | 呼び出しと結果は 2 item、id で互いを指す。`source` で生 record を引く |
| [DR-0015](DR-0015-dump-travels-as-a-file.md) | dump は path を答え、ファイルの形も契約が持つ。`format` は選択に効かない |
| [DR-0016](DR-0016-limits-the-sender-keeps-to.md) | 送り手が守れる上限だけを契約が持つ。受け手側で読めるのは `rate_limited` だけ |
| [DR-0017](DR-0017-one-generation-no-compatibility-path.md) | `PROTOCOL_VERSION` は世代を表し、互換経路を持たない |
| [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) | 識別は `instance` id、ダイヤル先は `endpoint` URL。経路は endpoint の下 |
| [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) | mesh は専用 op を持たず、転送された要求は宛先で全部認可し直す |
| [DR-0020](DR-0020-auth-shape-on-the-wire.md) | 人の認証は線上の形だけを契約が持つ。4 op は HTTP で運び、属性表には載る |
| [DR-0021](DR-0021-registration-in-two-halves.md) | 登録は URL と 6 桁を別経路で要求し、判定は発行者だけが行う |
| [DR-0022](DR-0022-credential-bound-to-an-endpoint.md) | credential は endpoint に束縛。住所や BE/BS は見分けるための物で何も決めない |
| [DR-0023](DR-0023-naming-rules-machine-checked.md) | 名前の規則を決め、全 schema を歩いて機械検査する |
| [DR-0024](DR-0024-executable-contract-and-fixtures.md) | 契約は実行可能で、線上の代表例 (fixtures) も契約が持つ |
| [DR-0025](DR-0025-upstream-marked-types.md) | 上流の語彙を持つ型に mark を付け、綴りだけはこの契約に揃える |
| [DR-0026](DR-0026-terminals-are-their-own-list.md) | 端末は端末の一覧 (`terminals` topic) として述べ、セッションとは pid の一致で結ぶ。起動直後のハーネスは 2 つの一覧の差として導出する |

## Superseded

| DR | 要旨 |
|---|---|
| [DR-0011](DR-0011-instance-derives-the-classification.md) | セッションの分類は instance が導出し `state` として行に載せる (Superseded by [DR-0001](DR-0001-session-and-run.md)) |

## Archived

<!-- 現役の文脈を汚す古い DR は decisions/archive/ に退避し、ここに記載 -->

## Moved to research/

<!-- 判断記録の体を成さなくなり research/ に降格した DR -->
