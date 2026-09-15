import { ElectronAPI } from '@electron-toolkit/preload'

export interface ToolsApi {
  writeClipboard: (text: string) => Promise<boolean>
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  closeWindow: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ToolsApi
  }
}
