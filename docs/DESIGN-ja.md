# ccmsg-protocol 設計

> 🇬🇧 [DESIGN.md](./DESIGN.md)

## ドメイン

このリポジトリが持つのは **wire の契約 1 つ**。誰が何を呼べて、何が返り、どの形の
frame が push されるかを schema として書き、daemon と webui の双方がそれで検証する。

契約が実行可能であること (型だけでなく検証器を伴うこと) が要件。型だけの契約は、
検査を各実装の手書きに委ね、実装ごとに解釈がずれる。

## 契約の層

| 層 | ファイル | 中身 |
|---|---|---|
| 識別子 | `src/identifiers.ts` | `sid` / `instance` / `endpoint` / `mid` / role / capability / 時刻 |
| セッションの記述 | `src/session-meta.ts` | セッションの居場所と実行条件を指す共通フィールド |
| エラー | `src/errors.ts` | `ErrorCode` の閉じた union と error body |
| 封筒 | `src/envelope.ts` | request / response / topic frame / 接続イベント、`PROTOCOL_VERSION` |
| op 属性表 | `src/attributes.ts` | 全 op と、その認可・能力・配置 |
| op 定義 | `src/common/` `src/messaging/` `src/control/` | op ごとの引数・応答と、topic の frame |
| 上流の印 | `src/upstream.ts` | 語彙の持ち主が ccmsg でない型に付ける印 |
| 検証 | `src/schemas.ts` | op 名 → schema の対応と、compile 済み検証器 |

## 面 (plane)

| 面 | 誰が使うか | 中身 |
|---|---|---|
| common | 全員 | 接続 (`hello` / `instance_ping` / `instance_shutdown`)、終了の宣言 (`session_stopping`)、購読 (`topic_subscribe` / `topic_unsubscribe`) |
| messaging | エージェント (session role)、人 (webui 経由の user role) | sid 宛の 1 対 1 配送、say、notify |
| control | webui、CLI の管理コマンド (user role) | セッション観測・操作、ファイル、launcher、sandbox、llm、診断 |
| mesh | instance 同士 | op を持たない。封筒の `to_instance` / `from_instance` / `hops` だけ |

4 面は同じ型システム・同じ封筒・同じエラー体系を共有する。面は op 属性表の 1 列であって、
別々のスキーマではない。

messaging は会話の器 (room) を持たない。宛先は sid ひとつで、会話ログの正本は
セッションの transcript にある。返信経路も契約に文字列としては載らず、配送 frame の
`from` に返せば返信になるという構造だけを置く。

宛先は sid だが、**送信者は sid とは限らない**。`message_send` を呼べるのは session と
user の両 role で、人 (webui) は sid を持たない。だから `from` は `Sender` = `Sid | "user"`
で、リテラルを置くのは「人が送った」と「セッションが送って id が落ちた」を読み分けさせる
ため (省略にすると区別できない)。既存の sid 値はそのまま通る。`user` 宛には送り返せない
ので、人への返信をどう届けるかは instance の裁量に置く。

即時配送されなかった送信は失敗ではない。応答は inbox に積んだことと、その理由 (相手が
準備中 / Paused / 消えている / instance に届かない / inbox が一杯 / 相手が今は受け取らない)
を返し、送信側が待つか別セッションへ送り直すかを選べるようにする。

## 直送時の本文表現

配送 frame を読めない受け手が 1 つだけある。ハーネス自身の messaging socket へ直接
書き込んで渡す経路で、そこでの受け手はクライアントではなくモデルであり、届くのは
1 かたまりのテキストだけになる。frame を見られない以上、**`mid` と `from` が本文に
無ければ返信できない** (何かが届いたことだけ分かって、何にどう返すかが分からない)。
だから直送時の本文表現だけは契約が定める (`renderDirectDelivery` / `parseDirectDelivery`)。

形はハーネス自身の送信側規約に乗せる。本文に `<cross-session-message>` を埋め、
`from` / `from-name` / `from-mode` は受信ハーネスが読む origin、`ccmsg-mid` /
`ccmsg-from` / `ccmsg-reply-to` は契約側の識別子を置く。本文の `from` は `ccmsg` 固定で、
sid も `uds:` パスも書かない — それらはハーネスが実際にダイヤルする宛先で、消えた相手に
ダイヤルすると受信側のターンが失敗で終わる。書き込む frame 側の `from` はこれとは別で、
instance が送達ステータスを受ける `uds:` パスを名乗ってよい。その receipt は `refused` /
`denied` / `dropped` / `expired` / `held` の否定応答だけで、肯定応答は無い (= 期限内の
沈黙が配送成功)。返る道は本文末尾の 1 行
(`Reply with: ccmsg reply <mid> --to <sid> <text>`) で、これは受け手自身が実行する。
宛先 sid を書き下すのは `mid` が送信者を含まないため。引かせる形にすると mid → 送信者の
op が要り、そのために daemon が送信済み索引を持つことになる。

