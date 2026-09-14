import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import {
  HASH_ALGORITHMS,
  base64Decode,
  base64Encode,
  hashText,
  type HashAlgorithm
} from '@/lib/secrets'

type EncodeMode = 'encode' | 'decode'

interface HashResult {
  algorithm: HashAlgorithm
  value: string
}

const useStyles = makeStyles({
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  optionLabel: {
    color: tokens.colorNeutralForeground3,
    minWidth: '56px'
  },
  hashGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  hashRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1
  },
  hashLabel: {
    width: '84px',
    flexShrink: 0,
    color: tokens.colorNeutralForeground3
  },
  hashValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    userSelect: 'text',
    overflowWrap: 'anywhere'
  }
})

function HashTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [hashInput, setHashInput] = useState('')
  const [hashState, setHashState] = useState<{ input: string; results: HashResult[] }>({
    input: '',
    results: []
  })
  const [encoding, setEncoding] = useState('')
  const [mode, setMode] = useState<EncodeMode>('encode')
  const [urlSafe, setUrlSafe] = useState(false)

  // 输入变化后稍等一下再算，避免大段文本每次按键都跑一遍哈希
  useEffect(() => {
    if (hashInput === '') return
    let active = true
    const timer = window.setTimeout(() => {
      void Promise.all(
        HASH_ALGORITHMS.map(async (algorithm) => ({
          algorithm,
          value: await hashText(algorithm, hashInput)
        }))
      ).then((results) => {
        if (active) setHashState({ input: hashInput, results })
      })
    }, 120)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [hashInput])

  // 只展示与当前输入对应的结果，避免清空输入后还留着上一次的哈希
  const hashes = hashState.input === hashInput ? hashState.results : []

  const encoded = useMemo(() => base64Encode(encoding, urlSafe), [encoding, urlSafe])
  const decoded = useMemo(() => base64Decode(encoding), [encoding])
  const output = mode === 'encode' ? encoded : decoded.ok ? decoded.value : ''
  const error = mode === 'decode' && !decoded.ok ? decoded.error : null
  const inputBytes = useMemo(() => new TextEncoder().encode(encoding).length, [encoding])

  return (
    <div className={shared.root}>
      <div className={styles.section}>
        <Text size={300} weight="semibold">
          哈希计算
        </Text>
        <Text size={200} className={shared.stats}>
          输入即算，MD5 由 spark-md5 提供（WebCrypto 没有 MD5），SHA 系列走原生 crypto.subtle。
        </Text>
        <Textarea
          className={styles.hashValue}
          style={{ minHeight: '96px' }}
          textarea={{ className: shared.monoFill }}
          resize="vertical"
          placeholder="粘贴要计算哈希的文本（图片/文件请用命令行工具的 -file 参数）"
          value={hashInput}
          onChange={(_, data) => setHashInput(data.value)}
        />
        <div className={styles.hashGrid}>
          {HASH_ALGORITHMS.map((algorithm) => {
            const found = hashes.find((item) => item.algorithm === algorithm)
            return (
              <div key={algorithm} className={styles.hashRow}>
                <Text size={200} className={styles.hashLabel}>
                  {algorithm}
                </Text>
                <Text size={200} className={styles.hashValue}>
                  {found?.value ?? '—'}
                </Text>
                <CopyButton label="复制" text={found?.value ?? ''} size="small" />
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.optionRow}>
          <Text size={300} weight="semibold">
            Base64
          </Text>
          <RadioGroup
            layout="horizontal"
            value={mode}
            onChange={(_, data) => setMode(data.value as EncodeMode)}
          >
            <Radio value="encode" label="编码" />
            <Radio value="decode" label="解码" />
          </RadioGroup>
          <Switch
            label="URL 安全（-_ 且无填充）"
            checked={urlSafe}
            disabled={mode === 'decode'}
            onChange={(_, data) => setUrlSafe(data.checked)}
          />
          <div className={shared.spacer} />
          <Badge appearance="tint">输入 {inputBytes} 字节</Badge>
          {output !== '' && <Badge appearance="tint">输出 {output.length} 字符</Badge>}
          <CopyButton label="复制结果" text={output} appearance="primary" size="small" />
        </div>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className={shared.panes}>
          <div className={shared.pane}>
            <Text size={200} className={shared.paneTitle}>
              {mode === 'encode' ? '原文（支持中文 / emoji）' : 'Base64 内容'}
            </Text>
            <Textarea
              className={shared.fill}
              textarea={{ className: shared.monoFill }}
              placeholder={mode === 'encode' ? '粘贴要编码的文本' : '粘贴要解码的 Base64'}
              value={encoding}
              onChange={(_, data) => setEncoding(data.value)}
            />
          </div>
          <div className={shared.pane}>
            <Text size={200} className={shared.paneTitle}>
              {mode === 'encode' ? 'Base64 结果' : '解码结果'}
            </Text>
            <Textarea
              className={shared.fill}
              textarea={{ readOnly: true, className: shared.monoFill }}
              value={output}
              placeholder="结果会实时显示在这里"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HashTool
