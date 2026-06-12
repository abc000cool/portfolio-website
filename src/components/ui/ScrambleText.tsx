import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>/'

interface ScrambleTextProps {
  text: string
  className?: string
}

export function ScrambleText({ text, className = '' }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setDisplay(text)
      return
    }

    let iteration = 0
    const maxIterations = text.length * 3

    const interval = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' '
            if (i < iteration / 3) return text[i]
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join(''),
      )
      iteration++
      if (iteration >= maxIterations) {
        clearInterval(interval)
        setDisplay(text)
      }
    }, 40)

    return () => clearInterval(interval)
  }, [text, reduced])

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  )
}
