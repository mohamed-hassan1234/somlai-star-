import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-xl dark:border-ink-700 dark:bg-ink-900">
          <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            A page failed to load. Reloading usually fixes it. If it keeps happening, share the message below with your developer.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 text-left text-xs text-danger dark:bg-ink-950">
            {this.state.error.message || 'Unknown error'}
          </pre>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => window.history.back()}>
              Go back
            </Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    )
  }
}
