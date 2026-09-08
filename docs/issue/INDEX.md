# Issue INDEX

active な issue の一覧。close 済みは archive/ にあり、ここには載せない。

| date | category | status | slug | 概要 |
|---|---|---|---|---|
| 2026-09-08 | design | open | [internal-failure-error-code](./2026-09-08-internal-failure-error-code.md) | ErrorCode に「op の実装が例外で失敗した (呼び出し側の責任ではない)」を表す code が無い。 |
| 2026-09-08 | design | open | [topic-granularity-attribute](./2026-09-08-topic-granularity-attribute.md) | topic の差分粒度 (全量置換 / instance ごとの全量置換 / 要素の追加・更新 / 追記 / eve… |
| 2026-09-08 | design | open | [message-sender-identity](./2026-09-08-message-sender-identity.md) | `InboxMessage.from` が `Sid` 必須だが `message_send` の roles は session と use… |

<!--
INDEX の列構成・canonical 順序・行形式の唯一の正本:

- 列構成は固定 (= 上記 5 列、列名と順序を変えない)
- 行の {{rows}} は active issue の行に置換する
- canonical 順序:
  1. status 優先順: idea → open → wip → blocked → pending-sublimation
  2. 同 status 内は date 降順 (= 新しい起票が上)
- 各行: `| YYYY-MM-DD | <category> | <status> | [<slug>](./YYYY-MM-DD-<slug>.md) | <本文 1 行目から 80 文字以内> |`
- 概要は 80 文字を超えたら末尾を「…」で省略
-->