送信者が人 (`from` が `user`) の場合だけ `--to` が落ちて
`Reply with: ccmsg reply <mid> <text>` になる。`user` は sid ではないので `--to user` は
届かない宛先になる。その返信が何になるか (webui へ notify として流す等) は instance の
裁量で、受け手はこの 1 行を実行するだけでよい。

`text` は無加工で運ぶ。モデルが読むのはその文字そのものなので、実体参照に置き換えると
壊れた本文を返信対象として渡すことになる。本文に閉じタグが含まれていても拒否せず
(部分文字列 1 つでメッセージを失わせない)、閉じタグは末尾から探す。属性値だけは
引用符の外へ出られないよう `&` `<` `>` `"` を実体参照にする。

## op 属性表

`OP_ATTRIBUTES` が全 op について次を宣言する。認可・能力判定・転送はすべてこの表を引き、
各所に同型の分岐を置かない。

| 属性 | 用途 |
|---|---|
| `plane` | 面の所属 |
| `roles` | 呼べる role。外の role は `forbidden` |
| `needs_hello` | `hello` で identity が確定していることを要求するか (`hello` / `instance_ping` / identity を確定させる 4 op 以外は要) |
| `capability` | 必要な能力。`hello` が返す集合に無ければ `capability_unavailable` |
| `locality` | `instance-local` な op は担当 instance へ転送。届かなければ `instance_unreachable` |
| `scope` | role で「可否」でなく「応答の可視範囲」が変わる op に付く |
| `carrier` | WS の frame でなく HTTP で運ぶ op に付く。誰が呼べるかは carrier では決まらない (下記) |
| `errors` | その op に固有のコード |

属性から決まるコード (`invalid_args` / `hello_required` / `forbidden` /
`capability_unavailable` / `instance_unreachable`) は表に書かず `opErrors()` が導く。
op に capability を足した時に error 一覧が古びない。

## 観測系は snapshot + delta の 1 形

観測できるものは topic として購読する。`topic_subscribe` の直後に現在値が
`snapshot: true` 付きの frame で 1 回届き、以後は同じ payload 型で変化が届く。
one-shot の取得 op は置かない (購読して即解除すれば同じものが得られる)。

frame は発生元の `instance` を必ず伴う。全量置換の意味を持つ topic は
instance ごとの全量置換になり、複数 instance の全量が衝突しない。

payload 型が同じであるぶん、「後続の frame が手元の値に対して何をするか」だけは形から
読めない。それを `TOPIC_ATTRIBUTES` の `granularity` として契約が持ち、daemon と webui が
同じ表で畳む (各実装がローカル表を持たない)。

| granularity | frame が持つもの | 購読側の畳み方 | snapshot | topic |
|---|---|---|---|---|
| `whole` | 値の全体 | 手元を丸ごと置換 | 有 | `session_status:<sid>` |
| `per_instance_whole` | その `instance` が知る全体 | その instance の分だけ置換し、他 instance の行は残す (手元の値は instance 横断の和) | 有 | `peers` `agents` `session_errors` `llm_requests` `llm_status` |
| `element` | 変化した要素 | 要素の id で突き合わせて追加・更新。触れられなかった要素はそのまま。削除は印を付けた要素として届く (変化の一覧における不在は何も言わない) | 有 | `inbox` `kv:<ns>` `auth_records` |
| `append` | 前回以降に増えた分 | 末尾に足すだけで、既にあるものは書き換えない | 有 | `transcript:<sid>` |
| `event` | 発生そのもの (値ではない) | 保持しない | 無 | `notify` |

`event` だけが snapshot を持たない。保持するものが無いので購読しても現在値は来ず、次の
発生から届く。`session_status` が instance ごとでなく全体置換なのは、1 セッションが 1
instance にしか居らず、他 instance の分を残す必要が無いため。

## 表記規約 (機械検査あり)

- 時刻は Unix ms の整数で、名前は `*_at`。長さは単位を名前に持つ (`*_ms` / `*_secs`)
- フィールドは snake_case、op は `<名詞>_<動詞>` (`hello` のみ単語 1 つ)
- 「不明」は省略、「無い」は空配列
- 識別子: `sid` は uuid でグローバル、`instance` は instance が自分に発行する不透明な
  乱数 (16 byte の hex)、`endpoint` は dial 先の URL でパスまで含めた完全一致、
  `mid` は `<instance>/<連番>`

上 2 つは `test/conventions.test.ts` が全 schema を走査して検査する。

## 共有 kv

control 面に namespace 付きの kv (`kv_read` / `kv_write` / `kv_delete`) がある。契約が約束するのは
**ns 内で key が一意**なことだけで、`value` は任意の JSON、意味は書き手と読み手のものになる。

