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
| 識別子 | `src/identifiers.ts` | `sid` / `instance` / `mid` / role / capability / 時刻 |
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
| common | 全員 | 接続 (`hello` / `instance_ping` / `instance_shutdown`) と購読 (`topic_subscribe` / `topic_unsubscribe`) |
| messaging | エージェント (session role)、人 (webui 経由の user role) | sid 宛の 1 対 1 配送、say、notify |
| control | webui、CLI の管理コマンド (user role) | セッション観測・操作、ファイル、launcher、sandbox、llm、診断 |
| mesh | instance 同士 | op を持たない。封筒の `to_instance` / `from_instance` / `hops` だけ |

4 面は同じ型システム・同じ封筒・同じエラー体系を共有する。面は op 属性表の 1 列であって、
別々のスキーマではない。

messaging は会話の器 (room) を持たない。宛先は sid ひとつで、会話ログの正本は
セッションの transcript にある。返信経路も契約に文字列としては載らず、配送 frame の
`from` に返せば返信になるという構造だけを置く。

即時配送されなかった送信は失敗ではない。応答は inbox に積んだことと、その理由 (相手が
準備中 / Paused / 消えている / instance に届かない / inbox が一杯 / 相手が今は受け取らない)
を返し、送信側が待つか別セッションへ送り直すかを選べるようにする。

## op 属性表

`OP_ATTRIBUTES` が全 op について次を宣言する。認可・能力判定・転送はすべてこの表を引き、
各所に同型の分岐を置かない。

| 属性 | 用途 |
|---|---|
| `plane` | 面の所属 |
| `roles` | 呼べる role。外の role は `forbidden` |
| `needs_hello` | `hello` で identity が確定していることを要求するか (`hello` / `instance_ping` 以外は要) |
| `capability` | 必要な能力。`hello` が返す集合に無ければ `capability_unavailable` |
| `locality` | `instance-local` な op は担当 instance へ転送。届かなければ `instance_unreachable` |
| `scope` | role で「可否」でなく「応答の可視範囲」が変わる op に付く |
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

## 表記規約 (機械検査あり)

- 時刻は Unix ms の整数で、名前は `*_at`。長さは単位を名前に持つ (`*_ms` / `*_secs`)
- フィールドは snake_case、op は `<名詞>_<動詞>` (`hello` のみ単語 1 つ)
- 「不明」は省略、「無い」は空配列
- 識別子: `sid` は uuid でグローバル、`instance` は endpoint URL でパスまで含めた完全一致、
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
(instance が導けるものは導く)。

一覧の分類 (`state`) は **instance が導いて行に載せる**。生の入力を返して client 側で
組み立てると、instance ごとに解釈がずれる。語彙は接続中の 3 つ (`waiting` / `live` /
`live_unmanaged`) と、失われた側の 2 つ (`paused` / `disappeared`) で、両者を分けるのは
`stopped_at` の有無ひとつ。Pinned は人が付けた印であって分類ではないので、`pinned` として
分類の隣に置く。

未配送メッセージと last_live の保持窓は契約が値として持つ (`INBOX_RETENTION_MS` /
`LAST_LIVE_RETENTION_MS` = 7 日、`INBOX_MAX_PER_SID` = 256)。戻ってきた人が見るのは
「セッションと、そこへ言われたこと」のひと組なので、2 つが別の時刻で消えることはない。
件数上限は受け手が 1 セッションぶん保持できる量に合わせ、契約が受け取ったものは受け手に
渡しうるものに保つ。

## 版と互換

`PROTOCOL_VERSION` は世代を表す整数。同一世代内で許すのは任意フィールドと op の追加だけで、
削除と意味変更は世代を上げる。世代の違う相手とは話さない (client 接続も mesh も同じ)。
互換経路は持たない。

## instance と mesh

`instance` の識別子は他 instance が dial する endpoint URL そのもの。同一 origin に複数
instance が相乗りするため、比較は origin ではなく URL 全体で行う。`hello` の応答が自
instance と、mesh で見えている instance の一覧を返す。

instance 間の認証は接続確立時 1 回で、`role: "instance"` の `hello` がその起点になる
(`mesh` フィールド = 名乗りと使い捨て鍵の在り処)。手順の正本は ccmsg 本体リポの
mesh-peer-auth。

## 契約が持つもの

| 単位 | 数 | 内訳 |
|---|---|---|
| op | 36 | common 5 / messaging 4 / control 27 / mesh 0 |
| topic | 10 | messaging 2 (`inbox` / `notify`)、control 8 |
| capability | 9 | `fork` `launcher` `llm_events` `llm_stats` `llm_status` `llm_usage` `sandbox` `terminal` `translate` |
| ErrorCode | 16 | 閉じた union |

全 op が `OP_SCHEMAS` に request / response の対を持ち、全 topic が `TOPIC_SCHEMAS` に frame を
持つ。`OP_SCHEMAS` の型は `Record<OpName, OpSchemas>` なので、属性表に op を足して schema を
書かなければ型検査で落ちる。topic 側も属性表と frame の対応を双方向に検査する。

`claude` / `llm-gateway` が語彙を持つ型 (`AgentInfo` / `LlmRequestInfo` / `LlmStatusReport` 等)
は `upstream()` の印を持つ。印が言うのは「知らない値が来たらそれは上流のもの」であって、
表記規約の免除ではない。上流の文書は daemon が受け取った時点で snake_case と Unix ms に
写され、wire にはこの契約の綴りで出る。
