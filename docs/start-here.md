# TimCSS 中文文档入口

这份文档用于快速明确三件事：产品定位、接入路径、真实支持边界。

## 先确认定位

- TimCSS 当前优先服务：移动端 H5 与原生微信小程序。
- TimCSS 当前官方示例：`examples/react-mobile`、`examples/wechat-miniapp`。
- Taro / uni-app 当前归类为“可接入但需项目验证”的路径，不应在对外文案中描述为“官方端到端已验证”。

## 推荐阅读顺序

1. `../README.md`：仓库入口与常用命令
2. `integration-h5.md`：H5 接入
3. `integration-wechat-miniapp.md`：原生微信小程序接入
4. `integration-taro-uniapp.md`：Taro/uni-app 边界与接入建议
5. `search-cheatsheet.md`：按场景词找原子类
6. `faq.md`：常见问题与接入边界
7. `examples-guide.md`：示例验证与排错

## 10 分钟接入闭环

```bash
pnpm install
pnpm run timcss:prepare
pnpm run timcss:release:validate
pnpm run timcss:example:wechat:inspect
pnpm run timcss:example:react:inspect
```

预期结果：

- 发布校验通过
- 微信示例 inspect 通过
- React 示例 inspect 通过

## 对外表述建议（避免夸大）

推荐表述：

- 已支持并验证：移动端 H5、原生微信小程序
- 提供接入建议，持续补齐官方验收：Taro、uni-app

不推荐表述：

- “Taro / uni-app 官方已完整支持并发布级验证”
- “所有微信小程序框架已丝滑开箱即用”
