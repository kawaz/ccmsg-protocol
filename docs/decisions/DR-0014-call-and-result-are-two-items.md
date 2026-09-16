# DR-0014: 呼び出しと結果は 2 つの item で、id で互いを指す

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

1 つの assistant の record から、思考・本文・各呼び出しが生まれる。また呼び出しの結果は何ターンも後に届く。どこまでを 1 つの item とし、対をどう繋ぐか、そして分類を疑った時に元の行へどう戻るかを決める必要がある。

## Decision

- item の識別子は `id` (`<uuid>:<index>` — 読み出した record と、その中での位置)。`uuid` は **その item が出てきた record** として隣に残る。record の id だけでは 1 度に複数の item を名指してしまい、リンクの解決先が 1 つに定まらない
- 呼び出しと結果は **2 つの item** で、`result_item` と `parent_item` が id で互いを指す。畳むのは描く側の仕事で、分類がどちらの瞬間に畳むかを決めるべきではない
- リンクは transcript 全体から書かれるので、**運ばれている範囲の外を指すのは普通**。読み手は id を持っているので取りに行ける。`result_item` の無い `use` は、まだ返ってきていない呼び出し
- リンクは位置ではなく id で指す。どの item が存在するかは選択と範囲が決めるため
- `parent_item` は **読み手が見た物**であって、ファイルが持つ物ではない。途中から読み始めれば、呼び出しが始点より手前にある結果に出会う。よってこれは任意で、**常にあるのは `parent_tool_use_id`** (harness が持つ呼び出しの鍵で、各呼び出しの `tool_use_id` と突き合わせる)
- 全ての item が `source` (`offset` と `bytes`) を持つ。分類は誤りうるもので、分類が答えられない唯一の問いは「その行が実際に何と書いてあったか」。`offset + bytes` で区切った `transcript.read` がその record を返すので、client は型付きの item を描き、疑った物だけ生の record を取りに行く。1 つの record から出た複数の item は同じ住所を共有するので、取れるのは record であって その一部ではない
- 型付きの読み口は 2 つ。`transcript.items.read` は dump と同じ範囲指定と `types` 選択で答え、`limit` がどちら端を残すかは与えられた境界から従う: 下限があれば範囲の先頭から読んで `next` が外れた最初の item を名指し、それ以外 (上限だけ、または境界無し) は範囲の末尾を読んで `prev` が答えた最初の item を名指す。**境界無しの最初の読みは末尾が返る**。先頭から読みたい読み手は `since_at: 0` と述べる。`transcript.items:<sid>` topic はその購読版で、snapshot は末尾、以後は分類された分が届く
- 生の `transcript.read` と `transcript:<sid>` は併存する。型付きの対が client の作業場で、生の対は `source` から record を引く手段

## Alternatives Considered

- 案 A: 呼び出しと結果を 1 つの item に畳む
  - 不採用理由: 分類が「2 つの瞬間のどちらで item を作るか」を決めることになる。結果は何ターンも後に届くので、どちらを選んでも片方の時点では嘘になる
- 案 B: リンクを位置 (index) で指す
  - 不採用理由: 選択と範囲によってどの item が存在するかが変わる
- 案 C: `parent_item` だけを持ち、`parent_tool_use_id` を持たない
  - 不採用理由: 途中から読み始めた時、呼び出しが範囲の外にあり、結果が何に対する結果か述べられない行になる
- 案 D: 生の読み口を廃し、型付きだけにする
  - 不採用理由: 分類を疑った item の元の行を引けなくなる。`source` は引ける先があって初めて意味を持つ

## Consequences

- client は「まだ返ってきていない呼び出し」を `result_item` の不在として描ける
- 範囲外を指すリンクは異常ではないので、client は解決できないリンクを壊れた状態として扱わない

## 関連

- [DR-0013](DR-0013-contract-holds-the-item-types.md) — item の型の語彙
- [DR-0015](DR-0015-dump-travels-as-a-file.md) — 同じ範囲指定と `types` 選択
- ccmsg (daemon) `docs/decisions/DR-0006-dump-writes-typed-items.md`
- `docs/DESIGN.md` §Transcript item types
