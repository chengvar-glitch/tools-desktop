export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  // 结尾换行只是行终止符，不算多出一行空行
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

// 中文输入法/表格复制常带全角数字，统一转成半角再提取。
export function normalizeDigits(text: string): string {
  return text.replace(/[\uff10-\uff19]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  )
}
