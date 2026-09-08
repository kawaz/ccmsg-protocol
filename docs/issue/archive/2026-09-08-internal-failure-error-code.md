---
title: internal-failure-error-code
status: resolved
category: design
created: 2026-09-08T12:49:15+09:00
last_read:
open_entered: 2026-09-08T12:49:15+09:00
wip_entered:
blocked_entered:
pending_entered:
discarded_entered:
resolved_entered: 2026-09-08T22:55:21+09:00
discard_reason:
pending_reason:
close_reason: ["done:v0.4.0 で `internal_error` を ERROR_CODES に追加 (commit 83afe875)"]
blocked_by:
origin: ccmsg
---

# internal-failure-error-code

## 概要

ErrorCode に「op の実装が例外で失敗した (呼び出し側の責任ではない)」を表す code が無い。daemon v2 の transport は handler の reject を `bad_request` に寄せている (kawaz/ccmsg `src/transport/driver.ts`) が、これは呼び出し側の誤りに見えるので不適切。`internal_error` 相当を契約に足すか、契約として「実装失敗は接続を切る」等の別ルールにするかを決める。

## 背景

kawaz/ccmsg の daemon v2 transport 実装 (`src/transport/driver.ts`) を見ると、handler が例外で reject した場合も呼び出し側の入力誤りを示す `bad_request` にまとめられている。実際には呼び出し側の責任ではなく実装側 (op ハンドラ) の内部失敗であり、区別できないと呼び出し側が誤ってリトライやパラメータ修正を試みる可能性がある。

## 受け入れ条件

- [ ] ErrorCode に `internal_error` 相当の code を追加するか、契約として「実装失敗時は接続を切る」等の代替ルールを定めるかを決定する
- [ ] 決定を protocol 仕様に反映する
- [ ] kawaz/ccmsg 側の `src/transport/driver.ts` の reject 分類を決定内容に追従させる (protocol 側の変更が確定した後)
