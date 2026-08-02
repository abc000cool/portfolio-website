import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time crashes so the page degrades to a readable panel instead of
 * a blank black screen. The common real-world trigger is a stale JS chunk 404 after
 * a redeploy while an old tab is still open — reloading fixes it, so the fallback
 * leads with a reload action.
 *
 * Styles are inline: if the failure was the stylesheet or a CSS-owning chunk, the
 * fallback still has to be legible.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#06060a',
          color: '#e2e8f0',
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: '32rem', width: '100%' }}>
          <p
            style={{
              margin: '0 0 0.75rem',
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: '0.7rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#818cf8',
            }}
          >
            Telemetry lost
          </p>
          <h1
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1.75rem',
              lineHeight: 1.2,
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            Something broke on this page
          </h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.6, color: '#94a3b8' }}>
            This usually means the site was updated while your tab was open. Reloading pulls the
            current version.
          </p>

          <pre
            style={{
              margin: '0 0 1.75rem',
              padding: '0.9rem 1rem',
              borderRadius: '0.6rem',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: '#cbd5e1',
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: '0.75rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowX: 'auto',
            }}
          >
            {error.message || String(error)}
          </pre>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                cursor: 'pointer',
                padding: '0.7rem 1.4rem',
                borderRadius: '999px',
                border: '1px solid rgba(129,140,248,0.5)',
                background: 'rgba(129,140,248,0.12)',
                color: '#c7d2fe',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(148,163,184,0.4)',
                paddingBottom: '2px',
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
