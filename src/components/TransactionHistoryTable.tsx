import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Info,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { BmlTransaction } from '../types/bml';

interface TransactionHistoryTableProps {
  transactions: BmlTransaction[];
  onClaimTransfer: (tx: BmlTransaction) => void;
}

export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  onClaimTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOMING' | 'OTHER_CREDIT' | 'DEBIT'>('ALL');

  const filtered = transactions.filter((t) => {
    // Filter type
    if (filterType === 'INCOMING' && !t.isIncomingTransfer) return false;
    if (filterType === 'OTHER_CREDIT' && (t.direction !== 'CREDIT' || t.isIncomingTransfer)) return false;
    if (filterType === 'DEBIT' && t.direction !== 'DEBIT') return false;

    // Search
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (t.sender && t.sender.toLowerCase().includes(term)) ||
      (t.description && t.description.toLowerCase().includes(term)) ||
      (t.reference && t.reference.toLowerCase().includes(term)) ||
      t.amount.toString().includes(term) ||
      (t.orderId && t.orderId.toLowerCase().includes(term))
    );
  });

  const getClassificationBadge = (tx: BmlTransaction) => {
    switch (tx.classification) {
      case 'INCOMING_TRANSFER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
            Incoming Transfer
          </span>
        );
      case 'POS_MERCHANT_SETTLEMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            POS Settlement
          </span>
        );
      case 'CASH_DEPOSIT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
            Cash Deposit
          </span>
        );
      case 'INTEREST_CREDIT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
            Bank Interest
          </span>
        );
      case 'REVERSAL_OR_REFUND':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            Reversal / Refund
          </span>
        );
      case 'BANK_FEE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-700">
            Bank Fee
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600">
            {tx.direction === 'CREDIT' ? 'Credit' : 'Debit'}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-stone-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Transaction History
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Statements synchronized from legitimate Bank of Maldives internet banking session
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                id="search-transactions-input"
                type="text"
                placeholder="Search sender, ref, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600 focus:bg-white w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              filterType === 'ALL'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Statements ({transactions.length})
          </button>
          <button
            onClick={() => setFilterType('INCOMING')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              filterType === 'INCOMING'
                ? 'bg-emerald-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Incoming Transfers ({transactions.filter((t) => t.isIncomingTransfer).length})
          </button>
          <button
            onClick={() => setFilterType('OTHER_CREDIT')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              filterType === 'OTHER_CREDIT'
                ? 'bg-blue-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Other Credits / POS (
            {transactions.filter((t) => t.direction === 'CREDIT' && !t.isIncomingTransfer).length})
          </button>
          <button
            onClick={() => setFilterType('DEBIT')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              filterType === 'DEBIT'
                ? 'bg-rose-700 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Debits ({transactions.filter((t) => t.direction === 'DEBIT').length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Direction & Date</th>
              <th className="py-3 px-4">Sender / Description</th>
              <th className="py-3 px-4">Classification</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Status / Claim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map((tx) => {
              const isCredit = tx.direction === 'CREDIT';

              return (
                <tr
                  key={tx.fingerprint || tx.id}
                  className="hover:bg-stone-50/70 transition-colors"
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div>
                        <div className="font-semibold text-stone-800">{tx.direction}</div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          {tx.transactionDate}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-bold text-stone-900 truncate">
                      {tx.sender || (isCredit ? 'Anonymous Transfer' : 'Expense / Outgoing')}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate" title={tx.description}>
                      {tx.description}
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      {getClassificationBadge(tx)}
                      <span
                        className="text-[10px] text-stone-400 truncate max-w-[140px]"
                        title={tx.classificationReason}
                      >
                        {tx.classificationReason}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-stone-600">
                    {tx.reference || '—'}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold">
                    <span className={isCredit ? 'text-emerald-700' : 'text-stone-900'}>
                      {isCredit ? '+' : '-'} {tx.currency}{' '}
                      {tx.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    {tx.isIncomingTransfer ? (
                      tx.claimed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          <span>{tx.orderId || 'Claimed'}</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onClaimTransfer(tx)}
                          className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Claim
                        </button>
                      )
                    ) : (
                      <span className="text-stone-400 text-[11px]">Ignored</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-stone-400 text-xs">
                  No transactions match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
