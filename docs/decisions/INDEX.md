# Decision Records

このリポの判断記録 (DR) の索引。**なぜそう決めたか / 何を捨てたか**はここにあり、[docs/DESIGN.md](../DESIGN.md) / [DESIGN-ja.md](../DESIGN-ja.md) は今の姿だけを述べる。

Status は各 DR ファイルの `Status:` 行が正本。ここに載るのは**今立っている DR だけ**で、置き換えられた物は [archive/INDEX.md](archive/INDEX.md) にある。

状態は契約としての実装エビデンス — その DR が述べた型・フィールド・語彙・制約が `src/` の schema と fixtures / test に現れているか — で決める。`✅ 実装済` (Decision の全部にエビデンスあり) / `🟡 部分実装` / `⬜ 未実装` / `🚧 進行中` / `N/A` (実装対象でない) / `❌ 撤退`。

## Active

| DR | 状態 | 説明 |
|---|---|---|
| [DR-0001](DR-0001-session-and-run.md) | ✅ 実装済 | セッションと run を分け、`SessionState` を観測されるフィールド (`runs` / `session_status` / `agents.sid` / `terminal_id` の scheme) に置き換える |
| [DR-0002](DR-0002-request-id-and-concurrency.md) | ✅ 実装済 | 全ての Request が `request_id` を持ち、1 接続の要求は並行に走る。1 要求 = 1 応答 |
| [DR-0003](DR-0003-hello-before-anything-else.md) | ✅ 実装済 | 接続直後に通るのは `hello.*` だけ。挨拶が role と `sid` を束縛する |
| [DR-0004](DR-0004-op-attribute-table.md) | ✅ 実装済 | 認可・capability・配置は op 属性表 1 枚から読む。carrier は運び方だけを決める |
| [DR-0005](DR-0005-observation-is-snapshot-plus-delta.md) | ✅ 実装済 | 観測は購読 1 つ、snapshot と delta が同じ型で届く。折り方は `granularity` が持つ |
| [DR-0006](DR-0006-message-addressed-to-one-sid.md) | ✅ 実装済 | メッセージは 1 つの sid 宛、送り主は `Sid \| "user"`。返路は frame の `from` |
| [DR-0007](DR-0007-undelivered-waits-in-the-inbox.md) | ✅ 実装済 | 渡らなかったメッセージは inbox で待つ。人が読んでも消費されず、退場は理由付き |
| [DR-0008](DR-0008-wording-of-a-direct-delivery.md) | ✅ 実装済 | frame を読めない受け手のため、直送メッセージの本文の語彙だけを契約が持つ |
| [DR-0009](DR-0009-shared-kv-promises-key-uniqueness.md) | ✅ 実装済 | 共有 kv が約束するのは namespace 内の key の一意性だけ。どの instance でも答える |
| [DR-0010](DR-0010-session-meta-and-the-greeting.md) | ✅ 実装済 | セッションの素性は 1 箇所で述べ、挨拶はフィールド単位。停止の入口は `session.stopping` |
| [DR-0012](DR-0012-retention-windows-in-the-contract.md) | ✅ 実装済 | 未配送メッセージと失われた行の保持期限 (7 日 / 256 件) を契約が持ち、2 つを分けない |
| [DR-0013](DR-0013-contract-holds-the-item-types.md) | ✅ 実装済 | 契約が持つのは transcript の語彙 (item 型) だけ。行を読むのは daemon |
| [DR-0014](DR-0014-call-and-result-are-two-items.md) | ✅ 実装済 | 呼び出しと結果は 2 item、id で互いを指す。`source` で生 record を引く |
| [DR-0015](DR-0015-dump-travels-as-a-file.md) | ✅ 実装済 | dump は path を答え、ファイルの形も契約が持つ。`format` は選択に効かない |
| [DR-0016](DR-0016-limits-the-sender-keeps-to.md) | ✅ 実装済 | 送り手が守れる上限だけを契約が持つ。受け手側で読めるのは `rate_limited` だけ |
| [DR-0017](DR-0017-one-generation-no-compatibility-path.md) | ✅ 実装済 | `PROTOCOL_VERSION` は世代を表し、互換経路を持たない |
| [DR-0018](DR-0018-instance-id-apart-from-endpoint.md) | ✅ 実装済 | 識別は `instance` id、ダイヤル先は `endpoint` URL。経路は endpoint の下 |
| [DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md) | ✅ 実装済 | mesh は専用 op を持たず、転送された要求は宛先で全部認可し直す |
| [DR-0020](DR-0020-auth-shape-on-the-wire.md) | ✅ 実装済 | 人の認証は線上の形だけを契約が持つ。4 op は HTTP で運び、属性表には載る |
| [DR-0021](DR-0021-registration-in-two-halves.md) | ✅ 実装済 | 登録は URL と 6 桁を別経路で要求し、判定は発行者だけが行う |
| [DR-0023](DR-0023-naming-rules-machine-checked.md) | 🟡 部分実装 | 名前の規則を決め、全 schema を歩いて機械検査する |
| [DR-0024](DR-0024-executable-contract-and-fixtures.md) | ✅ 実装済 | 契約は実行可能で、線上の代表例 (fixtures) も契約が持つ |
| [DR-0025](DR-0025-upstream-marked-types.md) | ✅ 実装済 | 上流の語彙を持つ型に mark を付け、綴りだけはこの契約に揃える |
| [DR-0026](DR-0026-terminals-are-their-own-list.md) | ✅ 実装済 | 端末は端末の一覧 (`terminals` topic) として述べ、セッションとは pid の一致で結ぶ。起動直後のハーネスは 2 つの一覧の差として導出する |
| [DR-0028](DR-0028-refresh-cookie-across-sites.md) | ✅ 実装済 | refresh token は endpoint の HttpOnly cookie のまま。site をまたぐ時だけ分割された cookie として渡り、identity を決める 3 op は `Origin` と `Sec-Fetch-Site` を見る |
| [DR-0030](DR-0030-identity-is-a-user-who-owns-instances.md) | 🟡 部分実装 | identity はユーザで、instance はその人の所有物。credential はユーザ × origin × 認証器に 1 つで、endpoint にも mesh にも縛られない |
