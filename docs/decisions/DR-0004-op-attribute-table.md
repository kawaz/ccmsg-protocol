# DR-0004: 認可・capability・配置は op 属性表 1 枚から読む

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

「誰が呼べるか」「どの capability が要るか」「どの instance が答えるか」は、認可・capability 判定・転送のそれぞれが自前の分岐として持ちうる。3 箇所が別々に同じ条件を持てば、op を 1 つ足した時に 3 箇所を揃えねばならず、揃っていないことは実行するまで分からない。

## Decision

`OP_ATTRIBUTES` (`src/attributes.ts`) が op ごとに次を述べ、認可も capability 判定も転送も **この表を読む**。

| 属性 | 何を述べるか |
|---|---|
| `plane` | どの面の op か |
| `roles` | 呼べる role。外の role は `forbidden` |
| `needs_hello` | 挨拶で決まった identity が要るか ([DR-0003](DR-0003-hello-before-anything-else.md)) |
| `capability` | 要る capability。挨拶が答えた集合に無ければ `capability_unavailable` |
| `locality` | `owner_instance` は subject を持つ instance へ転送する (届かなければ `instance_unreachable`)、`any_instance` は聞かれた instance が答える |
| `scope` | role によって「呼べるか」ではなく「返してよい内容」が変わる時だけ持つ |
| `carrier` | frame でなく HTTP で運ぶ op に付く |
| `errors` | その op に固有の code |

属性から従う code (`invalid_args` / `hello_required` / `forbidden` / `capability_unavailable` / `instance_unreachable`) は `opErrors()` が導出し、op ごとに列挙しない。

`carrier` が決めるのは **運び方だけ**で、誰が呼べるかは決めない。HTTP で運ぶ op も表に載り、role と capability は他の op と同じ列を持つ。

## Alternatives Considered

- 案 A: 認可を各 op の schema やハンドラに書く
  - 不採用理由: 表として横断で読めないので、「この role は何を呼べるか」が答えられない。実装ごとに分岐が育ち、daemon と web UI の読みが食い違う
- 案 B: error code を op ごとに全部列挙する
  - 不採用理由: capability を 1 つ足すたびに全 op の列挙が古くなる。属性から従う code は導出であって記述ではない
- 案 C: HTTP で運ぶ op を表の外に置く
  - 不採用理由: 認可の分岐を表の外に出すことになる。carrier は運び方の話で、`auth.*` も role と scope を持つ

## Consequences

- op の追加は表への 1 行と schema で完結し、認可・転送のコードは触らない
- 転送の可否 (`locality`) が表にあるので、mesh は自分の op を持たずに済む ([DR-0019](DR-0019-mesh-has-no-ops-of-its-own.md))

## 関連

- ccmsg (daemon) `docs/decisions/DR-0002-contract-holds-the-vocabulary.md`
- `docs/DESIGN.md` §The op attribute table
