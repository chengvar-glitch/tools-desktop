import { useEffect, useRef, useState } from 'react'
import { Button, Tooltip } from '@fluentui/react-components'
import { CheckmarkRegular, CopyRegular, DismissRegular } from '@fluentui/react-icons'
import { copyText } from '@/lib/copy'

type CopyState = 'idle' | 'done' | 'failed'

interface CopyButtonProps {
  text: string
  label: string
  tooltip?: string
  appearance?: 'primary' | 'secondary' | 'subtle' | 'transparent' | 'outline'
  size?: 'small' | 'medium' | 'large'
}

function CopyButton({
  text,
  label,
  tooltip,
  appearance = 'secondary',
  size = 'medium'
}: CopyButtonProps): React.JSX.Element {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => window.clearTimeout(timer.current)
  }, [])

  const handleClick = async (): Promise<void> => {
    const ok = await copyText(text)
    setState(ok ? 'done' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1500)
  }

  const disabled = text === ''
  const icon =
    state === 'done' ? (
      <CheckmarkRegular />
    ) : state === 'failed' ? (
      <DismissRegular />
    ) : (
      <CopyRegular />
    )
  const caption = state === 'done' ? '已复制' : state === 'failed' ? '复制失败' : label

  return (
    <Tooltip content={tooltip ?? caption} relationship="description">
      <Button
        appearance={appearance}
        size={size}
        icon={icon}
        disabled={disabled}
        onClick={handleClick}
        aria-label={caption}
      >
        {caption}
      </Button>
    </Tooltip>
  )
}

export default CopyButton