kv だけは control 面で唯一 `locality: cluster`。値は特定の instance ではなくクラスタが持つので、
どの instance に聞いても答えられる。instance 間のミラーは daemon の責務で、食い違った時は
`updated_at` の新しい方が残る。だから書き込みは `updated_at` を明示でき、届かなかった間に
書かれた値が後から実際の時刻のまま合流できる。

topic `kv:<ns>` が他クライアントの保存を即時に見せる。snapshot は ns の全 entry、以後の frame は
変化した entry で、**削除は `deleted: true` を付けた entry として届く** (変化の一覧における不在は
何も言わないため)。ns が topic 名の一部になるので、ns は識別子に限る (key は人が打った文字列を
許し、長さと制御文字だけを縛る)。

## セッションの分類と保持窓

セッションの居場所と実行条件 (`repo` / `ws` / `cwd` / `repo_root` / `branch` /
`transcript_path` / `title` / `model` / `effort`) はセッション自身が `hello` で名乗り、
instance が `peers` の各行でそのまま返す。名前と型は 1 箇所 (`src/session-meta.ts`) に
置き、名乗る側と返す側で綴りが分かれないようにする。名乗られなかったものは省略される
(instance が導けるものは導く)。名乗りはフィールド単位で取り込まれ、名乗らないことは撤回では
なく不変を意味する (1 セッションは短命プロセスの連なりとして届き、どのプロセスも全フィールドを
知らない)。

一覧の分類 (`state`) は **instance が導いて行に載せる**。生の入力を返して client 側で
組み立てると、instance ごとに解釈がずれる。語彙は接続中の 3 つ (`waiting` / `live` /
`live_unmanaged`) と、失われた側の 2 つ (`paused` / `disappeared`) で、両者を分けるのは
`stopped_at` の有無ひとつ。Pinned は人が付けた印であって分類ではないので、`pinned` として
分類の隣に置く。

`stopped_at` が付く入口は `session_stopping` ひとつ。セッションが自分で「これから止まる」と
宣言し、その後に切断が来る、という順序を instance が守る。宣言せずに消えたセッションは
`disappeared` になる — つまり「意図して止まった」と「落ちた」の差は観測ではなく宣言の有無で
決まる。呼ぶのはセッション自身 (role は session のみ) で、ハーネスの終了フックや `ccmsg` の
CLI がその代理になる。

**忙しさも分類ではなく行の属性**で、`gateway_active_at` (最後に推論が走った時刻) として
載せる。接続中のどの分類であっても忙しくはなり得るので、`state` に畳むと片方が失われる。
真偽値でなく時刻なのは「リクエストが飛び終わった瞬間」を観測するものが無いため — client
が新しさを見て自分の閾値で判断する。gateway を持たない instance では欠ける (= 静か、では
なく観測手段が無い)。

未配送メッセージと last_live の保持窓は契約が値として持つ (`INBOX_RETENTION_MS` /
`LAST_LIVE_RETENTION_MS` = 7 日、`INBOX_MAX_PER_SID` = 256)。戻ってきた人が見るのは
「セッションと、そこへ言われたこと」のひと組なので、2 つが別の時刻で消えることはない。
件数上限は受け手が 1 セッションぶん保持できる量に合わせ、契約が受け取ったものは受け手に
渡しうるものに保つ。

## 送る側が守る上限

守れるのが送る側だけの上限は、契約が値として持つ。相手だけが知っている上限は、超えた時に
「なぜ落ちたか」を送信側が読み取れないため。

`MAX_FRAME_BYTES` = 1 MiB は 1 frame (改行区切りの 1 行、request / response / topic frame
のいずれも) の上限。超えた frame は `bad_request` になるが接続は保たれる。1 MiB を超える
本文をどう扱うか (分割する / ファイルに書いて参照を送る) は呼ぶ側の判断なので、契約は
上限だけを置いて回避策は置かない。

`TITLE_MAX_CHARS` = 200 は `session_rename` の `title` の上限で、schema の `maxLength` と
同じ値。title は端末に打ち込まれてセッションの 1 行目になるので、端末が受け付けるかどうか
とは別に読める長さで頭打ちにする。

## 版と互換

`PROTOCOL_VERSION` は世代を表す整数。同一世代内で許すのは任意フィールドと op の追加だけで、
削除と意味変更は世代を上げる。世代の違う相手とは話さない (client 接続も mesh も同じ)。
互換経路は持たない。

## instance と mesh

