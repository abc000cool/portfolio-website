import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface OdometerProps {
  value: number
  suffix?: string
  delay?: number
  active?: boolean
  static?: boolean
}

function Digit({
  target,
  active,
  delay,
  static: staticValue,
}: {
  target: number
  active: boolean
  delay: number
  static?: boolean
}) {
  const [current, setCurrent] = useState(staticValue ? target : 0)
  const reduced = useReducedMotion()
  const started = useRef(false)

  useEffect(() => {
    if (staticValue) {
      setCurrent(target)
      return
    }
    if (!active || started.current) return
    if (reduced) {
      setCurrent(target)
      return
    }

    started.current = true
    const timeout = setTimeout(() => {
      let frame = 0
      const totalFrames = 30
      const interval = setInterval(() => {
        frame++
        const progress = frame / totalFrames
        const eased = 1 - Math.pow(1 - progress, 3)
        setCurrent(Math.round(eased * target))
        if (frame >= totalFrames) {
          setCurrent(target)
          clearInterval(interval)
        }
      }, 30)
    }, delay)

    return () => clearTimeout(timeout)
  }, [active, target, delay, reduced, staticValue])

  const digits = String(current).padStart(String(target).length, '0')

  return (
    <span className="inline-flex overflow-hidden h-[1.2em] font-display text-4xl md:text-5xl font-semibold text-white tracking-tight">
      {digits.split('').map((d, i) => (
        <span
          key={i}
          className="inline-block transition-transform duration-100"
          style={{ transform: `translateY(${reduced ? 0 : 0}px)` }}
        >
          {d}
        </span>
      ))}
    </span>
  )
}

export function Odometer({
  value,
  suffix = '',
  delay = 0,
  active = false,
  static: staticValue = false,
}: OdometerProps) {
  return (
    <div className="flex items-baseline gap-1">
      <Digit target={value} active={active} delay={delay} static={staticValue} />
      {suffix && (
      <span className="font-body text-sm text-slate-500">{suffix}</span>
      )}
    </div>
  )
}
