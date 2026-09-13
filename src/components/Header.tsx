import React from 'react';
import { ShieldCheck, RefreshCw, PlayCircle, Lock, Building2 } from 'lucide-react';
import { ConnectionState } from '../types/bml';

interface HeaderProps {
  connectionState: ConnectionState;
  onOpenConnectModal: () => void;
  onOpenTestBench: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  onOpenConnectModal,
  onOpenTestBench,
  onSyncNow,
  isSyncing,
}) => {
  const getStatusBadge = () => {
    switch (connectionState.status) {
      case 'CONNECTED':
        return (
          <div
            id="status-badge-connected"
            className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>BML Connected</span>
          </div>
        );
      case 'SYNCING':
        return (
          <div
            id="status-badge-syncing"
            className="flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-semibold"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
            <span>Checking Transactions...</span>
          </div>
        );
      case 'REAUTH_REQUIRED':
        return (
          <div
            id="status-badge-reauth"
            className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold cursor-pointer"
            onClick={onOpenConnectModal}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>Re-auth Required</span>
          </div>
        );
      case 'ERROR':
        return (
          <div
            id="status-badge-error"
            className="flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Connection Error</span>
          </div>
        );
      default:
        return (
          <div
            id="status-badge-disconnected"
            className="flex items-center gap-2 px-3 py-1 bg-stone-100 text-stone-600 border border-stone-200 rounded-full text-xs font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-stone-400"></span>
            <span>Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-red-700 text-white flex items-center justify-center font-bold text-lg shadow-xs tracking-tight">
            BML
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
                <span>Restaurant Transfer Monitor</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                  Maldives
                </span>
              </h1>
            </div>
            <p className="text-xs text-stone-500 flex items-center gap-1">
              <Lock className="w-3 h-3 text-stone-400" />
              <span>Private Internal Connector &bull; Read-Only</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {getStatusBadge()}

          {connectionState.status === 'CONNECTED' && (
            <button
              id="header-sync-btn"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-md transition-colors disabled:opacity-50"
              title="Manual refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-red-600' : 'text-stone-600'}`} />
              <span>Sync Now</span>
            </button>
          )}

          <button
            id="open-testbench-btn"
            onClick={onOpenTestBench}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Test Suite & Scenarios</span>
          </button>

          {connectionState.status !== 'CONNECTED' ? (
            <button
              id="header-connect-btn"
              onClick={onOpenConnectModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors shadow-xs"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Connect BML</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
