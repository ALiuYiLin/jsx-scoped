# Changesets

本仓库使用 [changesets](https://github.com/changesets/changesets) 管理三个可发布包的版本与发布。

## 流程

```bash
pnpm changeset   # 1. 选择受影响的包并描述变更（生成 .changeset/*.md）
pnpm release     # 2. 一条命令：预构建 → changeset version（消费 md、升版本、
                 #    生成 CHANGELOG、自动 git commit）→ changeset publish（发 npm + 打 tag）
```

`.changeset/*.md` 只是“待发布清单”，`changeset publish` 不会消费它；`pnpm release`
内置了 `changeset version`，所以只要写了 md 即可直接发布。手动分步（先审版本再发）：

```bash
pnpm version:packages    # 消费变更集：升版本 + 生成各包 CHANGELOG.md（commit:true 自动提交）
pnpm build && changeset publish   # 预构建后发布
```

说明：

- `.changeset/config.json`：`access: public`（@10coding scope 公开发布）、
  `commit: true`（version 自动提交，发布前请保持工作区干净）、`baseBranch: master`；
  私有示例包（`@10coding/example-react` 等）通过 `privatePackages.version/tag: false`
  不参与版本号变更与 tag。
- 三个包在发布前都会执行各自的 `prepublishOnly: pnpm build`（预构建），
  直接 `pnpm -r publish` 亦会先构建再发布。
- 发布需要 npm 仓库凭据（如环境变量 `NPM_TOKEN`），scope 为 `@10coding`，记得加
  `publishConfig.access = public`（已配置）。
