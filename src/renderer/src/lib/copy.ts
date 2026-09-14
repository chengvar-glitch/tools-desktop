function fallbackCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (text === '') return false

  try {
    const ok = await window.api?.writeClipboard(text)
    if (ok) return true
  } catch {
    // 落在浏览器环境或 IPC 不可用时继续尝试 Web API
  }

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 窗口失焦时 clipboard API 会拒绝，继续走兜底方案
  }

  return fallbackCopy(text)
}
