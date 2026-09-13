import React from 'react';
import { Building, Wallet, Check } from 'lucide-react';
import { BmlAccount } from '../types/bml';

interface AccountsListProps {
  accounts: BmlAccount[];
  selectedAccountId: string | 'ALL';
  onSelectAccount: (id: string | 'ALL') => void;
}

export const AccountsList: React.FC<AccountsListProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Restaurant BML Accounts
        </div>
        <button
          onClick={() => onSelectAccount('ALL')}
          className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
            selectedAccountId === 'ALL'
              ? 'bg-red-700 text-white'
              : 'text-stone-500 hover:text-stone-800 bg-stone-100'
          }`}
        >
          View All ({accounts.length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          const isMvr = acc.currency === 'MVR';

          return (
            <div
              key={acc.id}
              id={`account-card-${acc.id}`}
              onClick={() => onSelectAccount(isSelected ? 'ALL' : acc.id)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600'
                  : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/60 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                      isMvr
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {acc.currency}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 leading-tight">
                      BML {acc.currency} {acc.maskedAccountNumber}
                    </div>
                    <div className="text-[11px] text-stone-500">{acc.displayName}</div>
                  </div>
                </div>

                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-red-700 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                <span className="text-stone-500 flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-stone-400" />
                  <span>Balance</span>
                </span>
                <span className="font-semibold text-stone-900 font-mono">
                  {acc.balance !== undefined
                    ? `${acc.currency} ${acc.balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Available on sync'}
                </span>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="col-span-2 py-6 text-center text-xs text-stone-500 border border-dashed border-stone-200 rounded-lg">
            No accounts connected yet. Click &quot;Connect BML Account&quot; to establish connection.
          </div>
        )}
      </div>
    </div>
  );
};
