---
title: 人 (webui) が自分の passkey 一覧を見て保守する op が契約に無い
status: open
category: design
created: 2026-09-09T21:32:25+09:00
last_read:
open_entered: 2026-09-09T21:32:25+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: kawaz r292m33
---

# 人 (webui) が自分の passkey 一覧を見て保守する op が契約に無い

## 概要

人 (webui) が自分の passkey 一覧を見て保守する op が契約に無い。credential record には `issued_label` / `device_label` / `registered_at` / `registered_ip` / `registered_user_agent` / `last_used_*` が揃っている (1.1.0) が、それを読む経路は daemon の UDS 管理フレーム (`passkey list` / `remove`、CLI 専用) だけ。

## 背景

DR-0001 §2.2 の「利用者が複数端末を持つ場合にどの端末の passkey かを判断する材料 (ログイン後に自分の一覧から保守削除する UI)」を満たすには、user role が自分の sub の credential 一覧を読み、自分の credential を消す op が要る。

## 論点

1. `auth_credentials_read` (user、自分の sub に限定、`scope: role`) と `auth_credential_remove` (user、自分の sub の credential id 1 つ。sub ごと消すのは CLI のみ) の 2 op を足すか
2. 消した後の family / 接続の扱い (その credential で始まった family だけ失効するか、sub の全 family か) を DR §2.5 の `passkey remove` と揃えて決める
3. 位置情報など「記憶の手がかり」の任意フィールドを record に増やす余地

## 追記

kawaz 2026-09-16: list だけでなく、確立済みの認証済みチャンネル経由で passkey の add / remove もできてよい (CLI 以外の経路)。条件: add / remove は直前に既存 credential での assert (user verification) を要求する 2 段にする (登録 ceremony 自体の UV は新しい認証器の持ち主を確かめるだけで既存の持ち主を確かめないため)。token 単体では add / remove できない = 離席中に第三者が add できない。今使っている credential は自分では remove できない。add でできるのは同じ origin での追加だけ (登録 ceremony の rpId はそのページの origin なので、2 つ目の hosting site の bootstrap は CLI か CLI が出す一回限りの登録 URL の責務のまま)。CT-Q11 (DR-0027、現在は DR-0029 に統合) と CT-Q12 の後に DR 1 本で扱う。

訂正 (kawaz 2026-09-16): 「add でできるのは同じ origin での追加だけ」は誤り。add はページ上で登録 ceremony を走らせるのではなく、承認を置く場所を変えるだけ。手順: add のフォームで endpoint と登録先のホスト URL を入力 → 実行時に既存チャンネルの passkey 認証 (assert) を要求 → 通ったらそのホスト URL に endpoint を指定した登録 URL を発行 → その URL から CLI 発行の時と同じ手順で登録する。信頼源がローカルでは CLI、webui では認証済み WS チャンネルになるだけで、追加経路は既存と同じ 1 本。origin の限定は不要 (origin はユーザが信頼するホストを指定するものであり、登録 URL が名指す origin が CORS の許可集合に入る)。

## 受け入れ条件

- [ ] 論点 1-3 について方針を決定し、契約 (op 定義 / DR) に反映する
