/**
 * 文件快照工具
 * 用于 SubAgent 执行期间的文件变更检测
 */

/**
 * 文件快照条目
 */
export interface FileSnapshotEntry {
  path: string           // 相对路径
  mtime: number          // 修改时间戳（毫秒）
  size: number           // 文件大小（字节）
  isDirectory: boolean
}

/**
 * 文件快照
 */
export interface FileSnapshot {
  workspacePath: string
  timestamp: number
  files: Map<string, FileSnapshotEntry>  // key: 相对路径
}

/**
 * 文件变更结果
 */
export interface FileChanges {
  created: FileSnapshotEntry[]
  modified: FileSnapshotEntry[]
  deleted: FileSnapshotEntry[]
}

const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[FileSnapshot]', ...args)

/**
 * 检查路径是否应该被排除
 * 排除规则：
 * - 以 . 开头的隐藏文件/目录
 * - .ollamaflow 目录
 */
function shouldExclude(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules'
}

/**
 * 递归获取目录下的所有文件
 */
async function listFilesRecursive(
  workspacePath: string,
  relativePath: string = ''
): Promise<FileSnapshotEntry[]> {
  const entries: FileSnapshotEntry[] = []

  try {
    const result = await window.electronAPI.file.list(workspacePath, relativePath)

    if (!result.success || !result.files) {
      return entries
    }

    for (const file of result.files) {
      // 跳过排除的文件/目录
      if (shouldExclude(file.name)) {
        continue
      }

      const entryPath = file.path

      if (file.isDirectory) {
        // 递归处理子目录
        const subEntries = await listFilesRecursive(workspacePath, entryPath)
        entries.push(...subEntries)
      } else {
        // 添加文件条目
        entries.push({
          path: entryPath,
          mtime: file.mtime || 0,
          size: file.size || 0,
          isDirectory: false,
        })
      }
    }
  } catch (error) {
    log('递归列出文件时出错:', relativePath, error)
  }

  return entries
}

/**
 * 获取工作区的文件快照
 * @param workspacePath 工作区路径
 * @returns 文件快照
 */
export async function takeFileSnapshot(workspacePath: string): Promise<FileSnapshot> {
  const timestamp = Date.now()
  const files = new Map<string, FileSnapshotEntry>()

  try {
    log('开始获取文件快照:', workspacePath)
    const entries = await listFilesRecursive(workspacePath)

    for (const entry of entries) {
      files.set(entry.path, entry)
    }

    log('快照获取完成，文件数量:', files.size)
  } catch (error) {
    console.error('[FileSnapshot] 获取快照失败:', error)
  }

  return {
    workspacePath,
    timestamp,
    files,
  }
}

/**
 * 比较两个快照，返回文件变更
 * @param before 执行前的快照
 * @param after 执行后的快照
 * @returns 文件变更（新增、修改、删除）
 */
export function compareSnapshots(
  before: FileSnapshot,
  after: FileSnapshot
): FileChanges {
  const created: FileSnapshotEntry[] = []
  const modified: FileSnapshotEntry[] = []
  const deleted: FileSnapshotEntry[] = []

  // 检查新增和修改的文件
  for (const [path, afterEntry] of after.files) {
    const beforeEntry = before.files.get(path)

    if (!beforeEntry) {
      // 文件不存在于 before 快照中，是新增的
      created.push(afterEntry)
    } else if (
      afterEntry.mtime !== beforeEntry.mtime ||
      afterEntry.size !== beforeEntry.size
    ) {
      // 文件存在但 mtime 或 size 不同，是修改的
      modified.push(afterEntry)
    }
  }

  // 检查删除的文件
  for (const [path, beforeEntry] of before.files) {
    if (!after.files.has(path)) {
      // 文件不存在于 after 快照中，是删除的
      deleted.push(beforeEntry)
    }
  }

  log('快照比较结果:', {
    created: created.length,
    modified: modified.length,
    deleted: deleted.length,
  })

  return {
    created,
    modified,
    deleted,
  }
}
