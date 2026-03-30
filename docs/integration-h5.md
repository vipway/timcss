# TimCSS H5 接入路径（移动端优先）

本页只描述当前已验证的 H5 路径，不包含桌面 Web 设计系统扩展能力。

## 适用范围

- 移动端 H5 页面
- React/Vue 等前端项目中的移动端页面层
- 需要统一移动端 token 与原子类表达的业务项目

## 最小配置

```json
{
  "platform": "mobile",
  "content": ["src/**/*.{tsx,jsx,vue,html}"],
  "output": { "file": "dist/timcss.css" }
}
```

## 常用命令

```bash
pnpm run timcss:inspect -- --config timcss.config.json
pnpm run timcss:build -- --config timcss.config.json
pnpm run timcss:doctor -- --config timcss.config.json
```

## 验证建议

- 先用 `inspect` 看候选类是否命中
- 再用 `build` 看产物是否落到预期路径
- 最后用 `doctor` 校验 content globs 与配置边界

## 当前不承诺

- 不承诺与桌面 Web 的全部 Tailwind 生态插件 1:1 等价
- 不承诺“只写复杂动态 class 就一定能零漏扫”
