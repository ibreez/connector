import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ConnectionStatusCard } from './components/ConnectionStatusCard';
import { AccountsList } from './components/AccountsList';
import { IncomingTransfersFeed } from './components/IncomingTransfersFeed';
import { TransactionHistoryTable } from './components/TransactionHistoryTable';
import { AuthModal } from './components/AuthModal';
import { ClaimPaymentModal } from './components/ClaimPaymentModal';
import { TestBenchModal } from './components/TestBenchModal';
import { SecurityNotice } from './components/SecurityNotice';

import { BmlTransactionConnector } from './connector/bmlConnector';
import { MockBmlAdapter } from './connector/mockBmlAdapter';
import { FirebaseSyncService } from './firebase/syncService';
import { BmlAccount, BmlTransaction, ConnectionState } from './types/bml';

// Create connector instance
const mockAdapter = new MockBmlAdapter();
const connector = new BmlTransactionConnector(mockAdapter, 60);

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(connector.getState());
  const [accounts, setAccounts] = useState<BmlAccount[]>(connector.getAccounts());
  const [transactions, setTransactions] = useState<BmlTransaction[]>(connector.getTransactions());
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'ALL'>('ALL');

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTestBenchOpen, setIsTestBenchOpen] = useState(false);
  const [selectedTxForClaim, setSelectedTxForClaim] = useState<BmlTransaction | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'warn' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'warn' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync state and transactions
  useEffect(() => {
    const unsubState = connector.subscribeState((newState) => {
      setConnectionState(newState);
      setAccounts(connector.getAccounts());
    });

    const unsubTx = connector.subscribeTransactions((newTx) => {
      setTransactions(connector.getTransactions());
      // Save to Firebase Firestore
      FirebaseSyncService.ingestTransaction(newTx);
      if (newTx.isIncomingTransfer) {
        showNotification(
          `New transfer received: ${newTx.currency} ${newTx.amount.toFixed(2)} from ${newTx.sender || 'Customer'}`,
          'success'
        );
      }
    });

    // Auto-connect initial mock session for ready preview demonstration
    const autoInit = async () => {
      // Connect demo owner account
      await connector.connect('restaurant_maldives_owner');
      // Ingest accounts into Firestore
      const accList = connector.getAccounts();
      for (const acc of accList) {
        await FirebaseSyncService.saveAccount(acc);
      }
      // Ingest initial transactions into Firestore
      const initialTxList = connector.getTransactions();
      for (const tx of initialTxList) {
        await FirebaseSyncService.ingestTransaction(tx);
      }
    };
    autoInit();

    // Subscribe to Firestore real-time updates as durable layer
    const unsubFirestore = FirebaseSyncService.subscribeTransactions((firestoreTxs) => {
      if (firestoreTxs.length > 0) {
        connector.hydrateTransactions(firestoreTxs);
        setTransactions(connector.getTransactions());
      }
    });

    return () => {
      unsubState();
      unsubTx();
      unsubFirestore();
      connector.stopPolling();
    };
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await connector.syncTransactions();
      if (result.success) {
        showNotification(
          `Sync complete: Scanned ${result.scannedCount} statements, found ${result.newTransfersCount} new transfers, ${result.duplicatesSkipped} duplicates skipped.`,
          'info'
        );
      } else {
        showNotification(result.error || 'Sync could not be completed.', 'warn');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = async (username: string, password?: string) => {
    const res = await connector.connect(username, password);
    if (res.status === 'CONNECTED') {
      showNotification('Successfully authenticated with Bank of Maldives.', 'success');
      // Save accounts to Firestore
      for (const acc of connector.getAccounts()) {
        await FirebaseSyncService.saveAccount(acc);
      }
    }
    return res;
  };

  const handleSubmitOtp = async (challengeId: string, otp: string) => {
    const res = await connector.submitOtp(challengeId, otp);
    if (res.status === 'CONNECTED') {
      showNotification('BML session established successfully.', 'success');
      for (const acc of connector.getAccounts()) {
        await FirebaseSyncService.saveAccount(acc);
      }
    }
    return res;
  };

  const handleDisconnect = async () => {
    await connector.disconnect();
    showNotification('Disconnected BML session.', 'info');
  };

  const handleIntervalChange = (seconds: number) => {
    connector.setPollingInterval(seconds);
    showNotification(`Polling interval updated to ${seconds} seconds.`, 'info');
  };

  const handleConfirmClaim = async (fingerprint: string, orderId: string, staffName: string) => {
    // Claim locally
    connector.claimPayment(fingerprint, orderId, staffName);
    // Claim in Firestore
    await FirebaseSyncService.claimTransaction(fingerprint, orderId, staffName);
    setTransactions(connector.getTransactions());
    showNotification(`Payment claimed for Order #${orderId} by ${staffName}`, 'success');
  };

  // Simulation helpers for the user / reviewer
  const handleInjectTestTransfer = () => {
    const randomAmount = (Math.floor(Math.random() * 80) + 10) * 10;
    const names = ['HUSSAIN MOOSA', 'FATIMATH ZAHRA', 'MOHAMED SHIFAZ', 'ALI NAZEER', 'MARIYAM LEEZA'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const slipRef = Math.floor(100000 + Math.random() * 900000).toString();

    mockAdapter.addTransaction('acc_bml_mvr_77300001234', {
      transactionId: 'BML_LIVE_' + Date.now().toString().slice(-5),
      accountId: 'acc_bml_mvr_77300001234',
      amount: randomAmount,
      currency: 'MVR',
      direction: 'CREDIT',
      type: 'BANK_TRANSFER',
      sender: randomName,
      description: `TRF FROM ${randomName} MOBILE BML SLIP #${slipRef}`,
      reference: slipRef,
      transactionDate: new Date().toLocaleTimeString(),
    });

    handleSyncNow();
  };

  const handleSimulateSessionExpiry = () => {
    connector.handleSessionExpired('BML 15-minute inactivity security policy');
    showNotification('Simulated BML session expiration. Status is now REAUTH_REQUIRED.', 'warn');
  };

  const visibleTransactions = selectedAccountId === 'ALL'
    ? transactions
    : transactions.filter((t) => t.accountId === selectedAccountId);

  const incomingTransfers = visibleTransactions.filter((t) => t.isIncomingTransfer);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      <Header
        connectionState={connectionState}
        onOpenConnectModal={() => setIsAuthModalOpen(true)}
        onOpenTestBench={() => setIsTestBenchOpen(true)}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border ${
              notification.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : notification.type === 'warn'
                ? 'bg-amber-800 text-white border-amber-700'
                : 'bg-stone-900 text-white border-stone-800'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Top Row: Connection Status Card */}
        <ConnectionStatusCard
          state={connectionState}
          onSyncNow={handleSyncNow}
          onReconnect={() => setIsAuthModalOpen(true)}
          onDisconnect={handleDisconnect}
          onIntervalChange={handleIntervalChange}
          isSyncing={isSyncing}
          newTransfersCount={incomingTransfers.filter((t) => !t.claimed).length}
        />

        {/* Second Row: Accounts Overview */}
        <AccountsList
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />

        {/* Primary Row: Incoming Transfers (Cashier & Staff Focus) */}
        <IncomingTransfersFeed
          transfers={incomingTransfers}
          onClaimTransfer={(tx) => setSelectedTxForClaim(tx)}
        />

        {/* Third Row: Full Transaction Statement History with Filters */}
        <TransactionHistoryTable
          transactions={visibleTransactions}
          onClaimTransfer={(tx) => setSelectedTxForClaim(tx)}
        />

        {/* Fourth Row: Private Architecture & Zero-Secret Security Notice */}
        <SecurityNotice />
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500">
        <p>
          Private Internal BML Transaction Monitoring &bull; Restaurant Operations Maldives &bull;{' '}
          Strictly Read-Only
        </p>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onConnect={handleConnect}
        onSubmitOtp={handleSubmitOtp}
        isReauth={connectionState.status === 'REAUTH_REQUIRED'}
      />

      <ClaimPaymentModal
        transaction={selectedTxForClaim}
        onClose={() => setSelectedTxForClaim(null)}
        onConfirmClaim={handleConfirmClaim}
      />

      <TestBenchModal
        isOpen={isTestBenchOpen}
        onClose={() => setIsTestBenchOpen(false)}
        onInjectTestTransfer={handleInjectTestTransfer}
        onSimulateSessionExpiry={handleSimulateSessionExpiry}
      />
    </div>
  );
}
