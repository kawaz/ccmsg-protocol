# DR-0001: セッションと run を分け、`SessionState` を観測されるフィールドに置き換える

- Status: Active
- Date: 2026-09-14

## Context

契約は `peers` の行を sid で識別し、状態を 1 つの `SessionState` (`waiting` / `live` / `live_unmanaged` / `paused` / `disappeared`) で述べている。この 1 語は「プロセスが何個あるか」「人が答えるべきものが出ているか」「停止を宣言したか」「どこから届くか」を同時に表しており、次の 3 つが言えない。

- 同じ sid のプロセスが 2 つ走っている (走行中の sid を resume した時にハーネスが許す)。daemon は `sessions/` の状態ファイルを `Map<Sid, …>` に畳むので後勝ちで 1 行になり、重複の存在自体が client に見えない。fork した時点以降の jsonl は両方のプロセスが壊し合うので信頼できず、読み位置の byte もずれる
- 起動したがハーネスの状態ファイルも挨拶も transcript もまだ無い (初回ディレクトリの trust 確認で TUI が止まっている等)。pid と terminal だけがある段階を人が見分けられず、「起動したはずなのに webui に来ない」の原因を追えない
- transcript はあるが状態の畳みが終わっていない。`session.status` の開始応答が畳み終えるまで返らない間、なぜまだ無いかを述べる語が無い

一方、これらの問いに答えるフィールドの大半は既にある: `stopped_at` (停止の宣言)、`gateway_active_at` (推論が最後に走った時刻)、`agents.waiting_for` と `session.status.api_error` (人が答えるべきもの)、`connected_at` (接続)。足りないのはプロセスの数と畳みの進行で、`SessionState` はそれらを 1 語に押し込めるために存在していた。

## Decision

### 1. 二つの実体

- **セッション** (鍵 `instance` + `sid`、今までどおり): transcript、畳んだ状態、dump、履歴。ファイルに対応し、run が 0 個でも 2 個でも 1 つ。`peers` の行
- **run** (鍵 `instance` + `pid`): 生存、terminal、接続、`session.kill` / `notify.send` / `message.send` の宛先。プロセスに対応する。`agents` の行。**`agents` の鍵は `instance` + `sid` から `instance` + `pid` に変わり、`AgentRemoved` は `{instance, pid, removed}` になる**。挨拶前後で行は同じ

### 2. 線上のフィールド

利用者が判断したい問いと、それに答えるフィールド:

| 問い | フィールド | 新規 / 既存 | 値 |
|---|---|---|---|
| この sid の run は何個あるか、どれに届くか | `peers.runs` | 新規 | `{pid?, started_at?, terminal_id?, connected}[]`。pid はハーネスの状態ファイルか launcher が知っている時だけ。接続だけの run (状態ファイルを持たないハーネス) は `pid` 無しで `connected: true`。`started_at` は pid の再利用を弾く鍵 |
| `session.status` の値を信じてよいか、なぜまだ無いか | `peers.session_status` | 新規 | `absent` (transcript 無し) / `folding` / `ready` / `frozen` (run が 2 つ以上) |
| 停止を宣言したか | `peers.stopped_at` | 既存 | 時刻。`runs` が空の時だけ意味を持つ |
| 推論が走っているか | `peers.gateway_active_at` | 既存 | 時刻。run が無くても生きている根拠になる (窓は契約の `GATEWAY_LIVE_WINDOW_MS`) |
| 人が答えるべきものが出ているか | `agents.waiting_for`、`session.status.api_error` | 既存 | ハーネスの語 / 上流エラー |
| この run はどのセッションか | `agents.sid` | 既存、任意になる | 無ければ「起動したが sid 未定」 |
| この run はどう開くか | `agents.terminal_id`、`peers.runs[].terminal_id` | 既存、形式を変更 | `<scheme>:<id>` (例 `hyoui:<id>`)。terminal の URL は scheme が `hyoui` の時だけ `<terminal_gateway>/sessions/<id>` (scheme を剥がした id)。他の scheme は開き方を持つ client だけが開く |

`SessionState` と `peers.state` は削除する。旧 5 値と同じ判断は契約が export する関数で行う (instance も client も同じ実装を呼ぶ。`llmCacheWindowEndAt` と同じ置き方で、test で入出力を固定する):

- `liveness(row, now)`: `runs` が空でなく `stopped_at` 無し、または `gateway_active_at` が窓の内側 → `alive`。それ以外で `stopped_at` あり → `paused`、無し → `disappeared`。`runs.length >= 2` → `duplicated`
- `reachable(row)`: いずれかの run が `connected` か `terminal_id` を持つ (旧 `live_unmanaged` の否定)
- `waiting(agentsRow, status)`: `waiting_for` か `api_error` がある (user role だけが材料を持つ。session role は `runs` と `stopped_at` で足りる)

### 3. 重複 (`runs.length >= 2`) の扱い

- `session_status` を `frozen` にし、`session.status` の更新と transcript の追記配信を止める。最後に信頼できた値はそのまま述べる
- `message.send` / `notify.send` / `session.dump.write` / `file.*` / `dir.*` は `session_duplicated` で断る。保留しない (下書きは client 側にある)
- `session.kill` に `pid` (任意) を足す。`runs` が 2 つ以上で `pid` 無しなら `ambiguous_run` で断り、client は `peers.runs` から選ぶ (エラー本体は `{code, msg}` のまま)。`pid` があれば instance はそれが `runs` にあること (pid と `started_at`) を確認してから signal する。run が 1 つなら今までどおり sid から解決する
- instance は自動で片方を止めない、jsonl を直さない、どちらが正しいかを推定しない。判断材料は `runs` の各要素と `agents` の行 (`waiting_for`、それに繋がっている teammate と subagent) で述べる
- `runs.length` が 2 未満に戻ったら (1 でも 0 でも) `session_status` を `folding` から始め直す (畳みの cache は捨てる。offset が信用できない)。0 の時も transcript は残るので `absent` にはならない

