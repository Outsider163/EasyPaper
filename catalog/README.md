# EasyPaper 在线服务器目录

该目录通过 GitHub Raw 与 jsDelivr 提供给 EasyPaper 浏览器扩展。浏览器读取版本清单、下载 CSV、完成安全校验后才替换本地缓存。

- `manifest.json`：目录版本、生成时间、下载地址、记录数、字节数和 SHA256；
- `public-catalog.csv`：当前服务器目录数据；
- 插件下载后会校验文件大小、记录数和 SHA256，校验失败时保留浏览器中的已有目录；
- 核心目录生成命令：`npm run catalog:build`；
- 全量目录发布命令：
  `npm run catalog:publish -- <全标签.csv|tsv|json> <版本> [目录名称]`；
- 发布前校验命令：`npm run catalog:verify`。

当前服务器目录版本为 `2025-2026-full.6`，共 8,184 条合并记录。除国际 CCF A/B/C 和云南财经大学目录外，已加入 CCF 2025 国内期刊 T1/T2/T3（68 本）、北大核心、CSSCI 来源/扩展版、中国科技核心、CSCD 核心/扩展库，以及 42 个通过数量核验的中国科协高质量期刊学科。

可发布字段包括 `CCF中文期刊标签`、`CCF中文期刊版本`、`北大中文核心标签`、`南大中文核心标签`、`CSSCI扩展版标签`、`中国科技核心标签`、`CSCD核心库标签`、`CSCD扩展库标签` 和 `中国科协高质量期刊标签`。派生数据、来源指纹和核验结果见 [`sources/README.md`](sources/README.md)。

请只发布已经确认拥有公开再分发权限的数据。
