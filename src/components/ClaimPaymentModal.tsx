import React, { useState } from 'react';
import { X, Utensils, Hash, UserCheck, Shield } from 'lucide-react';
import { BmlTransaction } from '../types/bml';

interface ClaimPaymentModalProps {
  transaction: BmlTransaction | null;
  onClose: () => void;
  onConfirmClaim: (fingerprint: string, orderId: string, staffName: string) => Promise<void>;
}

export const ClaimPaymentModal: React.FC<ClaimPaymentModalProps> = ({
  transaction,
  onClose,
  onConfirmClaim,
}) => {
  const [orderId, setOrderId] = useState('');
  const [staffName, setStaffName] = useState('Cashier 1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirmClaim(transaction.fingerprint, orderId.trim(), staffName.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        id="claim-payment-modal"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
      >
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-700 text-white flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Claim Guest Bank Transfer</div>
              <div className="text-[11px] text-stone-400">Match customer transfer to restaurant order</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Details Card */}
        <div className="p-4 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-stone-500">Customer Transfer</div>
            <div className="text-lg font-black text-stone-900 font-mono">
              {transaction.currency} {transaction.amount.toFixed(2)}
            </div>
            <div className="text-xs font-semibold text-stone-800">{transaction.sender}</div>
          </div>
          <div className="text-right text-xs text-stone-500">
            <div>Ref: <span className="font-mono font-bold text-stone-800">{transaction.reference}</span></div>
            <div className="text-[11px] text-stone-400">{transaction.transactionDate}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Table / Order / Bill Number *
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="claim-order-id-input"
                type="text"
                required
                autoFocus
                placeholder="e.g. Table 04 or Bill #1082"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white text-stone-900"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Links this BML transfer to your restaurant POS order.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Staff Member / Cashier Name
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="claim-staff-name-input"
                type="text"
                required
                placeholder="e.g. Ahmed / Shift Lead"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white text-stone-900"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-claim-button"
              type="submit"
              disabled={isSubmitting || !orderId.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Confirming Claim...' : 'Confirm & Mark Claimed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