### 4. 状態ファイルより前の run

launcher (hyoui 等) が起動した pid は、ハーネスが `sessions/` の状態ファイルを書く前から `agents` に `sid` 無しで載る (`terminal_id` と `started_at` はある)。挨拶 (`hello.session`) に `pid` (**ハーネス本体のプロセスの pid**。hook や CLI が代理で送る時は親の pid) を足し、instance が launcher の pid と結んで `sid` を付ける。launcher を通らずに起動したものは状態ファイルに現れた時点で載る (それ以前は観測できない)。

### 5. 版と変更の範囲

破壊的変更なので契約は major を上げ、client (webui / CLI / plugin) は同時に追従する。変わるもの:

- 削除: `SessionState`、`peers.state`
- 追加: `peers.runs`、`peers.session_status`、`hello.session.pid`、`session.kill.pid` (任意)、エラー `session_duplicated` (`message.send` / `notify.send` / `session.dump.write` / `file.*` / `dir.*`) と `ambiguous_run` (`session.kill`)、定数 `GATEWAY_LIVE_WINDOW_MS`、関数 `liveness` / `reachable` / `waiting`
- 変更: `agents` の鍵 (`instance` + `pid`) と `AgentRemoved`、`agents.sid` を任意に、`terminal_id` の形式と terminal URL の合成規則、fixture (`state` 値、`terminal_id`)
- 書き換え: DESIGN §Session classification and retention (classification は instance が導出して行に載せる、の段落と `protocol_version` の説明)、`session.kill` の doc (「pid は受け取らない」)、`hello.session` の doc (terminal URL)

## Alternatives Considered

- 案 A: `SessionState` に `starting` / `loading` / `duplicated` を足す
  - 不採用理由: 1 つの enum が複数の軸 (プロセスの数、畳みの進行、人が答えるべきもの、停止の宣言) を表すことになり、値が増えるたびに組み合わせが破綻する。言えないことが出たのは値が足りないからではなく軸が混ざっているから
- 案 B: 変数を細かく分けて全部に名前を付ける (`fold` / `turn` / `exit` / `manageable` / `liveness` 等を線上に)
  - 不採用理由: 使う場所を名指しできない導出に名前を付けるだけになり、既存フィールド (`stopped_at` / `gateway_active_at` / `waiting_for` / `api_error`) と重複した。足すのは問いに答えるフィールドだけでよく、導出は関数で持つ
- 案 C: 挨拶前の run を別 topic (`launches`) にする
  - 不採用理由: run は挨拶の前後で同じ物。`agents` の鍵を pid にして `sid` を任意にすれば足り、topic を分けると挨拶の瞬間に行が移動して client が結び直す
- 案 D: 重複を検出したら新しい方 (または古い方) を正として 1 行に畳む
  - 不採用理由: どちらを畳むべきかは決められない (新しい方がバイナリが新しい可能性がある一方、teammate は古い方が保持している等)。隠すと人は重複の存在すら知れない。現行の後勝ちがこの状態
- 案 E: `runs` を線上に載せず `agents` から導出する
  - 不採用理由: `agents` は user role にしか配られず、session role (`ccmsg peers`) が run の有無を知れなくなる。`runs` は観測そのもの (どのプロセス・接続がこの sid を名乗っているか) なので線上でよい
- 案 F: `session.kill` は今までどおり sid だけを受ける
  - 不採用理由: 「pid を caller に言わせるより instance が sid から解決する方が安全」は run が 1 つの時の理由で、2 つある時は sid から一意に解決できない。pid を受けても instance は `runs` (pid + `started_at`) と照合するので、caller の主張をそのまま信じるわけではない

## Consequences

- webui の URL は `sid[.pid]`。`sid` は通常モード (`runs` が 2 つ以上なら run を選ばせて `sid.pid` へ)、`sid.pid` は制限モード (判断材料、terminal リンク、その run の kill、凍結表示だけ。send / dump / file は不可)。`runs` が 1 つなのに `sid.pid` で来たら通常モードへ誘導、その pid が `runs` に無ければ「この run は終了した」と示して `sid` へ
- daemon は `sessions/` の走査と接続を pid 単位で持つ (`Map<Sid, …>` をやめる)。launcher が起動した pid は状態ファイルより前から `agents` に載る
- `session.status` の開始応答は `session_status = ready` まで待つ (既定)。待っている間の理由は `peers.session_status = folding` が述べる
- 重複中に jsonl を壊し合うことは防げない (ハーネスの挙動)。契約が保証するのは「隠さない」「壊れた読みを正として述べない」まで

## 関連

- [DR-0011](DR-0011-instance-derives-the-classification.md) — 本 DR が置き換えた分類 (`SessionState` / `peers.state`)
- ccmsg (daemon) `docs/decisions/DR-0015-async-io-principle.md` (fold を頭から畳む、開始応答は畳み終えてから)
- ccmsg (daemon) `docs/QUESTIONS.md` CT-Q10
- `docs/DESIGN.md` §Session classification and retention (本 DR で書き換える)
