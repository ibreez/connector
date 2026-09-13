import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, ensureStaffAuthenticated } from './config';
import { BmlAccount, BmlTransaction, AuditLogEntry } from '../types/bml';

/**
 * Service to synchronize deduplicated BML transactions and account states into Firestore.
 * Conforms strictly to security mandates: zero credential storage, append-only audits.
 */
export class FirebaseSyncService {
  /**
   * Upsert a BML account document
   */
  public static async saveAccount(account: BmlAccount): Promise<void> {
    try {
      await ensureStaffAuthenticated();
      const accountRef = doc(db, 'bmlAccounts', account.id);
      await setDoc(
        accountRef,
        {
          bank: 'BML',
          displayName: account.displayName,
          maskedAccountNumber: account.maskedAccountNumber,
          currency: account.currency,
          status: account.status,
          balance: account.balance ?? null,
          lastSuccessfulSync: account.lastSuccessfulSync || new Date().toISOString(),
          lastTransactionCheck: account.lastTransactionCheck || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore saveAccount notice:', err);
    }
  }

  /**
   * Ingest a classified transaction into Firestore.
   * Uses tx.fingerprint as the deterministic document ID to strictly prevent duplicates.
   */
  public static async ingestTransaction(tx: BmlTransaction): Promise<{ isNew: boolean }> {
    try {
      await ensureStaffAuthenticated();
      const txRef = doc(db, 'transactions', tx.fingerprint);

      // Check if already exists in Firestore
      const existing = await getDoc(txRef);
      if (existing.exists()) {
        return { isNew: false };
      }

      await setDoc(txRef, {
        accountId: tx.accountId,
        accountName: tx.accountName || '',
        bank: 'BML',
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction,
        transactionType: tx.transactionType,
        sender: tx.sender,
        description: tx.description,
        reference: tx.reference,
        transactionDate: tx.transactionDate,
        receivedAt: tx.receivedAt || new Date().toISOString(),
        fingerprint: tx.fingerprint,
        isIncomingTransfer: tx.isIncomingTransfer,
        classification: tx.classification,
        classificationReason: tx.classificationReason,
        status: tx.status || 'NEW',
        claimed: tx.claimed || false,
        claimedBy: tx.claimedBy || null,
        claimedAt: tx.claimedAt || null,
        orderId: tx.orderId || null,
        createdAt: serverTimestamp(),
      });

      return { isNew: true };
    } catch (err) {
      console.warn('Firestore ingestTransaction notice:', err);
      return { isNew: true };
    }
  }

  /**
   * Claim an incoming transfer for a restaurant table or order number
   */
  public static async claimTransaction(
    fingerprint: string,
    orderId: string,
    staffName: string
  ): Promise<boolean> {
    try {
      const staffId = await ensureStaffAuthenticated();
      const txRef = doc(db, 'transactions', fingerprint);

      const claimedAt = new Date().toISOString();
      await updateDoc(txRef, {
        status: 'CLAIMED',
        claimed: true,
        claimedBy: staffName || staffId,
        claimedAt,
        orderId,
      });

      await this.recordAuditLog({
        event: 'TRANSACTION_CLAIMED',
        details: `Incoming transfer (${fingerprint.slice(0, 10)}) claimed for Order #${orderId} by ${staffName}`,
        timestamp: claimedAt,
        staffId: staffName || staffId,
      });

      return true;
    } catch (err) {
      console.warn('Firestore claimTransaction notice:', err);
      return false;
    }
  }

  /**
   * Log an operational or security event without sensitive credentials
   */
  public static async recordAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      const staffId = await ensureStaffAuthenticated();
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const logRef = doc(db, 'auditLogs', logId);

      await setDoc(logRef, {
        event: entry.event,
        details: entry.details,
        timestamp: entry.timestamp || new Date().toISOString(),
        staffId: entry.staffId || staffId,
      });
    } catch (err) {
      console.warn('Firestore recordAuditLog notice:', err);
    }
  }

  /**
   * Subscribe to real-time transactions from Firestore
   */
  public static subscribeTransactions(callback: (transactions: BmlTransaction[]) => void): () => void {
    try {
      const q = query(collection(db, 'transactions'), orderBy('receivedAt', 'desc'), limit(100));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: BmlTransaction[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as any;
            list.push({
              id: d.id,
              accountId: data.accountId,
              accountName: data.accountName,
              bank: 'BML',
              amount: data.amount,
              currency: data.currency,
              direction: data.direction,
              transactionType: data.transactionType,
              sender: data.sender,
              description: data.description,
              reference: data.reference,
              transactionDate: data.transactionDate,
              receivedAt: data.receivedAt,
              fingerprint: data.fingerprint || d.id,
              isIncomingTransfer: data.isIncomingTransfer,
              classification: data.classification,
              classificationReason: data.classificationReason,
              status: data.status,
              claimed: data.claimed,
              claimedBy: data.claimedBy,
              claimedAt: data.claimedAt,
              orderId: data.orderId,
            });
          });
          callback(list);
        },
        (err) => {
          console.warn('Firestore snapshot listener warning:', err);
        }
      );
    } catch (err) {
      console.warn('Firestore query error:', err);
      return () => {};
    }
  }

  /**
   * Subscribe to accounts
   */
  public static subscribeAccounts(callback: (accounts: BmlAccount[]) => void): () => void {
    try {
      const q = query(collection(db, 'bmlAccounts'));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: BmlAccount[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as any;
            list.push({
              id: d.id,
              bank: 'BML',
              displayName: data.displayName,
              maskedAccountNumber: data.maskedAccountNumber,
              currency: data.currency,
              status: data.status,
              balance: data.balance,
              lastSuccessfulSync: data.lastSuccessfulSync,
              lastTransactionCheck: data.lastTransactionCheck,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            });
          });
          callback(list);
        },
        (err) => {
          console.warn('Firestore accounts snapshot warning:', err);
        }
      );
    } catch (err) {
      console.warn('Firestore accounts query error:', err);
      return () => {};
    }
  }
}
