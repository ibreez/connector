import {
  BmlAccount,
  BmlTransaction,
  ConnectionState,
  RawBmlTransaction,
  SyncResult,
} from '../types/bml';
import { classifyBmlTransaction } from '../core/classifier';
import { generateTransactionFingerprint } from '../core/fingerprint';
import { ConnectionRateLimiter } from '../core/rateLimiter';
import { IBmlAdapter, BmlSessionInfo } from './bmlAdapterInterface';
import { MockBmlAdapter } from './mockBmlAdapter';

export type TransactionListener = (tx: BmlTransaction) => void;
export type StateListener = (state: ConnectionState) => void;

export class BmlTransactionConnector {
  private adapter: IBmlAdapter;
  private currentSession: BmlSessionInfo | null = null;
  private accounts: BmlAccount[] = [];
  private rateLimiter: ConnectionRateLimiter;
  private knownFingerprints: Set<string> = new Set();
  private storedTransactions: Map<string, BmlTransaction> = new Map();

  private pollingTimer: any = null;
  private isPollingActive: boolean = false;
  private pollingIntervalSeconds: number = 60;
  private isSyncingNow: boolean = false;

  private stateListeners: Set<StateListener> = new Set();
  private transactionListeners: Set<TransactionListener> = new Set();

  private currentState: ConnectionState = {
    status: 'DISCONNECTED',
    sessionActive: false,
    pollingIntervalSeconds: 60,
    isPolling: false,
    requiresOtp: false,
    lastError: null,
  };

  constructor(adapter?: IBmlAdapter, initialIntervalSeconds: number = 60) {
    this.adapter = adapter || new MockBmlAdapter();
    this.pollingIntervalSeconds = initialIntervalSeconds;
    this.rateLimiter = new ConnectionRateLimiter(initialIntervalSeconds);
  }

  public getAdapter(): IBmlAdapter {
    return this.adapter;
  }

  public setAdapter(adapter: IBmlAdapter) {
    this.adapter = adapter;
  }

  public getState(): ConnectionState {
    return { ...this.currentState };
  }

  public getAccounts(): BmlAccount[] {
    return [...this.accounts];
  }

