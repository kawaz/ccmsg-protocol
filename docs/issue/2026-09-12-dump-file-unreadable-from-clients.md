---
title: dump-file-unreadable-from-clients
status: open
category: design
created: 2026-09-12T20:22:49+09:00
last_read:
open_entered: 2026-09-12T20:22:49+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: 自リポ TODO
---

# dump-file-unreadable-from-clients

## 概要

`session.dump.write` は instance の state dir (`<state>/dumps/<sid>-<ms>.dump.json`) に書いて path を返すが、file を読む op (`file.read`) が受け付ける面は contained (session root) / workspace / external (transcript が名指した file) の 3 つだけで、書き出した直後の dump はどれにも入らず `path_forbidden` になる。client が中身を見るには契約側の足しが要る。

## 背景

webui の dump ボタン試作で判明 (2026-09-12)。dump は「後で渡せる file」として残す設計だが、読む経路が file 単位で用意されていないため、書いた本人 (呼び出した client) すら中身を確認できない。

候補:

- (a) `session.dump.read` を足す (dump の path を引数に、書いた instance が答える)
- (b) `session.dump.write` の結果に本文 (または本文の取り寄せ token) を含める
- (c) dump の path を external の allowlist に載せる (transcript が名指したのと同じ扱い)

推し: (a)。dump は「後で渡せる file」として残す設計なので、読む経路も file 単位で、書いた instance に閉じるのが自然。

関連: daemon issue `dump-raw-jsonl-format` (dump の 3 形式) と合わせて 1 回の minor で。

## 受け入れ条件

- [ ] dump を書いた client が、その dump の中身を契約上の op で読めるようになっている

## TODO

<!-- wip 時のみ -->
