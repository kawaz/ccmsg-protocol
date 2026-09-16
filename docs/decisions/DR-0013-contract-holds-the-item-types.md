# DR-0013: 契約が持つのは transcript の語彙だけで、行を読む物は持たない

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

transcript は harness が自分の都合で書くファイルで、その形は ccmsg の同意なしに変わる。契約が行の読み方を持てば、harness が形を変えるたびに契約の版が動き、それを読む client も動く。さらに、読む対象は 1 つの harness とは限らない。

## Decision

- 契約が持つのは **行を読み込んだ先の語彙 — item の型 — だけ**で、行を読む物は持たない。分類するのはファイルを開く daemon で、線上を流れるのは型付きの item
- 型名は `.` 区切りの階層で、prefix が配下の全部を名指す (`tool` は全ツール、`message.user` は人とセッションの双方向)
- 末尾が開いている家族は 3 つ — `tool.<Name>` / `system.attachment.<kind>` / `hook.<Event>` — その segment を coin するのは harness だから。`TRANSCRIPT_ITEM_TYPES` は閉じた部分だけを綴り、外の名前は **新参であってエラーではない**。開いた家族の末尾は harness の綴りのままで snake_case ではなく、`.` を含まない (どの型名も `.` で分割すれば階層が得られる)
- `tool.unknown` は、読み手がツールを名指せなかった呼び出しのための予約名。coin された segment の 1 つなので、実際に `unknown` という名のツールがあればそこに着地し、失われるのは区別だけ
- `in` / `out` は **subject の立ち位置から**読む。subject は既定でセッション、`agent_id` が名指せばその 1 段下の agent
- `message.*` の 2 段目は subject から見た **関係**: `parent` は自分を始めた相手、`sub` は使い捨ての agent、`team` は名前を持って居続ける相手、`session` は ccmsg 越しの別セッション。例外は `user` で、これは関係ではなく **人**そのもの
- harness の呼び名は型にしない。`main` は関係ではないので `message.main` は「main セッションの通信を傍で聞いている」と読まれてしまう。literal な名前は item の `harness_name` が持つ
- subject がどの立場だったか (`main` / `sub` / `team`) は item 自身が `subject` で述べる。関係名はその立場から読むので、同じ `message.parent.in` が `sub` では依頼の内容、`team` では lead が書いた物になる
- `sub` と `team` を分けるのは **往復の畳み方が違う**から。使い捨ての agent は始まって 1 度答えて終わるので `message.sub.in` は `message.sub.out` の結果だが、居続ける相手の返事は呼び出しの結果ではなく、宛てて書かれた独立のメッセージ
- 表の「起きない」は **拒否ではない**。それでも来た行は、当てはまる名前で出す (黙って消えるのは unknown と同じ失敗)

## Alternatives Considered

- 案 A: 行の読み方 (どのフィールドをどう見るか) を契約に持つ
  - 不採用理由: harness が形を変えるたびに契約と client が動く。別の harness の記録を読むこともできなくなる
- 案 B: 型を全部閉じた union にする
  - 不採用理由: harness が coin する segment が全部 `unknown` に落ち、何が来たのかを述べる物が残らない
- 案 C: harness の呼び名 (`main`、lead 名、teammate 名) をそのまま型にする
  - 不採用理由: 呼び名は関係ではない。読み手は関係として読むので、意味が入れ替わる
- 案 D: subject を item に持たせず、取得した要求の記憶に任せる
  - 不採用理由: 複数の transcript を並べて描く client は、要求を覚えている間しか item を置けない

## Consequences

- harness が形を変えた時に動くのは daemon の分類だけで、契約も client も動かない
- 新しい型名の出現は正常な出来事で、client は知らない型を落とさずに描ける必要がある

## 関連

- [DR-0014](DR-0014-call-and-result-are-two-items.md) — item の識別と対
- ccmsg (daemon) `docs/decisions/DR-0007-classify-by-who-the-conversation-is-with.md`
- `docs/DESIGN.md` §Transcript item types
