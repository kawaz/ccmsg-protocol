# Archived Decision Records

置き換えられた DR の索引。現役の判断は [../INDEX.md](../INDEX.md) にあり、ここにあるのは **もう立っていない** 物だけ。番号とファイル名は退避しても変えない。

各 DR の `Status:` 行は **直近の置き換え**を言う (それがその DR に起きた事実だから)。この索引が名指すのは **今立っている DR** で、間に archive 済みの DR を挟むなら矢印で辿れるように書く。同じ物を 2 通りに言わないための分担で、どちらかが古くなることはない。

| DR | 要旨 | 置き換えた判断 (→ 今立っている物) |
|---|---|---|
| [DR-0011](DR-0011-instance-derives-the-classification.md) | セッションの分類は instance が導出し、`state` として行に載せる | [DR-0001](../DR-0001-session-and-run.md) |
| [DR-0022](DR-0022-credential-bound-to-an-endpoint.md) | credential は endpoint に束縛し、認証しない手掛かりを併せて持つ | [DR-0029](DR-0029-what-a-credential-is-bound-to.md) → [DR-0030](../DR-0030-identity-is-a-user-who-owns-instances.md) |
| [DR-0027](DR-0027-webui-apart-from-endpoint.md) | webui の URL は instance の endpoint と別物で、credential は作られた 1 つの webui を持つ | [DR-0029](DR-0029-what-a-credential-is-bound-to.md) → [DR-0030](../DR-0030-identity-is-a-user-who-owns-instances.md) |
| [DR-0029](DR-0029-what-a-credential-is-bound-to.md) | credential は endpoint と webui の 2 つに縛られ、比べる値はどちらも URL から導く | [DR-0030](../DR-0030-identity-is-a-user-who-owns-instances.md) |
