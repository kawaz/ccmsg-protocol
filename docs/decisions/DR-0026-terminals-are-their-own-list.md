# DR-0026: 端末は端末の一覧として述べ、セッションとはマッピングで結ぶ

- Status: Active — ✅ 実装済
- Date: 2026-09-15

## Context

端末 (hyoui のセッション等) は今、`agents` の行の `terminal_id` としてしか現れない。つまり「セッションが持つ属性」として扱われている。しかし端末はセッションと独立に存在する: 人が `hyoui run --detach -- zsh -i` で開いた端末はどのセッションにも属さないし、セッションが終わった後も端末は残る。起動直後のハーネス (状態ファイルも挨拶もまだ無い) が居る端末は、端末の側からしか観測できない (DR-0001 §4)。

利用者が判断したい問い:

| 問い | 今の契約で答えられるか |
|---|---|
| このホストにどんな端末があるか (セッションに属さないものも) | 答えられない |
| この端末を開くには | `terminal_id` が `agents` に載る時だけ |
| このセッションはどの端末で走っているか | `agents.terminal_id` (セッションが挨拶か状態ファイルを持つ時だけ) |
| 起動したが状態ファイルも無いハーネスがどの端末に居るか | 答えられない |

## Decision

### 1. `terminals` topic

端末の一覧を `terminals` topic (element granularity、鍵 `instance` + `id`) で述べる。行は端末管理の観測をそのまま運ぶ:

| フィールド | 値 |
|---|---|
| `id` | `TerminalId` (`<scheme>:<id>`、例 `hyoui:run-20107-ce44c928`)。scheme が観測源を示す |
| `state` | 端末管理の語 (open set) |
| `command` | 端末で走っているコマンド (argv) |
| `cwd` | 端末の作業ディレクトリ |
| `pid` | 端末の中の主プロセスの pid (無ければ省略) |
| `started_at` | 端末の開始時刻 |

`TerminalRemoved` は `{instance, id, removed}`。role は `user` のみ (端末はホストの資源で、セッションが他のセッションの端末を知る理由が無い)。

### 2. セッションとの結び付きは導出

`agents.terminal_id` は残すが、正本は `terminals` の行と `agents` の行の **pid の一致** である。契約が関数で export する:

- `terminalsOf(sid, agents, terminals)`: その sid の run (`agents` の行) の pid を持つ端末
- `unattachedTerminals(agents, terminals)`: どの run にも結ばれていない端末 (人が開いた端末、起動直後でまだ状態ファイルの無いハーネスの端末)
- `starting(terminals, agents)`: `pid` があるのに `agents` に同じ pid の行が無い端末 (= 起動したが状態ファイルも挨拶も無いハーネス。DR-0001 §4 の「状態ファイルより前の run」はこれで言い、`agents` に `sid` 無しの行を載せる必要は無い)

`agents.terminal_id` は端末管理を持たない instance が state file から知る値のために残し、`terminals` がある時は pid の一致が優先する。

### 3. 開き方

端末の URL は `terminalUrl(gateway, id)` (DR-0001) のまま。client は `terminals` の行から直接開ける (セッションを経由しない)。

## Alternatives Considered

- 案 A: launcher が起動した端末を `agents` に `sid` 無しの行として載せる (DR-0001 §4 の当初の形)
  - 不採用理由: `agents` は「ハーネスから見たプロセス」の一覧で、端末管理から見た情報を混ぜると出所が 2 つになる。端末を独立の一覧にすれば、`starting` は 2 つの一覧の差として導出でき、人が開いた端末も同じ一覧に出る
- 案 B: 端末をセッションの子として管理する (`peers` の行に `terminals: []`)
  - 不採用理由: どのセッションにも属さない端末を置く場所が無くなる。セッションが終わった端末は消えるのでなく一覧に戻るべきで、それは「端末の一覧が正本、マッピングは導出」の形でしか言えない
- 案 C: hyoui の語彙 (`child_pid` / `child_state` / `session_id`) をそのまま線上に載せる
  - 不採用理由: 契約が特定の端末管理に依存する。端末一般の語 (`pid` / `state` / `id`) にして scheme で出所を示せば、別の端末管理 (tmux 等) も同じ行で述べられる

## Consequences

- daemon は端末管理を polling する (`hyoui list --format=json`、`agents` の `claude agents --json` と同じ置き方)。端末管理が無い instance は `terminals` を空で述べる
- webui は端末の一覧 (`/terminals`) と端末の画面 (`/terminal/<id>`) を持ち、セッションの画面には `terminalsOf(sid)` の端末を配下に見せる。セッションが終わればその端末は一覧に戻る
- DR-0001 §4 の実装 (launcher が `agents` に載せる) は行わない。`starting` は `terminals` × `agents` の導出
- 契約は minor (topic と関数の追加)

## 関連

- [DR-0001](DR-0001-session-and-run.md) §4 (状態ファイルより前の run) — 本 DR で導出に置き換える
- ccmsg (daemon) issue `launcher-run-before-state-file`
