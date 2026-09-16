import { useMemo, useState } from 'react'
import {
  Button,
  Field,
  Input,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  makeStyles,
  tokens
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'
import CopyButton from '@/components/CopyButton'
import { useToolStyles } from '@/components/toolStyles'
import type { SortOrder } from '@/lib/lines'
import {
  formatOrderNumbers,
  processOrderInput,
  type OrderExtract,
  type OrderFormat
} from '@/lib/orders'

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
  sqlField: {
    minWidth: '160px'
  },
  preview: {
    flex: 1,
    minHeight: '120px'
  }
})

const FORMAT_OPTIONS: { value: OrderFormat; label: string }[] = [
  { value: 'single', label: "'123','a1b2'" },
  { value: 'double', label: '"123","a1b2"' },
  { value: 'plain', label: '无引号 123,a1b2' },
  { value: 'sql', label: 'SQL IN' }
]

const EXTRACT_OPTIONS: { value: OrderExtract; label: string }[] = [
  { value: 'token', label: '按分隔符取整段（字母数字混合单号）' },
  { value: 'digits', label: '只提取数字' }
]

const ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'none', label: '保持原序' },
  { value: 'asc', label: '升序' },
  { value: 'desc', label: '降序' }
]

function OrderTool(): React.JSX.Element {
  const styles = useStyles()
  const shared = useToolStyles()
  const [input, setInput] = useState('')
  const [format, setFormat] = useState<OrderFormat>('single')
  const [extract, setExtract] = useState<OrderExtract>('token')
  const [dedupe, setDedupe] = useState(true)
  const [order, setOrder] = useState<SortOrder>('none')
  const [sqlColumn, setSqlColumn] = useState('id')
  const [sqlQuoted, setSqlQuoted] = useState(true)

  const base = useMemo(
    () => ({ extract, dedupe, order, sqlColumn, sqlQuoted }),
    [extract, dedupe, order, sqlColumn, sqlQuoted]
  )
  const result = useMemo(() => processOrderInput(input, { ...base, format }), [input, base, format])
  const sizes = useMemo(
    () => ({
      single: formatOrderNumbers(result.numbers, { ...base, format: 'single' }),
      double: formatOrderNumbers(result.numbers, { ...base, format: 'double' }),
      plain: formatOrderNumbers(result.numbers, { ...base, format: 'plain' }),
      sql: formatOrderNumbers(result.numbers, { ...base, format: 'sql' })
    }),
    [result.numbers, base]
  )

  // 预览里按逗号断行方便肉眼核对；复制出去的仍是逗号分隔原样
  const preview = sizes[format].replace(/,/g, ',\n')

  return (
    <div className={shared.root}>
      <div className={styles.options}>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            格式
          </Text>
          <RadioGroup
            layout="horizontal"
            value={format}
            onChange={(_, data) => setFormat(data.value as OrderFormat)}
          >
            {FORMAT_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            提取
          </Text>
          <RadioGroup
            layout="horizontal"
            value={extract}
            onChange={(_, data) => setExtract(data.value as OrderExtract)}
          >
            {EXTRACT_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            处理
          </Text>
          <Switch label="去重" checked={dedupe} onChange={(_, data) => setDedupe(data.checked)} />
          <RadioGroup
            layout="horizontal"
            value={order}
            onChange={(_, data) => setOrder(data.value as SortOrder)}
          >
            {ORDER_OPTIONS.map((item) => (
              <Radio key={item.value} value={item.value} label={item.label} />
            ))}
          </RadioGroup>
        </div>
        <div className={styles.optionRow}>
          <Text size={200} className={styles.optionLabel}>
            SQL
          </Text>
          <Field label="字段名" className={styles.sqlField}>
            <Input
              value={sqlColumn}
              placeholder="如 order_id（留空则只输出 IN (...)）"
              onChange={(_, data) => setSqlColumn(data.value)}
            />
          </Field>
          <Switch
            label="值加单引号"
            checked={sqlQuoted}
            onChange={(_, data) => setSqlQuoted(data.checked)}
          />
          <Text size={200} className={shared.stats}>
            预览：{sizes.sql || '—'}
          </Text>
        </div>
      </div>

      <div className={shared.actions}>
        <CopyButton
          label="复制结果"
          text={sizes[format]}
          appearance="primary"
          tooltip="复制当前所选格式的结果"
        />
        <CopyButton label="复制 'x' 包裹" text={sizes.single} tooltip="复制 '123','a1b2' 形式" />
        <CopyButton label='复制 "x" 包裹' text={sizes.double} tooltip='复制 "123","a1b2" 形式' />
        <CopyButton label="复制无引号" text={sizes.plain} tooltip="复制 123,a1b2 形式" />
        <CopyButton label="复制 SQL IN" text={sizes.sql} tooltip="复制 IN (...) 子句" />
        <div className={shared.spacer} />
        <Text size={200} className={shared.stats}>
          识别 {result.inputCount} 个 · 输出 {result.numbers.length} 个 · 去重{' '}
          {result.duplicateCount} 个
        </Text>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={() => setInput('')}
          disabled={input === ''}
        >
          清空
        </Button>
      </div>

      <div className={shared.panes}>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            单号输入（换行、逗号、空格分隔；字母数字混合单号按整段提取）
          </Text>
          <Textarea
            className={shared.fill}
            textarea={{ className: shared.monoFill }}
            placeholder={'例如：\n20240101, 20240102\n20240102\nXXW3c935e1274d4b8bc1ddd3f6d6257d'}
            value={input}
            onChange={(_, data) => setInput(data.value)}
          />
        </div>
        <div className={shared.pane}>
          <Text size={200} className={shared.paneTitle}>
            结果预览
          </Text>
          <Textarea
            className={styles.preview}
            textarea={{ readOnly: true, className: shared.monoFill }}
            value={preview}
            placeholder="结果会实时显示在这里"
          />
        </div>
      </div>
    </div>
  )
}

export default OrderTool
