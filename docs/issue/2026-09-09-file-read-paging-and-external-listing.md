---
title: webui Files タブが file_read paging と外部ファイル列挙を契約で表現できない
status: open
category: design
created: 2026-09-09T18:33:36+09:00
last_read:
open_entered: 2026-09-09T18:33:36+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered:
discard_reason:
pending_reason:
close_reason:
blocked_by:
origin: ccmsg (webui スライス 5)
---

# webui Files タブが file_read paging と外部ファイル列挙を契約で表現できない

## 概要

webui (ccmsg-webui スライス 5、Files タブ) が契約で表現できなかった 2 点。

(1) `file_read` に offset / limit の引数が無く、`FileReadResult` は `size` と `truncated` だけ。daemon の narrowing (512 KiB) を超えるファイルは先頭だけ出してバナーで告げるしかなく、続きを読む経路が無い。`transcript_read` は byte offset の paging (`before` / `max_bytes` / `start` / `end` / `size`) を持つので、同じ形を `file_read` に足すのが自然 (同一世代内の任意引数追加 = minor)。

(2) セッションの transcript が名指した外部ファイル (daemon の `external_files`、`containment.ts`) を列挙する op が無く、`file_stat_batch` は手元のパスの admit 可否を答えるだけ。webui の「プロジェクト外」節は「このブラウザが実際に開いた絶対パスの履歴」で代用しており、旧 webui の「Read/Edit/Write 由来 / 添付由来」の区別は再現できない。

## 背景

論点: 列挙 op (or `session_status` 系 topic への同乗) を置くか、webui の履歴代用で足りるとするか。

## 受け入れ条件

- [ ] `file_read` の paging 拡張 (offset/limit or transcript_read 相当) を入れるか見送るか判断する
- [ ] 外部ファイル列挙 op (独立 op / session_status 同乗 / webui 履歴代用のいずれか) を判断する
