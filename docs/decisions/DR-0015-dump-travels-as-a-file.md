# DR-0015: dump は path を答え、ファイルの形も契約が持つ

- Status: Active
- Date: 2026-09-14

## Context

dump は「どの item を選ぶか」と「それをどう書くか」の 2 つを持つ。返答に item を載せず path を返すなら、そのファイルを読むのは後続のセッションや別の client で、要求を知らない相手になる。また選択の語彙をどこまで契約が固定するかも決める必要がある。

## Decision

- `types` の要素は型名、prefix、それらの `-` 否定、または `@<preset>` で、左から右へ適用する。**preset は契約が固定しない** — instance の config が持ち、`dump.presets.read` が読む。preset が名指すのは **関心** (どう働いたか、何を渡すか) であって、線上の性質ではない。参照の展開と、循環や未設定の名前の拒否は config を検証する場所の仕事
- `session.dump.write` は `entries` を **型ごとの数**として答え、隣に `ids` の台帳を返す。合計 1 つでは、望んだ物が入った dump と、選択がほとんど空振りした dump を見分けられない。台帳は item が持っていた id を集めた物で、そこから agent を名指して次の dump の subject にするのにファイルを読まなくてよい。id は「何を指すか」であって「その行が何か」ではないので、型の 1 つにはしない
- 返るのは path で item は載らない。**item が実際に旅をするのはファイル**なので、その形も契約が持つ (`SessionDumpFile`: `sid`、`agent_id?`、`written_at`、適用された選択、`items`、`ids` の JSON)。ファイルは要求より長生きするので、何の dump で何が落とされたかを自分だけで述べる必要がある
- `format` が決めるのは **ファイルが item について何を書くか**だけで、どの item かには効かない。`items` は上の形 (省略時の既定)、`records` は選ばれた item の元になった transcript の record をそのまま 1 行 1 JSON で書く (harness のファイルを既に読む道具が、この契約の分類だけを欲しい場合。1 record から出た複数の item はそこでは 1 行なので、行数は item 数ではない)、`text` は人向けの描画。応答の `entries` と `ids` はどの場合も選択を述べる — 呼び手が依頼し、結果を突き合わせる対象なので、描き方で数が動けば毎回違う問いに答えることになる

## Alternatives Considered

- 案 A: preset を契約が固定する
  - 不採用理由: preset が名指すのは関心で、線上の性質ではない。型名は record と 1 対 1 のまま保ち、人がまとめ方を名付けるのは config の側
- 案 B: `entries` を合計 1 つで返す
  - 不採用理由: 選択がほぼ空振りした dump を見分けられない
- 案 C: ファイルの形を契約が持たない (書き手の自由にする)
  - 不採用理由: path を渡された後続のセッションや client が、何も述べられていない形式を読むことになる
- 案 D: `format` が選択にも効く (例: `text` では一部の型を落とす)
  - 不採用理由: 何を選んだかと、どう書いたかが混ざる。呼び手は `entries` を自分の選択と突き合わせられなくなる

## Consequences

- dump を受け取る側はファイルだけで自足でき、要求を再現する必要が無い
- preset の妥当性 (循環、未設定) は契約ではなく config 検証の失敗として現れる

## 関連

- [DR-0014](DR-0014-call-and-result-are-two-items.md) — item の id と `source`
- ccmsg (daemon) `docs/decisions/DR-0006-dump-writes-typed-items.md`
- `docs/DESIGN.md` §Transcript item types
