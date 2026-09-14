# DR-0001: セッションと run を分け、`SessionState` を観測されるフィールドに置き換える

- Status: Active
- Date: 2026-09-14

## Context

契約は `peers` の行を sid で識別し、状態を 1 つの `SessionState` (`waiting` / `live` / `live_unmanaged` / `paused` / `disappeared`) で述べている。この 1 語は「プロセスが何個あるか」「人が答えるべきものが出ているか」「停止を宣言したか」「送れるか」を同時に表しており、次の 3 つが言えない。

- 同じ sid のプロセスが 2 つ走っている (走行中の sid を resume した時にハーネスが許す)。daemon は `sessions/` の状態ファイルを `Map<Sid, …>` に畳むので後勝ちで 1 行になり、重複の存在自体が client に見えない。fork した時点以降の jsonl は両方のプロセスが壊し合うので信頼できず、読み位置の byte もずれる
- 起動したが挨拶も transcript もまだ無い (初回ディレクトリの trust 確認で TUI が止まっている等)。pid と terminal だけがある段階を人が見分けられず、「起動したはずなのに webui に来ない」の原因を追えない
- transcript はあるが状態の畳みが終わっていない。`session.status` の開始応答が畳み終えるまで返らない間、なぜまだ無いかを述べる語が無い

一方、これらの問いに答えるフィールドの大半は既にある: `stopped_at` (停止の宣言)、`send_message` (送れるか)、`agents.waiting_for` と `session.status.api_error` (人が答えるべきもの)。足りないのはプロセスの数と畳みの進行だけで、`SessionState` はそれらを 1 語に押し込めるために存在していた。

## Decision

### 1. 二つの実体

- **セッション** (鍵 `sid`): transcript、畳んだ状態、dump、履歴。ファイルに対応し、プロセスが 0 個でも 2 個でも 1 つ。`peers` の行
- **run** (鍵 `instance` + `pid`): 生存、terminal、接続、`session.stop` / `notify` / `message.send` の宛先。プロセスに対応する。`agents` の行

### 2. 線上のフィールド

利用者が判断したい問いと、それに答えるフィールド:

| 問い | フィールド | 新規 / 既存 | 値 |
|---|---|---|---|
| この sid のプロセスは何個あるか、stop の宛先はどれか | `peers.runs` | 新規 | `{instance, pid}[]` |
| `session.status` の値を信じてよいか、なぜまだ無いか | `peers.session_status` | 新規 | `absent` (transcript 無し) / `folding` / `ready` / `frozen` (重複中) |
| 停止を宣言したか | `peers.stopped_at` | 既存 | 時刻。`runs` が空の時だけ意味を持つ |
| send を受けられる run があるか | `peers.send_message` | 既存 | boolean |
| 人が答えるべきものが出ているか | `agents.waiting_for`、`session.status.api_error` | 既存 | ハーネスの語 / 上流エラー |
| この run はどのセッションか | `agents.sid` | 新規 (任意) | 無ければ「起動したが sid 未定」 |
| この run はどう開くか | `agents.terminal_id` | 既存、形式を変更 | `<scheme>:<id>` (例 `hyoui:<id>`)。scheme で開き方を決める |

`SessionState` と `peers.state` は削除する。旧 5 値は上のフィールドから言える: `paused` = `runs` 空 ∧ `stopped_at` あり、`disappeared` = `runs` 空 ∧ `stopped_at` 無し、`live` = `runs` 1 個、`waiting` = `waiting_for` か `api_error` あり、`live_unmanaged` = `send_message` false ∧ `terminal_id` 無し。重複は `runs.length >= 2` で、これは名前を持つ導出 (`duplicated`) として契約が関数で export する (instance と client が同じ実装を呼ぶ。線上には載せない)。

### 3. 重複 (`runs.length >= 2`) の扱い

