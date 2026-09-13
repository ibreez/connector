import { RawBmlTransaction, TransactionClassification } from '../types/bml';

export interface ClassificationResult {
  isIncomingTransfer: boolean;
  classification: TransactionClassification;
  reason: string;
  senderName: string | null;
  cleanedReference: string;
}

/**
 * Classifies a raw BML transaction into specific business categories.
 * Strict rules guarantee non-transfer credits (e.g. POS terminal settlements,
 * cash deposits, interest, reversals) and debits are NEVER misidentified as customer transfers.
 */
export function classifyBmlTransaction(tx: RawBmlTransaction): ClassificationResult {
  const direction = (tx.direction || '').toUpperCase();
  const desc = (tx.description || '').toUpperCase().trim();
  const rawType = (tx.type || '').toUpperCase().trim();
  const ref = (tx.reference || '').trim();

  // 1. DEBITS are never customer incoming transfers
  if (direction === 'DEBIT') {
    if (desc.includes('FEE') || desc.includes('CHG') || desc.includes('ANNUAL') || desc.includes('SMS CHARGE')) {
      return {
        isIncomingTransfer: false,
        classification: 'BANK_FEE',
        reason: 'Bank service or account fee debit',
        senderName: null,
        cleanedReference: ref,
      };
    }
    return {
      isIncomingTransfer: false,
      classification: 'OTHER_DEBIT',
      reason: 'Debit transaction (outgoing payment or expense)',
      senderName: null,
      cleanedReference: ref,
    };
  }

  // 2. Filter out non-transfer CREDITS

  // POS Card Terminal settlements (e.g. BML Android Smart POS end-of-day batch)
  if (
    desc.includes('POS SETTLEMENT') ||
    desc.includes('MERCHANT SETTLEMENT') ||
    desc.includes('MPOS') ||
    desc.includes('POS BATCH') ||
    rawType.includes('SETTLEMENT')
  ) {
    return {
      isIncomingTransfer: false,
      classification: 'POS_MERCHANT_SETTLEMENT',
      reason: 'Card machine / POS merchant batch settlement credit',
      senderName: 'BML POS Settler',
      cleanedReference: ref,
    };
  }

  // Cash Deposits (CDM / Branch)
  if (
    desc.includes('CDM CASH') ||
    desc.includes('CASH DEP') ||
    desc.includes('ATM DEP') ||
    desc.includes('BRANCH DEP') ||
    desc.includes('TELLER DEP') ||
    rawType.includes('CASH_DEPOSIT')
  ) {
    return {
      isIncomingTransfer: false,
      classification: 'CASH_DEPOSIT',
      reason: 'Direct cash deposit at ATM/CDM or Branch teller',
      senderName: 'Direct Cash Deposit',
      cleanedReference: ref,
    };
  }

  // Bank interest or dividend credits
  if (
    desc.includes('INTEREST') ||
    desc.includes('INT PD') ||
    desc.includes('CREDIT INT') ||
    rawType.includes('INTEREST')
  ) {
    return {
      isIncomingTransfer: false,
      classification: 'INTEREST_CREDIT',
      reason: 'Quarterly/Monthly bank interest payment',
      senderName: 'Bank of Maldives',
      cleanedReference: ref,
    };
  }

  // Reversals or chargebacks
  if (
    desc.includes('REVERSAL') ||
    desc.includes('REFUND') ||
    desc.includes('CHARGEBACK') ||
    desc.includes('CORRECTION') ||
    rawType.includes('REVERSAL')
  ) {
    return {
      isIncomingTransfer: false,
      classification: 'REVERSAL_OR_REFUND',
      reason: 'Transaction correction or merchant reversal credit',
      senderName: null,
      cleanedReference: ref,
    };
  }

  // 3. Detect INCOMING BANK TRANSFERS
  // Patterns common in BML statements & Mobile Banking:
  // "TRF FROM <NAME>", "FT FROM <NAME>", "IB TRANSFER <NAME>", "TRANSFER <NAME>", "MB TRANSFER", "P2P"
  const isTransferType =
    rawType === 'BANK_TRANSFER' ||
    rawType === 'TRANSFER' ||
    rawType === 'IB_TRANSFER' ||
    rawType === 'MB_TRANSFER' ||
    rawType === 'INTERBANK_TRANSFER' ||
    rawType.includes('TRANSFER');

  const transferKeywords = [
    'TRF FROM',
    'FT FROM',
    'TRANSFER FROM',
    'IB TRF',
    'MB TRF',
    'BML TRF',
    'BANK TRANSFER',
    'FAVOURING',
    'P2P TRF',
    'PAYMENT FROM',
  ];

  const hasTransferKeyword = transferKeywords.some((kw) => desc.includes(kw));

  // Determine sender extraction
  let extractedSender = tx.sender ? tx.sender.trim() : null;

  if (!extractedSender) {
    // Try to extract from BML narration pattern: "TRF FROM <NAME> <REF>" or "FT FROM <NAME>"
    const match =
      desc.match(/(?:TRF FROM|FT FROM|TRANSFER FROM|IB TRF FROM|PAYMENT FROM)\s+([A-Z\s.]+?)(?:\s+(?:REF|SLIP|ORDER|ACC|VIA|[\d]{5,})|$)/i) ||
      desc.match(/^(?:BANK TRANSFER|TRANSFER|IB TRF|MB TRF)\s+-\s+([A-Z\s.]+)/i);

    if (match && match[1]) {
      extractedSender = match[1].trim();
    }
  }

  // Clean or extract reference number
  let finalRef = ref;
  if (!finalRef) {
    const refMatch = desc.match(/(?:REF|SLIP|TXN|NO|ORDER)[\s:#-]*([A-Z0-9_-]{4,20})/i);
    if (refMatch && refMatch[1]) {
      finalRef = refMatch[1].trim();
    }
  }

  if (isTransferType || hasTransferKeyword || (tx.direction === 'CREDIT' && (extractedSender || ref))) {
    return {
      isIncomingTransfer: true,
      classification: 'INCOMING_TRANSFER',
      reason: 'Verified customer bank transfer (CREDIT with transfer indicators/reference)',
      senderName: extractedSender || (desc ? desc.slice(0, 30) : 'Guest Bank Transfer'),
      cleanedReference: finalRef || 'N/A',
    };
  }

  // Fallback for unidentified credits (e.g. unknown manual ledger adjustment)
  return {
    isIncomingTransfer: false,
    classification: 'OTHER_CREDIT',
    reason: 'Unclassified credit transaction (lacks standard transfer indicators)',
    senderName: extractedSender,
    cleanedReference: finalRef,
  };
}
