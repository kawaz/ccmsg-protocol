# DR-0025: 上流の語彙を持つ型に mark を付け、綴りだけは揃える

- Status: Active — ✅ 実装済
- Date: 2026-09-14

## Context

線上を流れる型の一部は、語彙が ccmsg の物ではない (`AgentInfo` は harness の、`LlmRequestInfo` と `LlmStatusReport` は gateway の語彙)。これらは向こうの都合で値が増える。閉じた型として検証すれば、上流が 1 つ足すたびに検証が落ちる。

## Decision

- 語彙が上流に属する型は `upstream()` が付ける mark を持つ (`src/upstream.ts`)
- mark が述べるのは **見慣れない値は向こうが足した物である**ということだけ。その型を綴りの規約から免除しない
- 上流の document は daemon が取り込む時点で snake_case と Unix ミリ秒に書き換える。線上を流れるのは **この契約の綴り**

## Alternatives Considered

- 案 A: 上流由来の型も閉じた union として検証する
  - 不採用理由: 上流が値を 1 つ足すたびに検証が落ち、ccmsg が追いつくまで観測が止まる
- 案 B: mark を「規約の免除」として扱い、上流の綴りのまま流す
  - 不採用理由: 線上に 2 通りの綴り (camelCase と snake_case、秒とミリ秒) が混ざり、読み手は型ごとにどちらかを覚えることになる
- 案 C: mark を持たず、全ての型を開いたままにする
  - 不採用理由: 「知らない値が来てよい型」と「来たら誤りである型」の区別が線上から読めなくなる

## Consequences

- 上流が値を足しても契約は動かず、追従が要るのは daemon の書き換えだけ
- 上流の型に新しいフィールドを足す時も、綴りはこの契約の規約に従う ([DR-0023](DR-0023-naming-rules-machine-checked.md))

## 関連

- [DR-0023](DR-0023-naming-rules-machine-checked.md) — 綴りの規約と機械検査
- `docs/DESIGN.md` §What the contract holds
