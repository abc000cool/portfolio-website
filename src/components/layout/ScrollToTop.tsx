import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll position on route change (fixes landing at bottom on ISM/project pages). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
