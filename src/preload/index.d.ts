import { ElectronAPI } from '@electron-toolkit/preload'

export interface ToolsApi {
  writeClipboard: (text: string) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ToolsApi
  }
}
