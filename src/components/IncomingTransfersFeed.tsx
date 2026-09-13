import React from 'react';
import { ArrowDownLeft, CheckCircle, Clock, Hash, User, Utensils, Check } from 'lucide-react';
import { BmlTransaction } from '../types/bml';

interface IncomingTransfersFeedProps {
  transfers: BmlTransaction[];
  onClaimTransfer: (tx: BmlTransaction) => void;
}

export const IncomingTransfersFeed: React.FC<IncomingTransfersFeedProps> = ({
  transfers,
  onClaimTransfer,
}) => {
  const unclaimedTransfers = transfers.filter((t) => !t.claimed);
  const claimedTransfers = transfers.filter((t) => t.claimed);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span>New Incoming Transfers</span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Confirmed customer bank transfers ready to be claimed against restaurant tables & bills
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full">
          {unclaimedTransfers.length} Pending
        </span>
      </div>

      {/* Unclaimed Pending Transfers List */}
      <div className="space-y-3">
        {unclaimedTransfers.map((tx) => {
          const formattedAmount = `${tx.currency} ${tx.amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

          return (
            <div
              key={tx.id || tx.fingerprint}
              id={`incoming-transfer-${tx.reference || tx.fingerprint}`}
              className="p-4 rounded-xl border border-red-200/80 bg-linear-to-r from-red-50/30 to-amber-50/20 hover:border-red-300 transition-all shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-stone-900 tracking-tight font-mono">
                      {formattedAmount}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                      Incoming Transfer
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{tx.sender || 'Anonymous Bank Customer'}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-stone-400" />
                      <span className="font-mono font-medium text-stone-700">
                        Ref: {tx.reference || 'N/A'}
                      </span>
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{tx.transactionDate}</span>
                    </span>

                    {tx.accountName && (
                      <span className="text-stone-400">&bull; {tx.accountName}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id={`claim-btn-${tx.reference || tx.fingerprint}`}
                    onClick={() => onClaimTransfer(tx)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Claim Payment</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {unclaimedTransfers.length === 0 && (
          <div className="py-10 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <div className="text-sm font-semibold text-stone-800">No Unclaimed Transfers</div>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              All incoming customer bank transfers have been matched and claimed for orders.
            </p>
          </div>
        )}
      </div>

      {/* Claimed Transfers summary */}
      {claimedTransfers.length > 0 && (
        <div className="mt-5 pt-4 border-t border-stone-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Recently Claimed ({claimedTransfers.length})
          </div>
          <div className="space-y-2">
            {claimedTransfers.slice(0, 3).map((tx) => (
              <div
                key={tx.id || tx.fingerprint}
                className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <div>
                    <span className="font-semibold text-stone-900 mr-2">
                      {tx.currency} {tx.amount.toFixed(2)}
                    </span>
                    <span className="text-stone-600">{tx.sender}</span>
                  </div>
                </div>
                <div className="text-stone-500 text-[11px] font-mono">
                  Order: <span className="font-bold text-stone-800">{tx.orderId || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
