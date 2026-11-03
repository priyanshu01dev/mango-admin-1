import React from 'react';

/** Catches render errors so one broken screen shows a message instead of a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ui] crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white border border-rose-200 rounded-2xl p-6 max-w-md text-center space-y-3">
          <h2 className="text-lg font-black text-ink">Something went wrong on this screen</h2>
          <p className="text-xs text-stone-500">Your data is safe on the server. Reload to continue; if it keeps happening, contact support with the time it happened.</p>
          <pre className="text-[10px] text-rose-700 bg-rose-50 rounded-lg p-2 overflow-auto text-left">{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="bg-mango-500 hover:bg-mango-600 text-white font-bold px-4 py-2 rounded-xl text-xs">Reload</button>
        </div>
      </div>
    );
  }
}
