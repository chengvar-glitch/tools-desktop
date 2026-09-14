import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Slider,
  Switch,
  Text,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { ArrowSyncRegular, CopyRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import { copyText } from '@/lib/copy'
import {
  estimateStrength,
  formatDuration,
  generatePasswords,
  randomToken,
  type PasswordOptions,
  type TokenKind
} from '@/lib/secrets'

const useStyles = makeStyles({
  options: {
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
  slider: {
    minWidth: '220px',
    flex: 1
  },
  countField: {
    width: '96px'
  },
  passwordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1
  },
  passwordText: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    userSelect: 'text',
    overflowWrap: 'anywhere'
  },
  meter: {
    width: '160px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  }
})

interface PasswordRowProps {
  value: string
  bits: number
  label: string
  rowClass: string
  textClass: string
}

function PasswordRow({
  value,
  bits,
  label,
  rowClass,
  textClass
}: PasswordRowProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  return (
    <div className={rowClass}>
      <Text className={textClass}>{value}</Text>
      <Badge
        appearance="tint"
        color={bits >= 90 ? 'success' : bits >= 60 ? 'informative' : 'warning'}
      >
        {Math.round(bits)} bit · {label}
      </Badge>
      <Button
        appearance="subtle"
        size="small"
        icon={<CopyRegular />}
        aria-label={`复制第 ${label} 条密码`}
        onClick={async () => {
          const ok = await copyText(value)
          if (!ok) return
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? '已复制' : '复制'}
      </Button>
    </div>
  )
}

const TOKEN_KINDS: { value: TokenKind; label: string }[] = [
  { value: 'uuid4', label: 'UUID v4' },
  { value: 'uuid7', label: 'UUID v7' },
  { value: 'hex32', label: '随机 Hex（16 字节）' },
  { value: 'base64url', label: '随机 Base64URL（24 字节）' }
]

function PasswordTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [length, setLength] = useState(20)
  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(true)
  const [lower, setLower] = useState(true)
  const [digits, setDigits] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true)
  const [seed, setSeed] = useState(0)
  const [checked, setChecked] = useState('')
  const [tokens, setTokens] = useState<{ kind: TokenKind; value: string }[]>([])

  const options: PasswordOptions = useMemo(
    () => ({ length, count, upper, lower, digits, symbols, excludeAmbiguous }),
    [length, count, upper, lower, digits, symbols, excludeAmbiguous]
  )

  const results = useMemo(() => {
    void seed
    return generatePasswords(options)
  }, [options, seed])

  const strength = useMemo(() => estimateStrength(checked), [checked])
  const nothingSelected = !upper && !lower && !digits && !symbols

  return (
    <div className={shared.root}>
      <div className={styles.options}>
        <Text size={300} weight="semibold">
          密码生成器
        </Text>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            长度
          </Text>
          <Slider
            className={styles.slider}
            min={6}
            max={64}
            value={length}
            onChange={(_, data) => setLength(data.value)}
          />
          <Badge appearance="tint">{length} 位</Badge>
          <Field label="条数" className={styles.countField}>
            <Input
              type="number"
              min={1}
              max={50}
              value={String(count)}
              onChange={(_, data) => setCount(Math.max(1, Math.min(50, Number(data.value) || 1)))}
            />
          </Field>
        </div>
        <div className={styles.optionRow}>
          <Switch label="大写 A-Z" checked={upper} onChange={(_, data) => setUpper(data.checked)} />
          <Switch label="小写 a-z" checked={lower} onChange={(_, data) => setLower(data.checked)} />
          <Switch
            label="数字 0-9"
            checked={digits}
            onChange={(_, data) => setDigits(data.checked)}
          />
          <Switch
            label="符号 !@#$"
            checked={symbols}
            onChange={(_, data) => setSymbols(data.checked)}
          />
          <Switch
            label="排除易混淆字符 0O1lI"
            checked={excludeAmbiguous}
            onChange={(_, data) => setExcludeAmbiguous(data.checked)}
          />
          <div className={shared.spacer} />
          <Button
            appearance="primary"
            icon={<ArrowSyncRegular />}
            onClick={() => setSeed((value) => value + 1)}
            disabled={nothingSelected}
          >
            重新生成
          </Button>
        </div>
      </div>

      {nothingSelected ? (
        <MessageBar intent="warning">
          <MessageBarBody>至少选择一种字符类型。</MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.section}>
          {results.map((result, index) => (
            <PasswordRow
              key={`${result.password}-${index}`}
              value={result.password}
              bits={result.bits}
              label={`#${index + 1}`}
              rowClass={styles.passwordRow}
              textClass={styles.passwordText}
            />
          ))}
          <Text size={200} className={shared.stats}>
            字符池 {results[0]?.poolSize ?? 0} 个字符 · 每条 {Math.round(results[0]?.bits ?? 0)} bit
            熵 · 用 crypto.getRandomValues 生成，拒绝采样保证均匀
          </Text>
        </div>
      )}

      <div className={shared.actions}>
        <CopyButton
          label="复制全部"
          text={results.map((result) => result.password).join('\n')}
          appearance="secondary"
          tooltip="每行复制一条"
        />
      </div>

      <div className={styles.options}>
        <Text size={300} weight="semibold">
          强度检测
        </Text>
        <div className={styles.optionRow}>
          <Field label="待检测的密码" style={{ minWidth: '320px', flex: 1 }}>
            <Input
              value={checked}
              placeholder="粘贴一个密码，估算它的强度和离线破解时间"
              onChange={(_, data) => setChecked(data.value)}
            />
          </Field>
          <ProgressBar
            className={styles.meter}
            value={Math.min(strength.bits, 128) / 128}
            max={1}
            thickness="large"
            color={strength.bits >= 90 ? 'success' : strength.bits >= 60 ? 'warning' : 'error'}
          />
          <Badge appearance="tint" size="large">
            {strength.label}
          </Badge>
          <Badge appearance="tint">{Math.round(strength.bits)} bit</Badge>
          <Badge appearance="tint">字符池 {strength.poolSize}</Badge>
          <Badge appearance="tint">字符类别 {strength.classes.length}</Badge>
        </div>
        <Text size={200} className={shared.stats}>
          按每秒 1000 亿次猜测估算，暴力破解大约需要 {formatDuration(strength.crackSeconds)}
          {strength.classes.length > 0 ? ` · 包含${strength.classes.join('、')}` : ''}
        </Text>
      </div>

      <div className={styles.options}>
        <Text size={300} weight="semibold">
          随机标识
        </Text>
        <div className={styles.tokenRow}>
          {TOKEN_KINDS.map((kind) => (
            <Button
              key={kind.value}
              appearance="secondary"
              onClick={() =>
                setTokens((current) => [
                  { kind: kind.value, value: randomToken(kind.value) },
                  ...current.slice(0, 9)
                ])
              }
            >
              生成 {kind.label}
            </Button>
          ))}
        </div>
        {tokens.map((token, index) => (
          <div key={`${token.kind}-${index}`} className={styles.passwordRow}>
            <Badge appearance="tint">{token.kind}</Badge>
            <Text className={styles.passwordText}>{token.value}</Text>
            <CopyButton label="复制" text={token.value} size="small" />
          </div>
        ))}
        {tokens.length === 0 && (
          <Text size={200} className={shared.stats}>
            点上面的按钮生成 UUID v4/v7、随机 Hex 或 Base64URL 串。
          </Text>
        )}
      </div>
    </div>
  )
}

export default PasswordTool
