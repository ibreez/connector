import { BmlAccount, RawBmlTransaction } from '../types/bml';
import { IBmlAdapter, BmlAuthChallenge, BmlSessionInfo } from './bmlAdapterInterface';

export type SimulatedErrorMode =
  | 'NONE'
  | 'NETWORK_FAILURE'
  | 'BML_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'MALFORMED_TRANSACTION';

export class MockBmlAdapter implements IBmlAdapter {
  public readonly adapterName = 'Mock Bank of Maldives Adapter (Sandbox)';
  public readonly isMock = true;

  // Configurable simulation toggles for automated testing and UI demonstration
  public errorMode: SimulatedErrorMode = 'NONE';
  public shouldRequireOtp: boolean = true;
  public sessionTtlSeconds: number = 300; // 5 minutes default
  private currentChallengeId: string | null = null;
  private authenticatedSessions: Map<string, BmlSessionInfo> = new Map();

  // Preset restaurant accounts in Maldives (MVR primary + USD tourist card/forex)
  private accounts: BmlAccount[] = [
    {
      id: 'acc_bml_mvr_77300001234',
      bank: 'BML',
      displayName: 'Café & Bistro MVR Main Operating',
      maskedAccountNumber: '•••• 1234',
      currency: 'MVR',
      status: 'CONNECTED',
      balance: 148920.5,
      lastSuccessfulSync: new Date(Date.now() - 3600000).toISOString(),
      lastTransactionCheck: new Date(Date.now() - 60000).toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc_bml_usd_77300005678',
      bank: 'BML',
      displayName: 'Café & Bistro USD FX Settlement',
      maskedAccountNumber: '•••• 5678',
      currency: 'USD',
      status: 'CONNECTED',
      balance: 12450.0,
      lastSuccessfulSync: new Date(Date.now() - 3600000).toISOString(),
      lastTransactionCheck: new Date(Date.now() - 60000).toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
  ];

  // Base dataset including user-requested BML001 and BML002
  private mockTransactions: Record<string, RawBmlTransaction[]> = {
    acc_bml_mvr_77300001234: [
      {
        transactionId: 'BML001',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 250,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'CUSTOMER A',
        description: 'TRF FROM CUSTOMER A REF ORDER-1001',
        reference: 'ORDER-1001',
        transactionDate: '2026-09-13 14:10:00',
      },
      {
        transactionId: 'BML002',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 500,
        currency: 'MVR',
        direction: 'DEBIT',
        type: 'TRANSFER',
        sender: null,
        description: 'OUTGOING TRANSFER TO VENDOR SUPPLIES',
        reference: 'TEST',
        transactionDate: '2026-09-13 14:15:00',
      },
      {
        transactionId: 'BML-MVR-101',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 450.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK TRANSFER',
        sender: 'AHMED ALI',
        description: 'TRF FROM AHMED ALI BML MOBILE SLIP #123456',
        reference: '123456',
        transactionDate: '2026-09-13 15:22:00',
      },
      {
        transactionId: 'BML-MVR-102',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 120.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK TRANSFER',
        sender: 'AISHATH MARIYAM',
        description: 'IB TRANSFER FROM AISHATH MARIYAM REF: TBL-04',
        reference: 'TBL-04',
        transactionDate: '2026-09-13 15:24:12',
      },
      {
        // Non-transfer: POS Terminal batch settlement
        transactionId: 'BML-MVR-103',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 3840.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'SETTLEMENT',
        sender: null,
        description: 'BML SMART POS BATCH SETTLEMENT MID 880291',
        reference: 'BATCH-882',
        transactionDate: '2026-09-13 13:00:00',
      },
      {
        // Non-transfer: Direct Cash deposit at CDM
        transactionId: 'BML-MVR-104',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 1500.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'CASH_DEPOSIT',
        sender: null,
        description: 'CDM CASH DEP MALE MAIN BRANCH ATM 04',
        reference: 'CDM-9901',
        transactionDate: '2026-09-13 12:45:00',
      },
      {
        // Bank fee debit
        transactionId: 'BML-MVR-105',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 15.0,
        currency: 'MVR',
        direction: 'DEBIT',
        type: 'FEE',
        sender: null,
        description: 'MONTHLY BML INTERNET BANKING TOKEN CHARGE',
        reference: 'FEE-09',
        transactionDate: '2026-09-13 00:05:00',
      },
      // Two transactions with identical amounts arriving seconds apart for collision test
      {
        transactionId: 'BML-MVR-106A',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 85.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'IBRAHIM RAMEEZ',
        description: 'TRF FROM IBRAHIM RAMEEZ LUNCH SPECIAL',
        reference: 'TXN-9011',
        transactionDate: '2026-09-13 15:28:10',
      },
      {
        transactionId: 'BML-MVR-106B',
        accountId: 'acc_bml_mvr_77300001234',
        amount: 85.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'HASSAN KHALID',
        description: 'TRF FROM HASSAN KHALID COFFEE & PASTRY',
        reference: 'TXN-9012',
        transactionDate: '2026-09-13 15:28:18', // 8 seconds later, same amount, different person & ref!
      },
    ],
    acc_bml_usd_77300005678: [
      {
        transactionId: 'BML-USD-201',
        accountId: 'acc_bml_usd_77300005678',
        amount: 145.0,
        currency: 'USD',
        direction: 'CREDIT',
        type: 'BANK TRANSFER',
        sender: 'ELENA ROSTOVA',
        description: 'FT FROM ELENA ROSTOVA DINNER TABLE 12',
        reference: 'USD-TRF-441',
        transactionDate: '2026-09-13 15:15:30',
      },
      {
        transactionId: 'BML-USD-202',
        accountId: 'acc_bml_usd_77300005678',
        amount: 60.0,
        currency: 'USD',
        direction: 'CREDIT',
        type: 'BANK TRANSFER',
        sender: 'MARCUS VOGEL',
        description: 'TRF FROM MARCUS VOGEL CATERING ADVANCE',
        reference: 'USD-TRF-442',
        transactionDate: '2026-09-13 14:50:11',
      },
    ],
  };

  /**
   * Reset or inject dynamic transactions for testing
   */
  public addTransaction(accountId: string, tx: RawBmlTransaction) {
    if (!this.mockTransactions[accountId]) {
      this.mockTransactions[accountId] = [];
    }
    this.mockTransactions[accountId].unshift(tx);
  }

  public async startLogin(
    username: string,
    challengeResponse?: string
  ): Promise<{
    status: 'AUTHENTICATED' | 'OTP_REQUIRED' | 'FAILED';
    challenge?: BmlAuthChallenge;
    session?: BmlSessionInfo;
    error?: string;
  }> {
    if (this.errorMode === 'NETWORK_FAILURE') {
      throw new Error('Network error: Unable to connect to Bank of Maldives gateway (ERR_CONNECTION_TIMED_OUT)');
    }
    if (this.errorMode === 'BML_UNAVAILABLE') {
      throw new Error('Bank of Maldives Internet Banking is currently undergoing scheduled maintenance (HTTP 503)');
    }

    if (!username || username.trim() === '') {
      return { status: 'FAILED', error: 'BML username is required.' };
    }

    if (this.shouldRequireOtp) {
      const challengeId = 'bml_chl_' + Math.random().toString(36).substring(2, 9);
      this.currentChallengeId = challengeId;
      return {
        status: 'OTP_REQUIRED',
        challenge: {
          challengeId,
          step: 'OTP',
          message: 'BML Two-Factor Authentication required. An OTP has been dispatched to your registered device.',
          otpDeliveryMethod: 'BML Mobile App & SMS (•••• 55)',
        },
      };
    }

    // Direct auth (if OTP disabled for test)
    const token = 'bml_sess_' + Math.random().toString(36).substring(2, 12);
    const session: BmlSessionInfo = {
      sessionToken: token,
      authenticatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTtlSeconds * 1000).toISOString(),
      userIdMasked: username.length > 3 ? username.slice(0, 2) + '••••' + username.slice(-2) : '••••',
    };
    this.authenticatedSessions.set(token, session);

    return { status: 'AUTHENTICATED', session };
  }

