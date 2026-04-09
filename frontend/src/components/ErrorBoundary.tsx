import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-4">
          <p className="font-body text-sm text-cream-muted mb-3">
            Something went wrong rendering this section.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-gold/70 px-4 py-2 text-sm font-medium font-body text-gold hover:bg-gold hover:text-navy-950 transition-colors"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
