import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
            <p className="text-sm font-medium text-zinc-200">Something went wrong in the UI.</p>
            <p className="max-w-md text-xs text-zinc-500">{this.state.error.message}</p>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08]"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
