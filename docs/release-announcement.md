# TimCSS 发布说明模板

对外发布时，建议只复用这一页，不要在公告里重复整份产品文档。

## 推荐标题

- `TimCSS v0.0.1 发布：面向移动端 H5 与原生微信小程序的原子样式引擎`

## 推荐摘要

- TimCSS 当前正式发布范围：移动端 H5、原生微信小程序。
- 当前仓库已纳入官方示例与发布校验链路：`examples/react-mobile`、`examples/wechat-miniapp`。
- Taro / uni-app 当前提供接入建议，但仍建议按项目内验证使用，不宣称“官方端到端已验证”。

## 推荐正文结构

1. 这版解决什么问题
2. 当前正式支持范围
3. 当前官方示例与验证链路
4. 安装与最短跑通命令
5. 文档入口与反馈方式

## 推荐命令

```bash
pnpm install
pnpm run timcss:prepare
pnpm run timcss:release:validate
```

## 发布时附带链接

- `README.md`
- `docs/start-here.md`
- `docs/integration-h5.md`
- `docs/integration-wechat-miniapp.md`
- `docs/integration-taro-uniapp.md`