  public async submitOtp(
    challengeId: string,
    otp: string
  ): Promise<{
    status: 'AUTHENTICATED' | 'FAILED';
    session?: BmlSessionInfo;
    error?: string;
  }> {
    if (this.errorMode === 'NETWORK_FAILURE') {
      throw new Error('Network error: Timed out during OTP verification with BML authentication service.');
    }

    if (this.currentChallengeId && challengeId !== this.currentChallengeId) {
      return { status: 'FAILED', error: 'Authentication challenge expired or invalid.' };
    }

    // Realistic verification: standard 6-digit OTP
    if (!otp || otp.trim().length < 4) {
      return { status: 'FAILED', error: 'Invalid OTP length. Please enter the valid OTP code received from BML.' };
    }

    // If user typed wrong OTP (simulate e.g. 000000 as rejected)
    if (otp.trim() === '000000') {
      return { status: 'FAILED', error: 'Incorrect OTP entered. Attempt rejected by BML security.' };
    }

    const token = 'bml_sess_' + Math.random().toString(36).substring(2, 12);
    const session: BmlSessionInfo = {
      sessionToken: token,
      authenticatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTtlSeconds * 1000).toISOString(),
      userIdMasked: 'rest••••_bml',
    };
    this.authenticatedSessions.set(token, session);
    this.currentChallengeId = null;

