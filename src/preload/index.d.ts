import { ElectronAPI } from '@electron-toolkit/preload'
import type { PublicIpResult } from '../main/publicIp'

export interface ToolsApi {
  writeClipboard: (text: string) => Promise<boolean>
  getPublicIp: () => Promise<PublicIpResult>
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
