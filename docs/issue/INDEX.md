# Issue INDEX

active な issue の一覧。close 済みは archive/ にあり、ここには載せない。

| date | category | status | slug | 概要 |
|---|---|---|---|---|
| 2026-09-10 | bug | open | [token-family-bound-to-endpoint](./2026-09-10-token-family-bound-to-endpoint.md) | TokenFamily が endpoint を持たず、access token が別 endpoint 登録を跨いで通る |
| 2026-09-10 | design | open | [transcript-snapshot-implies-nothing-about-liveness](./2026-09-10-transcript-snapshot-implies-nothing-about-liveness.md) | transcript:<sid> の snapshot が返ることの意味を契約 DESIGN に明記するか |
| 2026-09-10 | design | open | [schema-library-choice-record](./2026-09-10-schema-library-choice-record.md) | TypeBox (JSON Schema) 採用根拠が記録されていない |
| 2026-09-09 | design | open | [passkey-list-for-people](./2026-09-09-passkey-list-for-people.md) | 人 (webui) が自分の passkey 一覧を見て保守する op が契約に無い |
| 2026-09-09 | design | open | [inbox-invisible-to-user-and-lacks-tombstone](./2026-09-09-inbox-invisible-to-user-and-lacks-tombstone.md) | inbox topic が user role へ配送されず、要素の削除印も表現できない |
| 2026-09-09 | design | open | [file-read-paging-and-external-listing](./2026-09-09-file-read-paging-and-external-listing.md) | webui Files タブが file_read paging と外部ファイル列挙を契約で表現できない |
| 2026-09-09 | design | open | [notification-lacks-mid](./2026-09-09-notification-lacks-mid.md) | notify Notification に reply_to (mid) が無く webui が返事の重複表示を消せない |
| 2026-09-09 | design | open | [session-status-partial-marker](./2026-09-09-session-status-partial-marker.md) | daemon v2 の fold は末尾 1 MiB seed のため累積フィールドが窓から落ちて消える |
| 2026-09-08 | design | open | [say-unread-on-wire](./2026-09-08-say-unread-on-wire.md) | `say_post`/`say_mark_read` の未読マークを運ぶ契約フィールドが無い |

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
