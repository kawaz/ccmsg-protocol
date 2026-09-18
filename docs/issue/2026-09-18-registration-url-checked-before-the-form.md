---
title: 登録 URL はフォームを出す前に生死を確かめる
status: open
category: design
created: 2026-09-18T10:40:07+09:00
last_read:
open_entered: 2026-09-18T10:40:07+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: kawaz
---

# 登録 URL はフォームを出す前に生死を確かめる

## 概要

使用済みの登録 URL を開くと、登録画面でフォームを埋めて送信した後に「期限切れ」と出る。
期限切れはページが claims の `expires_at` で判定できるが、使用済み (jti 消費) は発行
instance しか知らないので、フォームを出す前に endpoint に聞く必要がある。

直すこと: `auth.challenge` に登録 URL の token を添えられるようにし、受けた instance が
発行者に中継して token の生死 (未使用 / 期限内 / 発行元が既知) を先に確かめ、駄目なら
理由を返す (error 語彙: 使用済み / 期限切れ / 発行元不明を区別)。webui は URL を開いた時に
これを呼び、駄目ならフォームを出さず理由を言う。文言も「期限切れ」と「使用済み」を区別する。

契約 minor。DR-0030 の webui 反映と一緒に。

## 背景

登録 URL を開いてからフォーム送信までの間に token が失効/消費されていても、現状はその
事実をフォーム送信後まで検知できない。ユーザ体験として「入力させてから弾く」形になって
おり、失敗理由も「期限切れ」に一括りにされ「使用済み」と区別されない。

## 受け入れ条件

- [ ] `auth.challenge` が登録 URL の token を受け取れる
- [ ] 受けた instance が発行者に中継し、token の生死 (未使用 / 期限内 / 発行元が既知) を
      フォーム表示前に確認できる
- [ ] 駄目な場合の error 語彙が「使用済み」「期限切れ」「発行元不明」を区別する
- [ ] webui が URL を開いた時点でこれを呼び、駄目ならフォームを出さず理由を表示する
- [ ] 契約バージョンを minor bump し、DR-0030 の webui 反映と合わせて反映する