**identity は `instance` (id)、dial 先と TLS の照合先は `endpoint` (URL)** で、2 つは別の型。
id は instance が自分に 1 度だけ発行する不透明な乱数で、引っ越しても変わらない。endpoint は
他 instance が dial する URL で、同一 origin に複数 instance が相乗りするため比較は origin
ではなく URL 全体で行う。id で参照されるもの (`mid`、kv の鍵、record と token の発行者) は
endpoint が変わっても無効にならない。`hello` の応答は自 instance の id と endpoint、および
mesh で見えている instance の一覧 (各 id + endpoint + 可達性) を返す。

instance 間の認証は接続確立時 1 回で、`role: "instance"` の `hello` がその起点になる
(`mesh` フィールド = 名乗りと使い捨て鍵の在り処)。`iss` / `aud` の照合値は endpoint —
信頼の根は URL にしかない。名乗る `id` は同じ hello に載り、proof が通った時点で hello の
内容ごと信頼されるので、受け側は「認証済み endpoint ↔ id」の対応表を持つ。以後 `to_instance`
の id から dial 先を引くのはこの表。1 つの id が束縛できる link は 1 本で、既に別 endpoint に
束縛済みの id を名乗る hello は新しく来た側を閉じる (既存の束縛を優先する)。手順の正本は ccmsg
本体リポの mesh-peer-auth。

転送された request の認可は転送先が全段やり直す。封筒の `caller` (`role` と、session なら
`sid`) が dispatch の identity で、転送元の認可結果は引き継がない。信じるのは identity の
主張だけ — 転送元は認証済み peer なので「誰が呼んだか」の申告は信じる、という 1 deployment
内でだけ成り立つ前提に立つ。`caller` の無い転送 request は接続そのものの role (`instance`)
で扱われ、instance-local op は属性表どおり `forbidden` になる。同じ instance を 2 度通る
request は封筒の `hops` で落とし、ループさせない。

mesh の断絶は購読からも見える。`peers` の frame は発生元 instance が見た instance 一覧
(`instances`、`reachable` 付き) を任意で載せられるので、断絶を知るために `hello` を叩き直す
必要が無い。`reachable` は発生元から見た可達性なので、2 つの instance が食い違うことは
正常にあり得る。

## 人の認証

契約が持つのは **wire の形だけ**。手順 (passkey の登録・検証、cookie、record の複製、
challenge の転送先) の正本は ccmsg 本体リポの DR-0001 で、ここに複製しない。

人の identity を確定させる 4 op (`auth_challenge` / `auth_register` / `auth_assert` /
`auth_refresh_token`) は **HTTP で運ぶ**。cookie の読み書きと、接続が成立する前に答える
ことが WS の frame では出来ないため。それでも属性表に居るのは、**認可の分岐を表の外に
置かないため** — carrier が決めるのは「その op に何が出来るか」であって「誰が呼べるか」
ではない。この 4 つは `needs_hello: false` で、`hello` と同じく identity 未確定の接続から
呼べる (`request_id` は HTTP 側の carrier が合成する)。

残り 3 op:

- `auth_refresh` は WS。生きている接続の期限 (`hello` 応答の `auth_expires_at`) を、
  切らずに延ばす
- `auth_resolve` / `auth_rotate` は instance 間 (`roles: ["instance"]`、`locality:
  instance-local`)。発行者にしか答えられないもの — 登録 URL の検証、challenge の使い切り、
  token family の rotate — を `to_instance = iss` で発行者へ転送する

credential record と token family は topic `auth_records` (`roles: ["instance"]`、element 粒度)
で複製する。kv に載せないのは、kv は user role が読み書きできるため — token が読めれば
その人のセッションになり、credential が書ければ新しい入口になる。削除は tombstone という
要素として届く (変化の一覧における不在は何も言わないので)。

## 契約が持つもの

| 単位 | 数 | 内訳 |
|---|---|---|
| op | 44 | common 13 / messaging 4 / control 27 / mesh 0 |
| topic | 11 | messaging 2 (`inbox` / `notify`)、control 8、common 1 (`auth_records`) |
| capability | 9 | `fork` `launcher` `llm_events` `llm_stats` `llm_status` `llm_usage` `sandbox` `terminal` `translate` |
| ErrorCode | 20 | 閉じた union |

全 op が `OP_SCHEMAS` に request / response の対を持ち、全 topic が `TOPIC_SCHEMAS` に frame を
持つ。`OP_SCHEMAS` の型は `Record<OpName, OpSchemas>` なので、属性表に op を足して schema を
書かなければ型検査で落ちる。topic 側も属性表と frame の対応を双方向に検査する。

`claude` / `llm-gateway` が語彙を持つ型 (`AgentInfo` / `LlmRequestInfo` / `LlmStatusReport` 等)
は `upstream()` の印を持つ。印が言うのは「知らない値が来たらそれは上流のもの」であって、
表記規約の免除ではない。上流の文書は daemon が受け取った時点で snake_case と Unix ms に
写され、wire にはこの契約の綴りで出る。
