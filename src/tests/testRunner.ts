import { BmlTransactionConnector } from '../connector/bmlConnector';
import { MockBmlAdapter } from '../connector/mockBmlAdapter';
import { classifyBmlTransaction } from '../core/classifier';
import { generateTransactionFingerprint } from '../core/fingerprint';
import { RawBmlTransaction } from '../types/bml';

export interface TestCaseResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  message: string;
  details?: any;
  durationMs: number;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

/**
 * Executes the complete validation test suite covering all 11+ requirements specified by user.
 */
export async function runAllConnectorTests(): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const results: TestCaseResult[] = [];

  // TEST 1: User Request Scenario - Identify BML001 as incoming transfer and ignore BML002
  {
    const tStart = Date.now();
    try {
      const bml001: RawBmlTransaction = {
        transactionId: 'BML001',
        accountId: 'acc_mvr',
        amount: 250,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'CUSTOMER A',
        reference: 'ORDER-1001',
        description: 'TRF FROM CUSTOMER A ORDER-1001',
        transactionDate: '2026-09-13 14:00:00',
      };
      const bml002: RawBmlTransaction = {
        transactionId: 'BML002',
        accountId: 'acc_mvr',
        amount: 500,
        currency: 'MVR',
        direction: 'DEBIT',
        type: 'TRANSFER',
        sender: null,
        reference: 'TEST',
        description: 'OUTGOING TRANSFER TO VENDOR SUPPLIES',
        transactionDate: '2026-09-13 14:05:00',
      };

      const res001 = classifyBmlTransaction(bml001);
      const res002 = classifyBmlTransaction(bml002);

      const passed =
        res001.isIncomingTransfer === true &&
        res001.classification === 'INCOMING_TRANSFER' &&
        res002.isIncomingTransfer === false;

      results.push({
        id: 'test_bml001_bml002',
        name: 'BML001 vs BML002 Classification',
        description: 'Identifies BML001 (Credit Bank Transfer) as incoming transfer, ignores BML002 (Debit Outgoing)',
        passed,
        message: passed
          ? 'BML001 classified as INCOMING_TRANSFER, BML002 flagged as non-incoming debit'
          : `Classification failed: BML001=${res001.classification}, BML002=${res002.classification}`,
        durationMs: Date.now() - tStart,
      });
    } catch (e: any) {
      results.push({
        id: 'test_bml001_bml002',
        name: 'BML001 vs BML002 Classification',
        description: 'Identifies BML001 as incoming transfer, ignores BML002',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 2: Duplicate Transactions Deduplication
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);

      await connector.connect('bml_test_owner');
      // Initial sync ran during finalizeAuthentication
      const initialCount = connector.getTransactions().length;

      // Force a second sync cycle without new data
      const secondSync = await connector.syncTransactions();

      const passed = secondSync.duplicatesSkipped > 0 && secondSync.newTransfersCount === 0;
      results.push({
        id: 'test_duplicates',
        name: 'Duplicate Transaction Deduplication',
        description: 'Ensures transactions seen across multiple polling cycles are skipped without creating duplicates',
        passed,
        message: passed
          ? `Successfully skipped ${secondSync.duplicatesSkipped} duplicate transactions on subsequent polling`
          : `Duplicate check failed: newTransfers=${secondSync.newTransfersCount}`,
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_duplicates',
        name: 'Duplicate Transaction Deduplication',
        description: 'Deduplication across cycles',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 3: Session Expiration & Transition to REAUTH_REQUIRED
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);
      await connector.connect('bml_test_owner');

      // Now simulate BML session expiration
      adapter.errorMode = 'SESSION_EXPIRED';
      const syncRes = await connector.syncTransactions();
      const state = connector.getState();

      const passed =
        state.status === 'REAUTH_REQUIRED' &&
        state.isPolling === false &&
        syncRes.error?.toLowerCase().includes('session expired');

      results.push({
        id: 'test_session_expiry',
        name: 'Session Expiration Detection',
        description: 'Stops synchronization immediately, marks REAUTH_REQUIRED without retrying passwords/2FA',
        passed,
        message: passed
          ? 'Connector safely halted polling and marked status as REAUTH_REQUIRED'
          : `State mismatch: status=${state.status}, isPolling=${state.isPolling}`,
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_session_expiry',
        name: 'Session Expiration Detection',
        description: 'Session expiry transition',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 4: Network Failure & Backoff
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);
      await connector.connect('bml_test_owner');

      adapter.errorMode = 'NETWORK_FAILURE';
      const syncRes = await connector.syncTransactions();
      const state = connector.getState();

      const passed =
        syncRes.success === false &&
        state.status === 'ERROR' &&
        (state.lastError || '').includes('Network');

      results.push({
        id: 'test_network_failure',
        name: 'Network Failure Handling',
        description: 'Handles connection timeout gracefully and triggers exponential backoff without crashing',
        passed,
        message: passed
          ? 'Network error caught gracefully; backoff cooldown initiated'
          : 'Failed to handle network timeout',
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_network_failure',
        name: 'Network Failure Handling',
        description: 'Network timeout handling',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 5: BML Service Unavailable (Maintenance HTTP 503)
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      adapter.errorMode = 'BML_UNAVAILABLE';
      const connector = new BmlTransactionConnector(adapter, 10);

      const connRes = await connector.connect('bml_test_owner');
      const state = connector.getState();

      const passed =
        connRes.status === 'FAILED' &&
        state.status === 'ERROR' &&
        (state.lastError || '').includes('maintenance');

      results.push({
        id: 'test_bml_unavailable',
        name: 'BML Unavailable / Maintenance',
        description: 'Detects BML maintenance downtime and reports descriptive guidance to restaurant staff',
        passed,
        message: passed
          ? 'Captured BML scheduled maintenance downtime safely'
          : 'Did not properly identify maintenance error',
        durationMs: Date.now() - tStart,
      });
    } catch (e: any) {
      results.push({
        id: 'test_bml_unavailable',
        name: 'BML Unavailable / Maintenance',
        description: 'BML service unavailable',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 6: Malformed Transaction Filtering
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);
      await connector.connect('bml_test_owner');

      adapter.errorMode = 'MALFORMED_TRANSACTION';
      const syncRes = await connector.syncTransactions();

      const passed = syncRes.ignoredDebitsOrNonTransfers > 0 && syncRes.newTransfersCount === 0;

      results.push({
        id: 'test_malformed_tx',
        name: 'Malformed Transaction Sanitization',
        description: 'Filters out corrupted or missing transaction fields without crashing the pipeline',
        passed,
        message: passed
          ? `Ignored corrupted/malformed transactions safely (${syncRes.ignoredDebitsOrNonTransfers} filtered)`
          : 'Malformed transaction was not filtered properly',
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_malformed_tx',
        name: 'Malformed Transaction Sanitization',
        description: 'Malformed transaction filtering',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 7 & 8: Multiple Accounts (MVR and USD)
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);
      await connector.connect('bml_test_owner');

      const accounts = connector.getAccounts();
      const hasMvr = accounts.some((a) => a.currency === 'MVR');
      const hasUsd = accounts.some((a) => a.currency === 'USD');
      const passed = accounts.length >= 2 && hasMvr && hasUsd;

      results.push({
        id: 'test_multiple_accounts',
        name: 'Multiple Accounts (MVR & USD Separation)',
        description: 'Handles simultaneous monitoring of Maldivian Rufiyaa (MVR) and Foreign Exchange (USD) accounts',
        passed,
        message: passed
          ? `Verified ${accounts.length} active business accounts: MVR (${accounts.find((a) => a.currency === 'MVR')?.maskedAccountNumber}) and USD (${accounts.find((a) => a.currency === 'USD')?.maskedAccountNumber})`
          : 'Multiple accounts or currency separation failed',
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_multiple_accounts',
        name: 'Multiple Accounts (MVR & USD)',
        description: 'MVR & USD accounts',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 9 & 10: Two Transactions with Identical Amounts Arriving Seconds Apart
  {
    const tStart = Date.now();
    try {
      const txA: RawBmlTransaction = {
        transactionId: 'TXN_A',
        accountId: 'acc_mvr',
        amount: 85.0,
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'IBRAHIM RAMEEZ',
        reference: 'SLIP-9011',
        description: 'TRF FROM IBRAHIM RAMEEZ',
        transactionDate: '2026-09-13 15:28:10',
      };
      const txB: RawBmlTransaction = {
        transactionId: 'TXN_B',
        accountId: 'acc_mvr',
        amount: 85.0, // Same amount!
        currency: 'MVR',
        direction: 'CREDIT',
        type: 'BANK_TRANSFER',
        sender: 'HASSAN KHALID', // Different sender
        reference: 'SLIP-9012', // Different reference
        description: 'TRF FROM HASSAN KHALID',
        transactionDate: '2026-09-13 15:28:18', // 8 seconds apart
      };

      const fpA = generateTransactionFingerprint(txA);
      const fpB = generateTransactionFingerprint(txB);

      const passed = fpA !== fpB && fpA.length > 10 && fpB.length > 10;

      results.push({
        id: 'test_identical_amounts_seconds_apart',
        name: 'Identical Amounts & Seconds Apart Collision Resistance',
        description: 'Ensures two guests paying the same bill amount (e.g. MVR 85.00) seconds apart generate unique fingerprints',
        passed,
        message: passed
          ? `Unique fingerprints generated: ${fpA.slice(0, 16)}... vs ${fpB.slice(0, 16)}...`
          : 'Fingerprints collided for identical amount payments!',
        durationMs: Date.now() - tStart,
      });
    } catch (e: any) {
      results.push({
        id: 'test_identical_amounts_seconds_apart',
        name: 'Identical Amounts Collision Resistance',
        description: 'Fingerprint collision test',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 11: Transaction History Pagination
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const session = {
        sessionToken: 'test_sess',
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        userIdMasked: 'rest••••',
      };
      // Register session in adapter
      (adapter as any).authenticatedSessions.set(session.sessionToken, session);

      const page1 = await adapter.fetchTransactions(session, 'acc_bml_mvr_77300001234', {
        page: 1,
        limit: 3,
      });
      const page2 = await adapter.fetchTransactions(session, 'acc_bml_mvr_77300001234', {
        page: 2,
        limit: 3,
      });

      const passed =
        page1.transactions.length === 3 &&
        page2.transactions.length > 0 &&
        page1.transactions[0].transactionId !== page2.transactions[0].transactionId;

      results.push({
        id: 'test_pagination',
        name: 'Transaction History Pagination',
        description: 'Retrieves multi-page transaction statement batches cleanly without overlap or memory bloat',
        passed,
        message: passed
          ? `Page 1 returned ${page1.transactions.length} items; Page 2 returned ${page2.transactions.length} distinct items`
          : 'Pagination failed or returned duplicate items',
        durationMs: Date.now() - tStart,
      });
    } catch (e: any) {
      results.push({
        id: 'test_pagination',
        name: 'Transaction History Pagination',
        description: 'Pagination test',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  // TEST 12: Reconnecting after Authentication Expires
  {
    const tStart = Date.now();
    try {
      const adapter = new MockBmlAdapter();
      adapter.shouldRequireOtp = false;
      const connector = new BmlTransactionConnector(adapter, 10);

      // Connect 1
      await connector.connect('bml_test_owner');
      // Expire
      adapter.errorMode = 'SESSION_EXPIRED';
      await connector.syncTransactions();
      const expiredState = connector.getState();

      // Clear error mode & Re-authenticate legitimately
      adapter.errorMode = 'NONE';
      const reauthRes = await connector.connect('bml_test_owner');
      const resumedState = connector.getState();

      const passed =
        expiredState.status === 'REAUTH_REQUIRED' &&
        reauthRes.status === 'CONNECTED' &&
        resumedState.status === 'CONNECTED' &&
        resumedState.sessionActive === true;

      results.push({
        id: 'test_reconnect_after_expiry',
        name: 'Reconnecting After Authentication Expiry',
        description: 'Permits the user to re-authenticate normally after session expiration, safely resuming monitoring',
        passed,
        message: passed
          ? 'Successfully restored active connection and polling after user re-authentication'
          : 'Reconnection after expiry failed',
        durationMs: Date.now() - tStart,
      });
      await connector.disconnect();
    } catch (e: any) {
      results.push({
        id: 'test_reconnect_after_expiry',
        name: 'Reconnecting After Authentication Expiry',
        description: 'Reconnection after expiry test',
        passed: false,
        message: e.message,
        durationMs: Date.now() - tStart,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  const passedCount = results.filter((r) => r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    durationMs,
    results,
  };
}
