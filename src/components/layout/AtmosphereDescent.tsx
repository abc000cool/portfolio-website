import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useLightExperience } from '../../hooks/useTouchDevice'

/** Static atmosphere for mobile/Safari — no scroll-driven React updates. */
export function AtmosphereDescent() {
  const reduced = useReducedMotion()
  const light = useLightExperience()

  if (reduced) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.15), transparent 50%)',
          }}
        />
      </div>
    )
  }

  if (light) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 85% 55% at 22% -8%, rgba(99,102,241,0.22), transparent 58%),
              radial-gradient(ellipse 70% 50% at 78% 35%, rgba(129,140,248,0.12), transparent 52%),
              linear-gradient(180deg, rgb(6,6,10) 0%, rgb(10,10,16) 50%, rgb(12,11,14) 100%)
            `,
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 55% at 22% -8%, rgba(99,102,241,0.24), transparent 58%),
            radial-gradient(ellipse 70% 50% at 78% 35%, rgba(129,140,248,0.14), transparent 52%),
            linear-gradient(180deg, rgb(6,6,10) 0%, rgb(10,10,18) 45%, rgb(14,12,12) 100%)
          `,
          opacity: 0.65,
        }}
      />
    </div>
  )
}
