import React from 'react';
import { ShieldCheck, Lock, AlertCircle, FileText, CheckCircle } from 'lucide-react';

export const SecurityNotice: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center space-x-2 text-stone-900 font-bold text-sm mb-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Private Restaurant Security &amp; BML Interface Architecture</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
          <div className="font-semibold text-stone-800 flex items-center gap-1.5 mb-1">
            <Lock className="w-3.5 h-3.5 text-stone-500" />
            <span>Strict Read-Only Guarantee</span>
          </div>
          <p className="leading-relaxed">
            The connector contains zero logic for initiating payments, transfers, beneficiary
            creations, or bill settlements. It only queries transaction statements to detect
            incoming customer bank transfers.
          </p>
        </div>

        <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
          <div className="font-semibold text-stone-800 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero Credential Persistence</span>
          </div>
          <p className="leading-relaxed">
            Raw BML passwords and OTPs are never stored in Firestore documents, client localStorage,
            or application logs. Sessions are validated in-memory only.
          </p>
        </div>

        <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
          <div className="font-semibold text-stone-800 flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Legitimate BML Interface Policy</span>
          </div>
          <p className="leading-relaxed">
            No reverse engineering, bot evasion, or CAPTCHA bypass is permitted. When a session
            times out, polling halts immediately and requests legitimate re-authentication.
          </p>
        </div>
      </div>
    </div>
  );
};
