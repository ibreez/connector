import { BmlAccount, RawBmlTransaction } from '../types/bml';
import { IBmlAdapter, BmlAuthChallenge, BmlSessionInfo } from './bmlAdapterInterface';

interface BmlApiResponse<T = any> {
  success?: boolean;
  message?: string;
  payload?: T;
  error?: string;
}

interface BmlDashboardItem {
  id: string;
  account: string;
  account_name?: string;
  product_group?: string;
  currency?: string;
  available_balance?: string | number;
  ledger_balance?: string | number;
  status?: string;
  [key: string]: any;
}

interface BmlHistoryItem {
  id?: string;
  narrative1?: string;
  narrative2?: string;
  narrative3?: string;
  narrative4?: string;
  amount?: string | number;
  currency?: string;
  minus?: boolean;
  balance?: string | number;
  booking_date?: string;
  value_date?: string;
  reference?: string;
  sender?: string;
  receiver?: string;
  date?: string;
  [key: string]: any;
}

/**
 * Real Bank of Maldives (BML) Banking Adapter.
 * Connects directly to Bank of Maldives endpoints (https://www.bankofmaldives.com.mv/internetbanking/api/).
 *
 * Security Guarantees:
 * 1. Read-only: Only queries dashboard & statement history. Zero fund transfers or mutation capability.
 * 2. In-Memory Only: Passwords and session cookies reside strictly in memory and are never persisted to disk or DB.
 * 3. Two-Factor Respect: Respects bank OTP challenges without attempting to bypass or automate them.
 * 4. Transparent Errors: Passes through legitimate bank rate-limits, session expirations, and challenges.
 */
export class RealBmlAdapter implements IBmlAdapter {
  public readonly adapterName = 'Bank of Maldives Internet Banking (Live Gateway)';
  public readonly isMock = false;

  private baseUrl: string = 'https://www.bankofmaldives.com.mv/internetbanking/api/';
  private cookieJar: Map<string, string> = new Map();
  private sessionTtlSeconds: number = 900; // BML standard 15 minute inactivity timeout
  private currentChallenge: { challengeId: string; username: string; token?: string } | null = null;
  private authenticatedSessions: Map<string, { session: BmlSessionInfo; cookies: string; username: string }> = new Map();

  constructor(customBaseUrl?: string) {
    if (customBaseUrl) {
      this.baseUrl = customBaseUrl.endsWith('/') ? customBaseUrl : customBaseUrl + '/';
    }
  }

  /**
   * Helper to format headers with cookies and realistic User-Agent for BML Internet Banking
   */
  private getHeaders(extraCookies?: string): Record<string, string> {
    const cookies: string[] = [];
    this.cookieJar.forEach((val, key) => {
      cookies.push(`${key}=${val}`);
    });
    if (extraCookies) {
      cookies.push(extraCookies);
    }

    return {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Connection': 'keep-alive',
      ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
    };
  }

  /**
   * Captures Set-Cookie headers from BML responses into the in-memory cookie jar
   */
  private saveCookies(response: Response) {
    const rawSetCookie = response.headers.get('set-cookie');
    if (!rawSetCookie) return;

    // Split cookies by comma if multiple cookies are returned
    const cookieParts = rawSetCookie.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    for (const part of cookieParts) {
      const [pair] = part.trim().split(';');
      if (pair && pair.includes('=')) {
        const [name, ...val] = pair.split('=');
        if (name && val.length > 0) {
          this.cookieJar.set(name.trim(), val.join('=').trim());
        }
      }
    }
  }

