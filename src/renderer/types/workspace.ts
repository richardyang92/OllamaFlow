export interface WorkspaceConfig {
  name: string
  description?: string
  // AI 配置已移至全局配置，不再在工作区级别存储
  created: string
  lastOpened: string
}

export interface RecentWorkspace {
  path: string
  name: string
  description?: string
  lastOpened: string
}
