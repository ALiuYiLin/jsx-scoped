# Changesets

本仓库使用 [changesets](https://github.com/changesets/changesets) 管理三个可发布包的版本与发布。

## 流程

```bash
pnpm changeset            # 1. 选择受影响的包并描述变更（生成 .changeset/*.md）
pnpm version:packages     # 2. 消费变更集：自动升版本 + 生成各包 CHANGELOG.md
git commit                # 3. 提交版本变更
pnpm release              # 4. 预构建（pnpm build）后由 changesets 发布 + 打 git tag
```

说明：

- `.changeset/config.json`：`access: public`（@10coding scope 公开发布）、
  `baseBranch: master`；私有示例包（`@10coding/example-react`）通过
  `privatePackages.version/tag: false` 不参与版本号变更与 tag。
- 三个包在发布前都会执行各自的 `prepublishOnly: pnpm build`（预构建），
  直接 `pnpm -r publish` 亦会先构建再发布。
- 发布需要 npm 仓库凭据（如环境变量 `NPM_TOKEN`），scope 为 `@10coding`，记得加
  `publishConfig.access = public`（已配置）。
