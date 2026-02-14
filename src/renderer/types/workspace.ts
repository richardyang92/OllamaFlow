export interface WorkspaceConfig {
  name: string
  description?: string
  ollamaHost: string
  defaultModel: string
  created: string
  lastOpened: string
}

export interface RecentWorkspace {
  path: string
  name: string
  lastOpened: string
}
