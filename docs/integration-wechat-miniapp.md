# TimCSS 原生微信小程序接入路径

本页对应当前官方优先路径：原生微信小程序。

## 适用范围

- 原生微信小程序项目
- 需要按页输出 WXSS、并控制共享层体积的项目
- 需要安全区、发丝线、移动端交互变体的业务页面

## 最小配置

```json
{
  "platform": "wechat-miniprogram",
  "prefix": "tm",
  "content": ["src/**/*.wxml"],
  "output": { "dir": "dist" }
}
```

## 默认行为（当前实现）

- 默认不注入 Web preflight
- 默认内联 TimCSS token 到产物
- 写文件构建默认输出压缩 WXSS
- 未显式设置 `output.file` 时，按页输出 `pages/**/*.wxss`
- 存在跨页复用候选时，额外输出 shared 层（默认 `app.wxss`）

## 常用命令

```bash
pnpm run timcss:example:wechat:inspect
pnpm run timcss:example:wechat:build
pnpm run timcss:example:wechat:dev
pnpm run timcss:example:wechat:doctor
```

## 发布前建议

- 至少执行一次 `pnpm run timcss:release:smoke`
- 至少执行一次 `pnpm run timcss:release:validate`
- 修改版本号或包元数据后，重跑 docs 索引和 benchmark 产物