  /**
   * Initiate authentic login request to Bank of Maldives.
   * If BML asks for OTP, transitions to OTP_REQUIRED state with challengeId.
   */
  public async startLogin(
    username: string,
    password?: string
  ): Promise<{
    status: 'AUTHENTICATED' | 'OTP_REQUIRED' | 'FAILED';
    challenge?: BmlAuthChallenge;
    session?: BmlSessionInfo;
    error?: string;
  }> {
    if (!username || username.trim() === '') {
      return { status: 'FAILED', error: 'BML username is required.' };
    }

    if (!password) {
      // Prompt user for their BML password if not supplied yet
      const challengeId = 'bml_pwd_' + Math.random().toString(36).substring(2, 10);
      this.currentChallenge = { challengeId, username };
      return {
        status: 'OTP_REQUIRED',
        challenge: {
          challengeId,
          step: 'PASSWORD',
          message: 'Please provide your Bank of Maldives account password to proceed.',
        },
      };
    }

    try {
      // Pre-flight to fetch CSRF / session cookies if needed
      try {
        const preflight = await fetch(`${this.baseUrl}profile`, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        this.saveCookies(preflight);
      } catch (err) {
        // Continue if profile is not accessible prior to auth
      }

      // POST to BML Login endpoint
      const response = await fetch(`${this.baseUrl}login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      this.saveCookies(response);

      const contentType = response.headers.get('content-type') || '';
      let data: BmlApiResponse | null = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const textResp = await response.text();
        if (textResp.includes('Attention Required') || textResp.includes('Cloudflare') || response.status === 403) {
          return {
            status: 'FAILED',
            error: 'Bank of Maldives security challenge (Cloudflare verification required). Please ensure your network IP is authorized or access your BML Portal directly to clear interactive verification.',
          };
        }
        return {
          status: 'FAILED',
          error: `BML Portal returned HTTP ${response.status} (${response.statusText}).`,
        };
      }

      // Check if BML returned OTP required
      if (
        data?.message?.toLowerCase().includes('otp') ||
        data?.message?.toLowerCase().includes('verification') ||
        data?.payload?.otp_required ||
        data?.payload?.step === 'OTP'
      ) {
        const challengeId = 'bml_otp_' + Math.random().toString(36).substring(2, 10);
        this.currentChallenge = {
          challengeId,
          username: username.trim(),
          token: data?.payload?.token || data?.payload?.challenge_token,
        };

        return {
          status: 'OTP_REQUIRED',
          challenge: {
            challengeId,
            step: 'OTP',
            message: data.message || 'BML Two-Factor Authentication required. An OTP has been sent to your registered mobile device.',
            otpDeliveryMethod: data.payload?.delivery_method || 'BML Mobile App & Registered SMS',
          },
        };
      }

      // Check if login succeeded directly
      if (response.ok && (data?.message === 'Success' || data?.payload?.dashboard || data?.payload?.user)) {
        return this.createAuthorizedSession(username.trim());
      }

      // Handle standard login errors
      const failureReason = data?.message || data?.error || `BML login failed with status ${response.status}`;
      return {
        status: 'FAILED',
        error: failureReason,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: `Unable to reach Bank of Maldives server: ${err.message || 'Network connection failed'}`,
      };
    }
  }

  /**
   * Submit One-Time Password to Bank of Maldives
   */
  public async submitOtp(
    challengeId: string,
    otp: string
  ): Promise<{
    status: 'AUTHENTICATED' | 'FAILED';
    session?: BmlSessionInfo;
    error?: string;
  }> {
    if (!this.currentChallenge || this.currentChallenge.challengeId !== challengeId) {
      return {
        status: 'FAILED',
        error: 'Authentication challenge expired or invalid. Please reconnect.',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}verify-otp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          otp: otp.trim(),
          token: this.currentChallenge.token,
          username: this.currentChallenge.username,
        }),
      });

      this.saveCookies(response);

      const contentType = response.headers.get('content-type') || '';
      let data: BmlApiResponse | null = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      }

      if (response.ok && (data?.message === 'Success' || response.status === 200)) {
        const username = this.currentChallenge.username;
        this.currentChallenge = null;
        return this.createAuthorizedSession(username);
      }

      return {
        status: 'FAILED',
        error: data?.message || data?.error || 'Invalid or expired OTP entered.',
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        error: `BML OTP verification failed: ${err.message}`,
      };
    }
  }

  private createAuthorizedSession(username: string): {
    status: 'AUTHENTICATED';
    session: BmlSessionInfo;
  } {
    const sessionToken = 'live_bml_token_' + Math.random().toString(36).substring(2, 14);
    const session: BmlSessionInfo = {
      sessionToken,
      authenticatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTtlSeconds * 1000).toISOString(),
      userIdMasked: username.length > 4 ? username.slice(0, 2) + '••••' + username.slice(-2) : '••••',
    };

    const serializedCookies = Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    this.authenticatedSessions.set(sessionToken, {
      session,
      cookies: serializedCookies,
      username,
    });

    return {
      status: 'AUTHENTICATED',
      session,
    };
  }

  /**
   * Validate if current BML session cookie is still accepted by the bank
   */
  public async validateSession(session: BmlSessionInfo): Promise<boolean> {
    if (!session.sessionToken || !this.authenticatedSessions.has(session.sessionToken)) {
      return false;
    }

    // Check expiration timestamp
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.authenticatedSessions.delete(session.sessionToken);
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}profile`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        return false;
      }

      return response.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetch connected restaurant accounts from BML Dashboard
   */
  public async fetchAccounts(session: BmlSessionInfo): Promise<BmlAccount[]> {
    try {
      const response = await fetch(`${this.baseUrl}dashboard`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      this.saveCookies(response);

      if (!response.ok) {
        throw new Error(`BML dashboard returned status ${response.status}`);
      }

      const data: BmlApiResponse<{ dashboard?: BmlDashboardItem[] }> = await response.json();
      const rawAccounts = data?.payload?.dashboard || [];

      return rawAccounts.map((item: BmlDashboardItem, index: number) => {
        const rawAccountNum = item.account || `BML-${index}`;
        const masked = rawAccountNum.length > 4
          ? `•••• ${rawAccountNum.slice(-4)}`
          : `•••• ${rawAccountNum}`;

        const rawCurrency = (item.currency || (item.product_group?.includes('USD') ? 'USD' : 'MVR')).toUpperCase();
        const currency: 'MVR' | 'USD' = rawCurrency === 'USD' ? 'USD' : 'MVR';
        const balance = typeof item.available_balance === 'number'
          ? item.available_balance
          : parseFloat(String(item.available_balance || item.ledger_balance || '0').replace(/[^0-9.-]/g, '')) || 0;

        return {
          id: `acc_bml_${rawAccountNum}`,
          bank: 'BML',
          displayName: item.account_name || `${currency} Operational Account (${rawAccountNum})`,
          maskedAccountNumber: masked,
          currency,
          status: 'CONNECTED',
          balance,
          lastSuccessfulSync: new Date().toISOString(),
          lastTransactionCheck: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (err: any) {
      console.error('[RealBmlAdapter] Failed to fetch accounts from BML:', err.message);
      throw err;
    }
  }

  /**
   * Fetch statement transactions for the account
   */
  public async fetchTransactions(
    session: BmlSessionInfo,
    accountId: string,
    options?: { page?: number; limit?: number; since?: string }
  ): Promise<{
    transactions: RawBmlTransaction[];
    hasMore: boolean;
    nextPage?: number;
  }> {
    try {
      // Clean account ID if prefixed
      const cleanId = accountId.replace(/^acc_bml_/, '');

      // Query today's history or recent statements
      const url = `${this.baseUrl}account/${cleanId}/history/today`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      this.saveCookies(response);

      if (!response.ok) {
        throw new Error(`BML history query returned HTTP ${response.status}`);
      }

      const data: BmlApiResponse<{ history?: BmlHistoryItem[] }> = await response.json();
      const rawHistory = data?.payload?.history || [];

      const transactions: RawBmlTransaction[] = rawHistory.map((item: BmlHistoryItem, idx: number) => {
        const isCredit = item.minus !== true;
        const rawAmount = typeof item.amount === 'number'
          ? item.amount
          : parseFloat(String(item.amount || '0').replace(/[^0-9.-]/g, '')) || 0;

        // Build combined narration for parser
        const narratives = [item.narrative1, item.narrative2, item.narrative3, item.narrative4]
          .filter(Boolean)
          .join(' ');

        // Determine sender
        let sender: string | null = null;
        if (isCredit) {
          sender = item.sender || item.narrative3 || item.narrative2 || null;
        }

        const dateStr = item.date || item.booking_date || item.value_date || new Date().toISOString();

        const rawTxCurrency = (item.currency || 'MVR').toUpperCase();
        const txCurrency: 'MVR' | 'USD' = rawTxCurrency === 'USD' ? 'USD' : 'MVR';

        return {
          transactionId: item.id || `TX-${cleanId}-${idx}-${Date.now()}`,
          accountId,
          amount: Math.abs(rawAmount),
          currency: txCurrency,
          direction: isCredit ? 'CREDIT' : 'DEBIT',
          type: item.minus ? 'DEBIT' : 'BANK_TRANSFER',
          sender,
          description: narratives || item.reference || 'Bank of Maldives Transfer',
          reference: item.reference || item.id || null,
          transactionDate: dateStr,
        };
      });

      return {
        transactions,
        hasMore: false,
      };
    } catch (err: any) {
      console.error('[RealBmlAdapter] Failed to fetch transactions from BML:', err.message);
      throw err;
    }
  }

  /**
   * Graceful logout from Bank of Maldives
   */
  public async logout(session: BmlSessionInfo): Promise<void> {
    try {
      if (session.sessionToken) {
        this.authenticatedSessions.delete(session.sessionToken);
      }

      await fetch(`${this.baseUrl}logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      this.cookieJar.clear();
      this.currentChallenge = null;
    }
  }
}
