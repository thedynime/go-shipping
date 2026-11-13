import type { PosLedgerRecord } from './posLedger.service';

const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbx5tQavZn3PMkb0Ds-OqQoh2ykjL1Z0d3LyMx5ZRB4LJW0NzevuYOgSAx7rufm6sC0o/exec';

export function getGoogleSheetWebhookUrl(): string {
  return process.env.GOOGLE_SHEET_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
}

export interface GoogleSheetSyncResult {
  success: boolean;
  orderId?: string;
  action?: string;
  error?: string;
}

/**
 * Helper to escape strings so Google Sheets does not treat phone numbers
 * or plus/equals signs as formulas (which causes #ERROR! in Google Sheets).
 */
function escapeForSheet(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith("'")) return str;
  // If string starts with +, =, -, @, or is a phone number, prepend single quote
  if (str.startsWith('+') || str.startsWith('=') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format phone numbers specifically with a leading apostrophe so Google Sheets
 * keeps the plus sign and leading zeroes without formula evaluation errors.
 */
function formatPhoneForSheet(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.startsWith("'")) return clean;
  return `'${clean}`;
}

/**
 * Format a PosLedgerRecord into the complete 30-column payload matching
 * the official GoShipping Google Spreadsheet (All-in-One tab).
 */
function formatRecordForSheet(record: PosLedgerRecord) {
  return {
    orderId: record.orderId || '',
    orderDate: record.orderDate || '',
    cnDate: record.cnDate || '',
    bdDate: record.bdDate || '',
    customerName: record.customerName || '',
    mobileNo: formatPhoneForSheet(record.mobileNo),
    importerClient: record.importerClient || '',
    shippingMark: record.shippingMark || '',
    websiteOrderNo: record.websiteOrderNo || '',
    itemDetails: record.itemDetails || '',
    chinaCourierTracking: record.chinaCourierTracking || '',
    currentStatus: record.currentStatus || 'Processing',
    supplierName: record.supplierName || 'Taobao',
    quantity: Number(record.quantity || 1),
    unitPriceRmb: Number(record.unitPriceRmb || 0),
    totalPurchaseRmb: Number(record.totalPurchaseRmb || 0),
    rmbRateBdt: Number(record.rmbRateBdt || 19.5),
    purchaseCostBdt: Number(record.purchaseCostBdt || 0),
    purchaseCostPaidBdt: Number(record.purchaseCostPaidBdt || 0),
    purchaseCostDueBdt: Number(record.purchaseCostDueBdt || 0),
    serviceType: record.serviceType || 'Sourcing & Shipping',
    cnWeightKg: Number(record.cnWeightKg || 0),
    bdWeightKg: Number(record.bdWeightKg || 0),
    shippingRatePerKgBdt: Number(record.shippingRatePerKgBdt || 850),
    internationalFreightBdt: Number(record.internationalFreightBdt || 0),
    totalBillBdt: Number(record.totalBillBdt || 0),
    paymentStatus: record.paymentStatus || 'Due',
    bdCourierName: record.bdCourierName || '',
    bdTrackingNo: record.bdTrackingNo || '',
    remark: record.remark || '',
    profitEstimateBdt: Number(record.profitEstimateBdt || 0)
  };
}

export async function setupGoogleSheetHeaders(): Promise<GoogleSheetSyncResult> {
  const webhookUrl = getGoogleSheetWebhookUrl();
  if (!webhookUrl) {
    return { success: false, error: 'Google Sheet webhook URL not configured' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'setup_headers' }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script returned HTTP ${response.status}`);
    }

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: true, raw: text };
    }

    return {
      success: data.success !== false,
      action: 'setup_headers'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to trigger header setup'
    };
  }
}

/**
 * Push a single order row to the Google Sheet webhook.
 * Executes asynchronously with safe error handling and 1 retry.
 */
export async function syncOrderToGoogleSheet(
  record: PosLedgerRecord
): Promise<GoogleSheetSyncResult> {
  const webhookUrl = getGoogleSheetWebhookUrl();
  if (!webhookUrl) {
    return { success: false, error: 'Google Sheet webhook URL not configured' };
  }

  const payload = formatRecordForSheet(record);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script returned HTTP ${response.status}`);
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: true, raw: text };
      }

      return {
        success: data.success !== false,
        orderId: record.orderId,
        action: data.action || 'synced'
      };
    } catch (err: any) {
      if (attempt === 2) {
        console.error(`[GoogleSheetSync] Error syncing order ${record.orderId}:`, err.message);
        return {
          success: false,
          orderId: record.orderId,
          error: err.message || 'Unknown webhook sync error'
        };
      }
      // Wait 1 second before retry
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { success: false, orderId: record.orderId, error: 'Sync failed after retries' };
}

/**
 * Batch sync an array of order records to the Google Sheet sequentially.
 */
export async function batchSyncOrdersToGoogleSheet(
  records: PosLedgerRecord[]
): Promise<{ total: number; successful: number; failed: number; errors: string[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      const result = await syncOrderToGoogleSheet(record);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.error) errors.push(`${record.orderId}: ${result.error}`);
      }
      // Modest delay between batch pushes to prevent rate-limiting Google Apps Script
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      failed++;
      errors.push(`${record.orderId}: ${err.message}`);
    }
  }

  return {
    total: records.length,
    successful,
    failed,
    errors
  };
}
