import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { TestSuiteResult, runAllConnectorTests } from '../tests/testRunner';

interface TestBenchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectTestTransfer: () => void;
  onSimulateSessionExpiry: () => void;
}

export const TestBenchModal: React.FC<TestBenchModalProps> = ({
  isOpen,
  onClose,
  onInjectTestTransfer,
  onSimulateSessionExpiry,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testSuite, setTestSuite] = useState<TestSuiteResult | null>(null);

  if (!isOpen) return null;

  const handleRunAllTests = async () => {
    setIsRunning(true);
    try {
      const results = await runAllConnectorTests();
      setTestSuite(results);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        id="test-bench-modal"
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-700 text-white flex items-center justify-center font-black text-sm">
              TEST
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">
                BML Connector Test Suite &amp; Scenarios
              </div>
              <div className="text-[11px] text-stone-400">
                12 automated verification scenarios specified in requirements
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Live Injections */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              id="run-all-tests-btn"
              onClick={handleRunAllTests}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running Suite...' : 'Run All 12 Tests'}</span>
            </button>

            {testSuite && (
              <span className="text-xs font-semibold text-stone-600">
                {testSuite.passed}/{testSuite.total} Passed ({testSuite.durationMs}ms)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onInjectTestTransfer();
                onClose();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-md transition-colors"
              title="Simulate a new incoming transfer arriving in real-time"
            >
              <Sparkles className="w-3 h-3 text-red-600" />
              <span>Simulate New Transfer</span>
            </button>

            <button
              onClick={() => {
                onSimulateSessionExpiry();
                onClose();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
              title="Simulate session expiry triggering REAUTH_REQUIRED"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Simulate Expiry</span>
            </button>
          </div>
        </div>

        {/* Test Cases List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {testSuite ? (
            testSuite.results.map((test, idx) => (
              <div
                key={test.id}
                id={`test-result-${test.id}`}
                className={`p-3.5 rounded-xl border text-xs transition-all ${
                  test.passed
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-rose-200 bg-rose-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center space-x-2">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold text-stone-900">
                      {idx + 1}. {test.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">
                    {test.durationMs}ms
                  </span>
                </div>

                <p className="text-stone-600 text-[11px] ml-6 mb-1.5">
                  {test.description}
                </p>

                <div
                  className={`ml-6 p-2 rounded text-[11px] font-mono ${
                    test.passed
                      ? 'bg-emerald-100/60 text-emerald-900'
                      : 'bg-rose-100/80 text-rose-900'
                  }`}
                >
                  {test.message}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-stone-500">
              <ShieldCheck className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-stone-700">Ready to execute tests</div>
              <p className="text-xs text-stone-400 max-w-md mx-auto mt-1">
                Click &quot;Run All 12 Tests&quot; above to validate BML001/BML002 identification,
                deduplication, session expiration, network timeout backoff, and identical amount
                separation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
