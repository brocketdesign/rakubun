import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-rakubun-bg px-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-semibold text-rakubun-text">
              Something went wrong
            </h1>
            <p className="text-rakubun-text-secondary text-sm">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs text-left overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-rakubun-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Reload page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg border border-rakubun-border text-rakubun-text text-sm font-medium hover:bg-rakubun-bg-secondary transition-colors"
              >
                Go to homepage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
