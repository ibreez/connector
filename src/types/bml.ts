/**
 * BML Read-Only Transaction Connector Types
 * Strictly read-only models for Bank of Maldives (BML) restaurant transaction monitoring.
 */

export type AccountStatus = 'CONNECTED' | 'REAUTH_REQUIRED' | 'DISCONNECTED' | 'SYNCING' | 'ERROR';

export type TransactionDirection = 'CREDIT' | 'DEBIT';

export type TransactionClassification =
  | 'INCOMING_TRANSFER'     // Valid customer bank transfer to be claimed
  | 'CASH_DEPOSIT'          // ATM/CDM Cash Deposit
  | 'INTEREST_CREDIT'       // Bank interest payment
  | 'REVERSAL_OR_REFUND'    // Card or charge reversal
  | 'OUTGOING_TRANSFER'     // Supplier payment or outgoing transfer
  | 'POS_MERCHANT_SETTLEMENT' // Terminal card batch settlement
  | 'BANK_FEE'              // Maintenance, SMS, or service charges
  | 'OTHER_CREDIT'          // Other credit not matching standard customer transfer
  | 'OTHER_DEBIT';          // Other debit

export interface BmlAccount {
  id: string;
  bank: 'BML';
  displayName: string;
  maskedAccountNumber: string; // e.g. "•••• 1234"
  currency: 'MVR' | 'USD';
  status: AccountStatus;
  balance?: number;
  lastSuccessfulSync?: string; // ISO 8601
  lastTransactionCheck?: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

export interface RawBmlTransaction {
  transactionId?: string; // Provided by BML or extracted from statement
  accountId: string;
  amount: number;
  currency: 'MVR' | 'USD';
  direction: TransactionDirection;
  type?: string;          // e.g. "BANK_TRANSFER", "TRANSFER", "IB TRANSFER", "POS"
  sender?: string | null; // Extracted customer name or null
  description: string;    // Full narration text
  reference?: string;     // Reference or Slip ID (e.g. "ORDER-1001" or "123456")
  transactionDate: string;// Date time string
}

export interface BmlTransaction {
  id: string;                 // Firestore doc ID (or fingerprint)
  accountId: string;
  accountName?: string;
  bank: 'BML';
  amount: number;
  currency: 'MVR' | 'USD';
  direction: TransactionDirection;
  transactionType: string;
  sender: string | null;
  description: string;
  reference: string;
  transactionDate: string;
  receivedAt: string;         // Ingestion timestamp
  fingerprint: string;        // SHA-256 deterministic hash
  isIncomingTransfer: boolean;
  classification: TransactionClassification;
  classificationReason: string;
  status: 'NEW' | 'CLAIMED' | 'ARCHIVED';
  claimed: boolean;
  claimedBy: string | null;
  claimedAt: string | null;
  orderId: string | null;     // Restaurant table / bill number
}

export interface ConnectionState {
  status: AccountStatus;
  sessionActive: boolean;
  sessionExpiresAt?: string;
  lastSync?: string;
  nextCheck?: string;
  lastError?: string | null;
  pollingIntervalSeconds: number;
  isPolling: boolean;
  requiresOtp: boolean;
  otpMethod?: string;
  authChallengeId?: string;
}

export interface SyncResult {
  success: boolean;
  scannedCount: number;
  newTransfersCount: number;
  duplicatesSkipped: number;
  ignoredDebitsOrNonTransfers: number;
  error?: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id?: string;
  event: string;
  details: string;
  timestamp: string;
  staffId?: string;
}
