# Issue INDEX

active な issue の一覧。close 済みは archive/ にあり、ここには載せない。

| date | category | status | slug | 概要 |
|---|---|---|---|---|
| 2026-09-10 | task | open | [ecosystem-review-2026-09](./2026-09-10-ecosystem-review-2026-09.md) | エコシステム外部レビュー (2026-09) の指摘への対応検討 |
| 2026-09-10 | bug | open | [token-family-bound-to-endpoint](./2026-09-10-token-family-bound-to-endpoint.md) | TokenFamily が endpoint を持たず、access token が別 endpoint 登録を跨いで通る |
| 2026-09-10 | design | open | [schema-library-choice-record](./2026-09-10-schema-library-choice-record.md) | TypeBox (JSON Schema) 採用根拠が記録されていない |
| 2026-09-09 | design | open | [passkey-list-for-people](./2026-09-09-passkey-list-for-people.md) | 人 (webui) が自分の passkey 一覧を見て保守する op が契約に無い |
| 2026-09-09 | design | open | [session-status-partial-marker](./2026-09-09-session-status-partial-marker.md) | daemon v2 の fold は末尾 1 MiB seed のため累積フィールドが窓から落ちて消える |

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
