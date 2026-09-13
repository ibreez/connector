import { BmlAccount, RawBmlTransaction } from '../types/bml';

export interface BmlAuthChallenge {
  challengeId: string;
  step: 'PASSWORD' | 'OTP';
  message: string;
  otpDeliveryMethod?: string; // e.g. "SMS ending in ••••55" or "BML Mobile Authenticator App"
}

export interface BmlSessionInfo {
  sessionToken?: string; // ephemeral internal reference, never stored in DB or client
  authenticatedAt: string;
  expiresAt: string;
  userIdMasked: string;
}

/**
 * Interface contract for BML Banking Adapters.
 * Strictly adheres to read-only semantics. No fund transfers or modification operations exist.
 */
export interface IBmlAdapter {
  readonly adapterName: string;
  readonly isMock: boolean;

  /**
   * Initiate authentication with Bank of Maldives legitimate portal
   */
  startLogin(username: string, passwordOrChallengeResponse?: string): Promise<{
    status: 'AUTHENTICATED' | 'OTP_REQUIRED' | 'FAILED';
    challenge?: BmlAuthChallenge;
    session?: BmlSessionInfo;
    error?: string;
  }>;

  /**
   * Submit the 2FA/OTP entered directly by the account owner
   */
  submitOtp(challengeId: string, otp: string): Promise<{
    status: 'AUTHENTICATED' | 'FAILED';
    session?: BmlSessionInfo;
    error?: string;
  }>;

  /**
   * Check if current session is still valid without making a full heavy query
   */
  validateSession(session: BmlSessionInfo): Promise<boolean>;

  /**
   * Fetch connected restaurant accounts (MVR & USD)
   */
  fetchAccounts(session: BmlSessionInfo): Promise<BmlAccount[]>;

  /**
   * Fetch raw transaction statement history for an account
   */
  fetchTransactions(
    session: BmlSessionInfo,
    accountId: string,
    options?: { page?: number; limit?: number; since?: string }
  ): Promise<{
    transactions: RawBmlTransaction[];
    hasMore: boolean;
    nextPage?: number;
  }>;

  /**
   * Terminate authorized session gracefully
   */
  logout(session: BmlSessionInfo): Promise<void>;
}
