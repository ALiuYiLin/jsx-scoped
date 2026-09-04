import { createHash } from 'node:crypto'

/** 属性前缀，与 Vue SFC scoped 的 data-v- 保持一致 */
export const SCOPE_ATTR_PREFIX = 'data-v-'

/** 默认 hash 长度（字符数），对路径做 md5 后截取前 8 位 */
export const DEFAULT_HASH_LENGTH = 8

/**
 * 归一化组件文件路径，统一为正斜杠，保证跨平台 hash 结果一致。
 * 例如 Windows 的 `E:\a\b.tsx` 会归一化为 `E:/a/b.tsx`。
 */
export function normalizeComponentPath(componentFilePath: string): string {
  return componentFilePath.replace(/\\/g, '/')
}

/**
 * 根据组件文件绝对路径生成 scope hash：
 * md5(绝对路径) 的十六进制串，截取前 hashLength 位。
 */
export function generateScopeHash(
  componentFilePath: string,
  hashLength: number = DEFAULT_HASH_LENGTH,
): string {
  const normalized = normalizeComponentPath(componentFilePath)
  return createHash('md5').update(normalized, 'utf8').digest('hex').slice(0, hashLength)
}

/** 由 hash 拼出完整属性名，如 data-v-3f2a9c1d */
export function createScopeAttr(scopeHash: string): string {
  return `${SCOPE_ATTR_PREFIX}${scopeHash}`
}

/**
 * 一步到位：给定组件文件绝对路径，直接得到完整 scope 属性名
 * 例：computeScopeAttr('E:/proj/src/demo.tsx') === 'data-v-3f2a9c1d'
 */
export function computeScopeAttr(
  componentFilePath: string,
  hashLength: number = DEFAULT_HASH_LENGTH,
): string {
  return createScopeAttr(generateScopeHash(componentFilePath, hashLength))
}
