import { Component } from "react";
import { clearChunkRecoveryAttempt, isChunkLoadError, markChunkRecoveryAttempt } from "../../utils/chunkRecovery";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("RestoSphere render error:", error, info);
    }

    if (isChunkLoadError(error) && markChunkRecoveryAttempt()) {
      window.location.reload();
    }
  }

  handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      clearChunkRecoveryAttempt();
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-rose-700">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              An unexpected error occurred while rendering this page.
            </p>
            {import.meta.env.DEV ? (
              <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {error?.message ? String(error.message) : String(error)}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
