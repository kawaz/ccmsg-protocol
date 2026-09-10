---
title: TokenFamily を mint 時の endpoint に束縛する
status: open
category: bug
created: 2026-09-10T10:43:18+09:00
last_read:
open_entered: 2026-09-10T10:43:18+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: fable5-high 再検査 (2026-09-10)
---

# TokenFamily を mint 時の endpoint に束縛する

## 概要

認証の単位は登録時の endpoint URL (DR-0001 §2.3、`CredentialRecord.endpoint` で
assertion を束縛) だが、`TokenFamily` は endpoint を持たず、WS の access token
検査も endpoint を見ていない。

同一ホストの `https://h/` と `https://h/personal/` は別登録 (passkey) なのに、
`/personal/` で mint した access token を `/ws` に出せば通ってしまう (cookie は
Path で分離されるが、access token はメモリ上の bearer なのでその分離が効かない)。

## 背景

fable5-high 再検査 (2026-09-10) で指摘。DR-0001 §2.3 が定義する「endpoint 単位の
認証境界」が `TokenFamily` / WS access token 検査には反映されておらず、passkey
登録単位の境界を access token レイヤで飛び越えられる。

論点: `TokenFamily.endpoint: Endpoint` (mint 時の assertion の endpoint) を足し、
daemon は WS upgrade / `auth_refresh` / `/auth/refresh` で request のパス prefix
と origin (WS は Origin が無いため request パスのみ) を `family.endpoint` と照合
する。契約は minor 変更。daemon 側は `admits` に endpoint を渡す変更が必要。

## 受け入れ条件

- [ ] `TokenFamily` に endpoint (mint 時の assertion の endpoint) を持たせる契約変更が入る
- [ ] WS upgrade / `auth_refresh` / `/auth/refresh` で request パス prefix (および Origin がある経路では Origin) を `family.endpoint` と照合する
- [ ] 同一ホスト配下の異なる endpoint (`/` と `/personal/` 等) 間で access token が流用できないことを確認する

## TODO

<!-- wip 時のみ -->