- `session_status` を `frozen` にし、`session.status` の更新と transcript の追記配信を止める。最後に信頼できた値はそのまま述べる
- `message.send` / `notify` / `session.dump.write` / file 系 op は `session_duplicated` で断る。保留しない (下書きは client 側にある)
- `session.stop` は `pid` 必須。sid だけなら `ambiguous_run` で `runs` を返す
- instance は自動で片方を止めない、jsonl を直さない、どちらが正しいかを推定しない。判断材料は `agents` の各行 (`pid`、`terminal_id`、`waiting_for`、開始時刻、それに繋がっている teammate と subagent) で述べる
- `runs.length` が 1 に戻ったら `session_status` を `folding` から始め直す (畳みの cache は捨てる。offset が信用できない)

### 4. 挨拶前の run

launcher (hyoui 等) が起動した pid は、挨拶も transcript も無い間から `agents` に `sid` 無しで載る (`terminal_id` はある)。挨拶 (`hello.session`) に pid を載せ、instance が launcher の pid と結んで `sid` を付ける。launcher を通らずに起動したものはハーネスの状態ファイルに現れた時点で載る (それ以前は観測できない)。

### 5. 版

`SessionState` / `peers.state` の削除と `agents.sid` の追加は破壊的変更。契約は major を上げ、client (webui / CLI / plugin) は同時に追従する。

## Alternatives Considered

- 案 A: `SessionState` に `starting` / `loading` / `duplicated` を足す
  - 不採用理由: 1 つの enum が複数の軸 (プロセスの数、畳みの進行、人が答えるべきもの、停止の宣言) を表すことになり、値が増えるたびに組み合わせが破綻する。言えないことが出たのは値が足りないからではなく軸が混ざっているから
- 案 B: 変数を細かく分けて全部に名前を付ける (`fold` / `turn` / `exit` / `manageable` / `liveness` 等)
  - 不採用理由: 使う場所を名指しできない導出に名前を付けるだけになり、既存フィールド (`stopped_at` / `send_message` / `waiting_for` / `api_error`) と重複した。足すのは問いに答えるフィールドだけでよい
- 案 C: 挨拶前の run を別 topic (`launches`) にする
  - 不採用理由: run は挨拶の前後で同じ物。`agents` の行に `sid` を任意で持たせれば足り、topic を分けると挨拶の瞬間に行が移動して client が結び直す
- 案 D: 重複を検出したら新しい方 (または古い方) を正として 1 行に畳む
  - 不採用理由: どちらを畳むべきかは決められない (新しい方がバイナリが新しい可能性がある一方、teammate は古い方が保持している等)。隠すと人は重複の存在すら知れない
- 案 E: 導出 (`duplicated` 等) を線上のフィールドとして instance が述べる
  - 不採用理由: 観測と導出が同じ行に並ぶと client は「どちらを信じるか」を持つ。導出を契約の関数にすれば 1 実装で済み、線上は観測だけになる

## Consequences

- webui の URL は `sid[.pid]`。`sid` は通常モード (`runs` が 2 つ以上なら run を選ばせて `sid.pid` へ)、`sid.pid` は制限モード (判断材料、terminal リンク、その run の stop、凍結表示だけ。send / dump / file は不可)。`runs` が 1 つなのに `sid.pid` で来たら通常モードへ誘導、その pid が無ければ「この run は終了した」と示して `sid` へ
- daemon は `sessions/` の走査と接続を pid 単位で持つ (`Map<Sid, …>` をやめる)。launcher が起動した pid は挨拶前から `agents` に載る
- `session.status` の開始応答は `session_status = ready` まで待つ (既定)。待っている間の理由は `peers.session_status = folding` が述べる
- 重複中に jsonl を壊し合うことは防げない (ハーネスの挙動)。契約が保証するのは「隠さない」「壊れた読みを正として述べない」まで

## 関連

- ccmsg (daemon) `docs/decisions/DR-0015-async-io-principle.md` (fold を頭から畳む、開始応答は畳み終えてから)
- ccmsg (daemon) `docs/QUESTIONS.md` CT-Q10
- `docs/DESIGN.md` §Session classification and retention (本 DR で書き換える)
