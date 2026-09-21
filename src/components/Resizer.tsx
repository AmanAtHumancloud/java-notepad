import { useCallback, useEffect, useRef } from 'react'

interface Props {
  /** Current output-pane height in pixels. */
  height: number
  onResize: (height: number) => void
  min?: number
  max?: number
}

export function Resizer({ height, onResize, min = 80, max = 600 }: Props) {
  const dragging = useRef(false)

  const onPointerDown = useCallback(() => { dragging.current = true }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      const next = window.innerHeight - e.clientY
      onResize(Math.min(max, Math.max(min, next)))
    }
    const up = () => { dragging.current = false }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onResize, min, max])

  return (
    <div
      role="separator"
      aria-label="Resize output pane"
      aria-orientation="horizontal"
      aria-valuenow={height}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={e => {
        if (e.key === 'ArrowUp') onResize(Math.min(max, height + 16))
        if (e.key === 'ArrowDown') onResize(Math.max(min, height - 16))
      }}
      className="h-1 cursor-row-resize"
      style={{ background: 'var(--border)' }}
    />
  )
}
