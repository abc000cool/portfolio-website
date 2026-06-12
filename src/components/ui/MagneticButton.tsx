import { useRef, type ReactNode, type MouseEvent } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface MagneticButtonProps {
  children: ReactNode
  onClick?: () => void
  href?: string
  className?: string
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost'
}

export function MagneticButton({
  children,
  onClick,
  href,
  className = '',
  type = 'button',
  variant = 'primary',
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement & HTMLAnchorElement>(null)
  const reduced = useReducedMotion()

  const handleMove = (e: MouseEvent) => {
    if (reduced || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    ref.current.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`
  }

  const handleLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  const base =
    'inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-medium transition-all duration-300'
  const variants = {
    primary:
      'bg-white text-slate-900 hover:bg-indigo-50 shadow-[0_0_24px_rgba(129,140,248,0.25)] hover:shadow-[0_0_32px_rgba(129,140,248,0.35)]',
    ghost:
      'bg-transparent text-slate-300 border border-white/15 hover:border-white/30 hover:text-white',
  }

  const classes = `${base} ${variants[variant]} ${className}`

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={classes}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type}
      className={classes}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  )
}
