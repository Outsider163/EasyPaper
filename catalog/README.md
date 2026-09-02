# EasyPaper 在线服务器目录

该目录通过 GitHub Raw 与 jsDelivr 提供给 EasyPaper 浏览器扩展。浏览器读取版本清单、下载 CSV、完成安全校验后才替换本地缓存。

- `manifest.json`：目录版本、生成时间、下载地址、记录数、字节数和 SHA256；
- `public-catalog.csv`：当前服务器目录数据；
- 插件下载后会校验文件大小、记录数和 SHA256，校验失败时保留浏览器中的已有目录；
- 核心目录生成命令：`npm run catalog:build`；
- 全量目录发布命令：
  `npm run catalog:publish -- <全标签.csv|tsv|json> <版本> [目录名称]`；
- 发布前校验命令：`npm run catalog:verify`。

当前版本仍是由 CCF 第七版与《云南财经大学学术期刊分级标准与目录（2026）》生成的 1,563 条核心目录。维护者上传并发布全标签文件后，浏览器会按新清单自动更新。

请只发布已经确认拥有公开再分发权限的数据。