  public getTransactions(): BmlTransaction[] {
    return Array.from(this.storedTransactions.values()).sort(
      (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );
  }

  public getIncomingTransfers(): BmlTransaction[] {
    return this.getTransactions().filter((t) => t.isIncomingTransfer);
  }

  public subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public subscribeTransactions(listener: TransactionListener): () => void {
    this.transactionListeners.add(listener);
    return () => this.transactionListeners.delete(listener);
  }

  private updateState(partial: Partial<ConnectionState>) {
    this.currentState = { ...this.currentState, ...partial };
    this.stateListeners.forEach((fn) => {
      try {
        fn(this.getState());
      } catch (err) {
        console.error('State listener error', err);
      }
    });
  }

  public setPollingInterval(seconds: number) {
    const safeSeconds = Math.max(10, seconds);
    this.pollingIntervalSeconds = safeSeconds;
    this.rateLimiter.setMinIntervalSeconds(safeSeconds);
    this.updateState({ pollingIntervalSeconds: safeSeconds });

    // Restart timer if active
    if (this.isPollingActive) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * STEP 1: Connect BML Account
   * User provides their BML username and password; authentication is initiated with BML
   */
  public async connect(username: string, password?: string): Promise<{
    status: 'CONNECTED' | 'OTP_REQUIRED' | 'FAILED';
    message: string;
    otpDetails?: { challengeId: string; delivery: string };
  }> {
    try {
      this.updateState({ lastError: null });

      const loginRes = await this.adapter.startLogin(username, password);

      if (loginRes.status === 'OTP_REQUIRED' && loginRes.challenge) {
        this.updateState({
          status: 'DISCONNECTED',
          requiresOtp: true,
          authChallengeId: loginRes.challenge.challengeId,
          otpMethod: loginRes.challenge.otpDeliveryMethod,
        });

        return {
          status: 'OTP_REQUIRED',
          message: loginRes.challenge.message,
          otpDetails: {
            challengeId: loginRes.challenge.challengeId,
            delivery: loginRes.challenge.otpDeliveryMethod || 'SMS / Mobile App',
          },
        };
      }

      if (loginRes.status === 'AUTHENTICATED' && loginRes.session) {
        return await this.finalizeAuthentication(loginRes.session);
      }

      const errorMsg = loginRes.error || 'Authentication rejected by Bank of Maldives.';
      this.updateState({ status: 'ERROR', lastError: errorMsg });
      return { status: 'FAILED', message: errorMsg };
    } catch (err: any) {
      const msg = err.message || 'Connection attempt failed.';
      this.updateState({ status: 'ERROR', lastError: msg });
      return { status: 'FAILED', message: msg };
    }
  }

  /**
   * STEP 2: Submit OTP entered directly by account holder
   */
  public async submitOtp(challengeId: string, otp: string): Promise<{
    status: 'CONNECTED' | 'FAILED';
    message: string;
  }> {
    try {
      const otpRes = await this.adapter.submitOtp(challengeId, otp);

      if (otpRes.status === 'AUTHENTICATED' && otpRes.session) {
        this.updateState({ requiresOtp: false, authChallengeId: undefined });
        return await this.finalizeAuthentication(otpRes.session);
      }

      const err = otpRes.error || 'Invalid OTP code.';
      this.updateState({ lastError: err });
      return { status: 'FAILED', message: err };
    } catch (err: any) {
      const msg = err.message || 'Error submitting OTP to BML.';
      this.updateState({ lastError: msg });
      return { status: 'FAILED', message: msg };
    }
  }

  private async finalizeAuthentication(session: BmlSessionInfo): Promise<{
    status: 'CONNECTED' | 'FAILED';
    message: string;
  }> {
    this.currentSession = session;
    this.rateLimiter.reset();

    // Fetch accounts
    try {
      this.accounts = await this.adapter.fetchAccounts(session);
    } catch (err: any) {
      this.updateState({ status: 'ERROR', lastError: 'Could not fetch accounts: ' + err.message });
      return { status: 'FAILED', message: err.message };
    }

    this.updateState({
      status: 'CONNECTED',
      sessionActive: true,
      sessionExpiresAt: session.expiresAt,
      lastError: null,
      requiresOtp: false,
    });

    // Run initial sync
    await this.syncTransactions();

    // Start background polling
    this.startPolling();

    return { status: 'CONNECTED', message: 'Successfully authenticated with Bank of Maldives.' };
  }

  /**
   * Start periodic background transaction polling
   */
  public startPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this.isPollingActive = true;
    this.updateState({
      isPolling: true,
      nextCheck: new Date(Date.now() + this.pollingIntervalSeconds * 1000).toLocaleTimeString(),
    });

    this.pollingTimer = setInterval(async () => {
      if (this.currentState.status === 'REAUTH_REQUIRED' || !this.currentSession) {
        this.stopPolling();
        return;
      }
      await this.syncTransactions();
    }, this.pollingIntervalSeconds * 1000);
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPollingActive = false;
    this.updateState({ isPolling: false, nextCheck: undefined });
  }

  /**
   * Synchronize transactions across all connected accounts.
   * Enforces rate limiting, deduplication, and immediate REAUTH_REQUIRED on session expiry.
   */
  public async syncTransactions(): Promise<SyncResult> {
    const timestamp = new Date().toISOString();

    if (this.isSyncingNow) {
      return {
        success: false,
        scannedCount: 0,
        newTransfersCount: 0,
        duplicatesSkipped: 0,
        ignoredDebitsOrNonTransfers: 0,
        error: 'Sync already in progress',
        timestamp,
      };
    }

    if (!this.currentSession || this.currentState.status === 'REAUTH_REQUIRED') {
      return {
        success: false,
        scannedCount: 0,
        newTransfersCount: 0,
        duplicatesSkipped: 0,
        ignoredDebitsOrNonTransfers: 0,
        error: 'Authentication required before synchronizing.',
        timestamp,
      };
    }

    // Check rate limiter
    const rateCheck = this.rateLimiter.canExecute();
    if (!rateCheck.allowed) {
      return {
        success: false,
        scannedCount: 0,
        newTransfersCount: 0,
        duplicatesSkipped: 0,
        ignoredDebitsOrNonTransfers: 0,
        error: rateCheck.reason,
        timestamp,
      };
    }

    this.isSyncingNow = true;
    this.updateState({ status: 'SYNCING' });

    let scannedCount = 0;
    let newTransfersCount = 0;
    let duplicatesSkipped = 0;
    let ignoredDebitsOrNonTransfers = 0;

    try {
      // Validate session first
      const isSessionValid = await this.adapter.validateSession(this.currentSession);
      if (!isSessionValid) {
        this.handleSessionExpired('BML session timeout or expired token detected.');
        return {
          success: false,
          scannedCount: 0,
          newTransfersCount: 0,
          duplicatesSkipped: 0,
          ignoredDebitsOrNonTransfers: 0,
          error: 'Session expired. Re-authentication required.',
          timestamp,
        };
      }

      for (const account of this.accounts) {
        const response = await this.adapter.fetchTransactions(this.currentSession, account.id, {
          limit: 20,
        });

        for (const raw of response.transactions) {
          scannedCount++;

          // Check for malformed data
          if (isNaN(raw.amount) || !raw.currency || !raw.direction) {
            ignoredDebitsOrNonTransfers++;
            continue;
          }

          // Deterministic Fingerprint
          const fingerprint = generateTransactionFingerprint(raw);

          // Deduplication Check
          if (this.knownFingerprints.has(fingerprint)) {
            duplicatesSkipped++;
            continue;
          }

          // Mark fingerprint as known
          this.knownFingerprints.add(fingerprint);

          // Classification
          const classificationResult = classifyBmlTransaction(raw);

          const txId = raw.transactionId ? `bml_${raw.transactionId}` : fingerprint;

          const transaction: BmlTransaction = {
            id: txId,
            accountId: account.id,
            accountName: account.displayName,
            bank: 'BML',
            amount: raw.amount,
            currency: raw.currency,
            direction: raw.direction,
            transactionType: raw.type || 'UNKNOWN',
            sender: classificationResult.senderName,
            description: raw.description,
            reference: classificationResult.cleanedReference,
            transactionDate: raw.transactionDate,
            receivedAt: new Date().toISOString(),
            fingerprint,
            isIncomingTransfer: classificationResult.isIncomingTransfer,
            classification: classificationResult.classification,
            classificationReason: classificationResult.reason,
            status: 'NEW',
            claimed: false,
            claimedBy: null,
            claimedAt: null,
            orderId: null,
          };

          this.storedTransactions.set(fingerprint, transaction);

          if (transaction.isIncomingTransfer) {
            newTransfersCount++;
          } else {
            ignoredDebitsOrNonTransfers++;
          }

          // Notify listeners
          this.transactionListeners.forEach((fn) => {
            try {
              fn(transaction);
            } catch (err) {
              console.error('Transaction listener error', err);
            }
          });
        }

        // Update account sync timestamp
        account.lastSuccessfulSync = timestamp;
        account.lastTransactionCheck = timestamp;
      }

      this.rateLimiter.recordSuccess();

      this.updateState({
        status: 'CONNECTED',
        lastSync: new Date().toLocaleTimeString(),
        nextCheck: new Date(Date.now() + this.pollingIntervalSeconds * 1000).toLocaleTimeString(),
        lastError: null,
      });

      return {
        success: true,
        scannedCount,
        newTransfersCount,
        duplicatesSkipped,
        ignoredDebitsOrNonTransfers,
        timestamp,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Error occurred during BML transaction sync';
      const isAuthError =
        errMsg.toLowerCase().includes('401') ||
        errMsg.toLowerCase().includes('session expired') ||
        errMsg.toLowerCase().includes('unauthorized') ||
        errMsg.toLowerCase().includes('re-authentication');

      if (isAuthError) {
        this.handleSessionExpired(errMsg);
      } else {
        const backoffDelay = this.rateLimiter.recordFailure(false);
        this.updateState({
          status: 'ERROR',
          lastError: `${errMsg} (Backing off for ${Math.round(backoffDelay / 1000)}s)`,
        });
      }

      return {
        success: false,
        scannedCount,
        newTransfersCount,
        duplicatesSkipped,
        ignoredDebitsOrNonTransfers,
        error: errMsg,
        timestamp,
      };
    } finally {
      this.isSyncingNow = false;
    }
  }

  /**
   * Session expiration procedure
   * STRICT DIRECTIVE:
   * 1. Stop transaction synchronization
   * 2. Mark connection status as REAUTH_REQUIRED
   * 3. Notify the user
   * 4. DO NOT repeatedly submit password, DO NOT attempt to bypass 2FA/CAPTCHA
   */
  public handleSessionExpired(reason: string) {
    this.stopPolling();
    this.currentSession = null;
    this.rateLimiter.recordFailure(true);

    this.updateState({
      status: 'REAUTH_REQUIRED',
      sessionActive: false,
      lastError: `Session Expired: ${reason}. Please re-authenticate with BML to resume monitoring.`,
    });
  }

  /**
   * Claim payment for an incoming transfer (restaurant table/order reconciliation)
   */
  public claimPayment(fingerprintOrId: string, orderId: string, staffName: string): boolean {
    let targetTx: BmlTransaction | undefined;

    for (const tx of this.storedTransactions.values()) {
      if (tx.fingerprint === fingerprintOrId || tx.id === fingerprintOrId) {
        targetTx = tx;
        break;
      }
    }

    if (!targetTx) return false;

    targetTx.claimed = true;
    targetTx.status = 'CLAIMED';
    targetTx.claimedBy = staffName;
    targetTx.claimedAt = new Date().toISOString();
    targetTx.orderId = orderId;

    // Trigger state listener update
    this.updateState({});
    return true;
  }

  /**
   * Manual disconnect
   */
  public async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.currentSession) {
      try {
        await this.adapter.logout(this.currentSession);
      } catch {
        // Safe silence on logout
      }
    }
    this.currentSession = null;
    this.rateLimiter.reset();
    this.updateState({
      status: 'DISCONNECTED',
      sessionActive: false,
      lastError: null,
      requiresOtp: false,
      nextCheck: undefined,
    });
  }

  /**
   * Prepopulate known transactions (e.g. hydrated from Firestore on app load)
   */
  public hydrateTransactions(transactions: BmlTransaction[]) {
    transactions.forEach((tx) => {
      this.knownFingerprints.add(tx.fingerprint);
      this.storedTransactions.set(tx.fingerprint, tx);
    });
  }
}
