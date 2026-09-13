import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, KeyRound, Smartphone, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (username: string, password?: string) => Promise<{
    status: 'CONNECTED' | 'OTP_REQUIRED' | 'FAILED';
    message: string;
    otpDetails?: { challengeId: string; delivery: string };
  }>;
  onSubmitOtp: (challengeId: string, otp: string) => Promise<{
    status: 'CONNECTED' | 'FAILED';
    message: string;
  }>;
  isReauth?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onSubmitOtp,
  isReauth = false,
}) => {
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('CREDENTIALS');
      setPassword('');
      setOtp('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('Please enter your BML business account username.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await onConnect(username.trim(), password);
      if (res.status === 'OTP_REQUIRED' && res.otpDetails) {
        setChallengeId(res.otpDetails.challengeId);
        setDeliveryMethod(res.otpDetails.delivery);
        setStep('OTP');
      } else if (res.status === 'CONNECTED') {
        onClose();
      } else {
        setErrorMessage(res.message || 'Authentication rejected by Bank of Maldives.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection failed.');
    } finally {
      setLoading(false);
      // Immediately wipe memory copy of password
      setPassword('');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 4) {
      setErrorMessage('Please enter the valid OTP code received from BML.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await onSubmitOtp(challengeId, otp.trim());
      if (res.status === 'CONNECTED') {
        onClose();
      } else {
        setErrorMessage(res.message || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
      setOtp('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        id="bml-auth-modal"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-700 text-white flex items-center justify-center font-black text-sm">
              BML
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">
                {isReauth ? 'BML Re-authentication' : 'Connect BML Account'}
              </div>
              <div className="text-[11px] text-stone-400">Bank of Maldives &bull; Read-Only Session</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Assurance Notice */}
        <div className="bg-stone-50 border-b border-stone-200 px-5 py-3 flex items-start gap-2.5 text-xs text-stone-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-tight">
            Credentials are handled transiently to establish the authorized read-only session.
            Passwords are <strong className="text-stone-800">never stored</strong> in Firestore,
            localStorage, or source code.
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: Enter Credentials */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleCredentialsSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                BML Internet Banking Username
              </label>
              <div className="relative">
                <input
                  id="bml-username-input"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. restaurant_bml_admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white text-stone-900"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Your registered Bank of Maldives username.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                BML Password
              </label>
              <div className="relative">
                <input
                  id="bml-password-input"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white text-stone-900"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Passed to the BML login challenge; not persisted.
              </p>
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
                id="submit-credentials-button"
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying with BML...' : 'Continue to Verification &rarr;'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter OTP */}
        {step === 'OTP' && (
          <form onSubmit={handleOtpSubmit} className="p-5 space-y-4">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-2">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-stone-900">
                Two-Factor Authentication (OTP)
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Please enter the security verification code sent by BML via{' '}
                <strong className="text-stone-700">{deliveryMethod || 'SMS / Mobile App'}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 text-center">
                One-Time Password (OTP)
              </label>
              <input
                id="bml-otp-input"
                type="text"
                required
                autoFocus
                maxLength={8}
                placeholder="e.g. 849201"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white text-stone-900"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep('CREDENTIALS')}
                className="px-3 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
              >
                &larr; Back
              </button>
              <button
                id="submit-otp-button"
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? 'Establishing Session...' : 'Authorize Read-Only Access'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
