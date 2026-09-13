import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Sliders,
  Unplug,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { ConnectionState } from '../types/bml';

interface ConnectionStatusCardProps {
  state: ConnectionState;
  onSyncNow: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onIntervalChange: (seconds: number) => void;
  isSyncing: boolean;
  newTransfersCount: number;
}

export const ConnectionStatusCard: React.FC<ConnectionStatusCardProps> = ({
  state,
  onSyncNow,
  onReconnect,
  onDisconnect,
  onIntervalChange,
  isSyncing,
  newTransfersCount,
}) => {
  const isConnected = state.status === 'CONNECTED';
  const isReauth = state.status === 'REAUTH_REQUIRED';
  const isError = state.status === 'ERROR';

  return (
    <div
      id="bml-connection-card"
      className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
            BML Connection
          </div>
          <div className="flex items-center gap-2.5">
            {isConnected && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-emerald-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
                🟢 Connected
              </span>
            )}
            {state.status === 'SYNCING' && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-sky-700">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                Synchronizing Statements...
              </span>
            )}
            {isReauth && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
                ⚠️ Re-authentication Required
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-rose-700">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                🔴 Connection Issue
              </span>
            )}
            {state.status === 'DISCONNECTED' && (
              <span className="inline-flex items-center gap-1.5 text-base font-bold text-stone-600">
                <span className="w-3 h-3 rounded-full bg-stone-400"></span>
                ⚪ Not Connected
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isConnected && (
            <button
              id="sync-now-button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          )}

          {isReauth && (
            <button
              id="reconnect-button"
              onClick={onReconnect}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Authenticate with BML</span>
            </button>
          )}

          {!isConnected && !isReauth && (
            <button
              id="initial-connect-button"
              onClick={onReconnect}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors"
            >
              <span>Connect BML Account</span>
            </button>
          )}

          {isConnected && (
            <button
              id="disconnect-button"
              onClick={onDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              title="Disconnect authenticated session"
            >
              <Unplug className="w-3.5 h-3.5 text-stone-500" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* Connection Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
        <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
          <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-stone-400" />
            <span>Last Sync</span>
          </div>
          <div className="text-sm font-bold text-stone-800 tracking-tight">
            {state.lastSync || 'Never'}
          </div>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
          <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
            <Activity className="w-3 h-3 text-stone-400" />
            <span>Next Check</span>
          </div>
          <div className="text-sm font-bold text-stone-800 tracking-tight">
            {isConnected ? state.nextCheck || 'Calculating...' : 'Paused'}
          </div>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
          <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>New Transfers</span>
          </div>
          <div className="text-sm font-bold text-emerald-700">
            {newTransfersCount} pending
          </div>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
          <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
            <Sliders className="w-3 h-3 text-stone-400" />
            <span>Polling Interval</span>
          </div>
          <select
            id="polling-interval-select"
            value={state.pollingIntervalSeconds}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="text-xs font-bold text-stone-800 bg-white border border-stone-300 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-red-600"
          >
            <option value={15}>15s (Testing)</option>
            <option value={30}>30s (Fast)</option>
            <option value={60}>60s (Default)</option>
            <option value={120}>2 mins</option>
            <option value={300}>5 mins</option>
          </select>
        </div>
      </div>

      {/* Error / Reauth Alert Banner if present */}
      {state.lastError && (
        <div
          id="connection-error-banner"
          className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-0.5">Connection Notice</div>
            <p className="text-amber-800 leading-relaxed">{state.lastError}</p>
            {isReauth && (
              <div className="mt-2">
                <button
                  onClick={onReconnect}
                  className="px-2.5 py-1 bg-amber-700 text-white rounded font-medium text-[11px] hover:bg-amber-800 transition-colors"
                >
                  Enter User Credentials & OTP &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