    return { status: 'AUTHENTICATED', session };
  }

  public async validateSession(session: BmlSessionInfo): Promise<boolean> {
    if (this.errorMode === 'SESSION_EXPIRED') {
      return false;
    }
    if (!session || !session.sessionToken) {
      return false;
    }
    const expiry = new Date(session.expiresAt).getTime();
    if (Date.now() > expiry) {
      return false;
    }
    return this.authenticatedSessions.has(session.sessionToken);
  }

  public async fetchAccounts(session: BmlSessionInfo): Promise<BmlAccount[]> {
    if (this.errorMode === 'SESSION_EXPIRED') {
      throw new Error('BML session expired. HTTP 401 Unauthorized.');
    }
    if (this.errorMode === 'NETWORK_FAILURE') {
      throw new Error('Network error connecting to BML accounts service.');
    }
    const isValid = await this.validateSession(session);
    if (!isValid) {
      throw new Error('Session is no longer valid. User re-authentication required.');
    }
    return [...this.accounts];
  }

  public async fetchTransactions(
    session: BmlSessionInfo,
    accountId: string,
    options?: { page?: number; limit?: number; since?: string }
  ): Promise<{
    transactions: RawBmlTransaction[];
    hasMore: boolean;
    nextPage?: number;
  }> {
    if (this.errorMode === 'SESSION_EXPIRED') {
      throw new Error('BML session expired. HTTP 401 Unauthorized.');
    }
    if (this.errorMode === 'NETWORK_FAILURE') {
      throw new Error('Network timeout while reading BML transaction history.');
    }
    if (this.errorMode === 'BML_UNAVAILABLE') {
      throw new Error('BML core banking transaction API unavailable. Error code 503.');
    }

    const isValid = await this.validateSession(session);
    if (!isValid) {
      throw new Error('Session has expired. Re-authentication required.');
    }

    if (this.errorMode === 'MALFORMED_TRANSACTION') {
      return {
        transactions: [
          {
            // Missing amounts, dates, and negative amounts
            transactionId: 'MALFORMED_001',
            accountId,
            amount: NaN,
            currency: 'MVR',
            direction: 'CREDIT',
            description: '',
            transactionDate: 'invalid-date',
          },
        ],
        hasMore: false,
      };
    }

    const list = this.mockTransactions[accountId] || [];
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const startIndex = (page - 1) * limit;
    const slice = list.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < list.length;

    return {
      transactions: slice,
      hasMore,
      nextPage: hasMore ? page + 1 : undefined,
    };
  }

  public async logout(session: BmlSessionInfo): Promise<void> {
    if (session.sessionToken) {
      this.authenticatedSessions.delete(session.sessionToken);
    }
  }
}
