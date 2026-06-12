import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface TypewriterLoopProps {
  words: string[]
  className?: string
}

export function TypewriterLoop({ words, className = '' }: TypewriterLoopProps) {
  const [wordIndex, setWordIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const reduced = useReducedMotion()

  const current = words[wordIndex] ?? ''

  useEffect(() => {
    if (reduced) return

    const speed = deleting ? 40 : 80
    const timeout = setTimeout(() => {
      if (!deleting && charIndex < current.length) {
        setCharIndex((c) => c + 1)
      } else if (!deleting && charIndex === current.length) {
        setTimeout(() => setDeleting(true), 1500)
      } else if (deleting && charIndex > 0) {
        setCharIndex((c) => c - 1)
      } else if (deleting && charIndex === 0) {
        setDeleting(false)
        setWordIndex((i) => (i + 1) % words.length)
      }
    }, speed)

    return () => clearTimeout(timeout)
  }, [charIndex, current.length, deleting, reduced, words.length])

  const display = reduced ? words[0] : current.slice(0, charIndex)

  return (
    <span className={className} aria-live="polite">
      {display}
      <span className="text-indigo-400/80">|</span>
    </span>
  )
}
