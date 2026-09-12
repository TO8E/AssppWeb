# 空历史版本列表的兼容处理

## 依据

- [ipatool #538](https://github.com/majd/ipatool/issues/538)：同账号部分已购应用的 volumeStore 返回 HTTP 200、空 songList、无 failureType/customerMessage。参与者实测补 Store-Front 和 X-Token 均无效。
- [ipatool #547](https://github.com/majd/ipatool/issues/547#issuecomment-5565552375)：Karing 未指定版本的 redownload 返回空 HTTP 500，指定目录中的当前外部版本 ID 后成功返回历史列表。
- [HaughtyEyes/ipatool 1ecaec4](https://github.com/HaughtyEyes/ipatool/commit/1ecaec4)：未指定版本的 redownload 还可能选到 tvOS，需先确定 iOS 版本。
- [da5ad04](https://github.com/HaughtyEyes/ipatool/commit/da5ad0471ddb36bcb5c94ce56933ec714b470766)：MDM 成功但缺少条目时，从同地区 App Store 网页 API 读取当前 iOS 版本 ID。
- [741049d](https://github.com/HaughtyEyes/ipatool/commit/741049d90d4c5c8b49aa67a6d022cbf7e901272c)：固定版本的 redownload 仍返回空 HTTP 500 时，使用相同版本和会话请求 `/up/updateProduct`；验证返回的应用、bundle 和版本。

本项目以 TypeScript 实现上述兼容策略。Swift ApplePackage 的原有 volumeStore → redownload 流程和两接口的版本字段映射也已对照。上述 Go 补丁是社区 fork 的修复，不是 Apple 官方协议保证。

## 行为

历史列表、版本详情、下载信息共享 `fetchStoreProduct`，避免三套流程出现差异。主接口正常时没有额外查询。主接口需要备用路径时：

1. 保留用户明确指定的外部版本 ID；否则读取账号地区目录的当前 iOS ID。
2. 请求带 `appExtVrsId` 的 redownload。
3. 仅对空 HTTP 500 尝试一次带相同版本 ID 的 updateProduct。
4. 返回条目必须匹配应用 ID、bundle ID 和请求的外部版本 ID。

目录查询没有账号请求头和 Cookie，不会调用购买或认证接口。历史列表仍来自下载元数据的 `softwareVersionExternalIdentifiers`，不以网页的有限 versionHistory 冒充完整列表。目录 HTTP/网络错误直接报错，不跨地区或退回未指定版本请求。

## 验证边界

2026-09-12 实查高德中国区 MDM：应用 `461703208`，bundle `com.autonavi.amap`，当前显示版本 `17.0.0`，外部版本 ID `890933327`。这些值只作当时的查询记录，不写死在程序中。

同次本机网页 API 查询返回 HTTP 429；因此网站备用来源只能说明实现对照了社区代码并有模拟测试，不能声称此次已实测可用。高德当次 MDM 结果完整，不需要网站备用来源。

模拟测试覆盖版本 ID 保持、目录缺失、错误停止、请求数量、响应身份校验和 Cookie/重定向衔接。它们不证明用户账号下高德历史列表已恢复；尚需同账号真实请求验证。
