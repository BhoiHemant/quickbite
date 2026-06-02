import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw, AlertCircle, Copy, HelpCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error('[Global Error Boundary] Caught uncaught runtime error:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear potentially corrupted local store that might cause infinite crashes
    try {
      localStorage.removeItem('quickbite-restaurant-storage');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  private handleCopyError = () => {
    if (!this.state.error) return;
    const errorText = `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorText);
    alert('Error details copied to clipboard!');
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-svh bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12 select-none animate-in fade-in duration-200 text-left">
          <div className="w-full max-w-xl space-y-6">
            
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-900 pb-5">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl animate-pulse">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white uppercase tracking-wider">Application Crash Intercepted</h1>
                <p className="text-xs text-slate-500 mt-0.5">QuickBite caught an unhandled runtime error. The interface was suspended safely.</p>
              </div>
            </div>

            {/* Error Details */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-slate-700">
                <AlertCircle className="w-16 h-16 opacity-10 -mr-4 -mt-4 rotate-12" />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Error Signature</span>
                <button 
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Error</span>
                </button>
              </div>

              <div className="font-mono text-xs text-rose-300 bg-slate-950 p-4 rounded-xl border border-slate-850 overflow-x-auto whitespace-pre-wrap max-h-48 scrollbar-thin">
                {this.state.error?.toString() || 'Unknown Runtime Error'}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-3 pt-3 border-t border-slate-900 text-slate-500">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </div>

            {/* Recovery Instructions */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex gap-2 text-amber-500 font-black text-xs uppercase tracking-wider items-center">
                <HelpCircle className="w-4 h-4" />
                <span>Recovery Instructions</span>
              </div>
              
              <ul className="text-[11px] text-slate-450 space-y-2 list-disc list-inside leading-relaxed font-semibold">
                <li>
                  <strong className="text-slate-200">Force Reload:</strong> Try clicking the retry button below to flush cached app structures and reload the current view.
                </li>
                <li>
                  <strong className="text-slate-200">Clear Cache:</strong> The retry button automatically clears corrupted restaurant session states from local storage.
                </li>
                <li>
                  <strong className="text-slate-200">Verify Supabase credentials:</strong> If this error persists after reloading, make sure your Supabase project instance has not been paused or deleted.
                </li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 h-12 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Cache & Reload Application</span>
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
