import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db/client';
import { posLedger } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export interface PosLedgerRecord {
  id: string;
  orderId: string;
  orderDate: string;
  cnDate: string;
  bdDate: string;
  customerName: string;
  mobileNo: string;
  importerClient: string;
  shippingMark: string;
  websiteOrderNo: string;
  itemDetails: string;
  chinaCourierTracking: string;
  currentStatus: string;
  supplierName: string;
  quantity: number;
  unitPriceRmb: number;
  totalPurchaseRmb: number;
  rmbRateBdt: number;
  purchaseCostBdt: number;
  purchaseCostPaidBdt: number;
  purchaseCostDueBdt: number;
  serviceType: string;
  cnWeightKg: number;
  bdWeightKg: number;
  shippingRatePerKgBdt: number;
  internationalFreightBdt: number;
  totalBillBdt: number;
  paymentStatus: 'Due' | 'Paid' | 'Partial';
  bdCourierName?: string;
  bdTrackingNo?: string;
  remark?: string;
  profitEstimateBdt: number;
  createdAt: string;
  updatedAt: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.pos_ledger_store.json');

declare global {
  var __goshipping_pos_ledger: PosLedgerRecord[] | undefined;
}

export function autoCalculatePosFields(input: Partial<PosLedgerRecord>): {
  totalPurchaseRmb: number;
  purchaseCostBdt: number;
  purchaseCostDueBdt: number;
  internationalFreightBdt: number;
  totalBillBdt: number;
  paymentStatus: 'Due' | 'Paid' | 'Partial';
  profitEstimateBdt: number;
} {
  const qty = Number(input.quantity) || 0;
  const unitRmb = Number(input.unitPriceRmb) || 0;
  const totalRmb = Math.round(qty * unitRmb * 100) / 100;

  const rmbRate = Number(input.rmbRateBdt) || 19.5;
  const purchaseCostBdt = Math.round(totalRmb * rmbRate * 100) / 100;

  const paidBdt = Number(input.purchaseCostPaidBdt) || 0;
  const purchaseDueBdt = Math.max(0, Math.round((purchaseCostBdt - paidBdt) * 100) / 100);

  const bdWeight = Number(input.bdWeightKg) || Number(input.cnWeightKg) || 0;
  const shippingRate = Number(input.shippingRatePerKgBdt) || 0;
  const intlFreightBdt = Math.round(bdWeight * shippingRate * 100) / 100;

  const totalBillBdt = Math.round((purchaseCostBdt + intlFreightBdt) * 100) / 100;

  let paymentStatus: 'Due' | 'Paid' | 'Partial' = 'Due';
  if (paidBdt >= totalBillBdt && totalBillBdt > 0) {
    paymentStatus = 'Paid';
  } else if (paidBdt > 0) {
    paymentStatus = 'Partial';
  } else {
    paymentStatus = 'Due';
  }

  // Estimated profit: freight margin + sourcing commission (~5%)
  const profitEstimateBdt = Math.round(((intlFreightBdt * 0.15) + (purchaseCostBdt * 0.05)) * 100) / 100;

  return {
    totalPurchaseRmb: totalRmb,
    purchaseCostBdt,
    purchaseCostDueBdt: purchaseDueBdt,
    internationalFreightBdt: intlFreightBdt,
    totalBillBdt,
    paymentStatus,
    profitEstimateBdt
  };
}

function getInitialRecords(): PosLedgerRecord[] {
  const today = new Date().toISOString().split('T')[0];
  const items: Array<Omit<PosLedgerRecord, 'id' | 'totalPurchaseRmb' | 'purchaseCostBdt' | 'purchaseCostDueBdt' | 'internationalFreightBdt' | 'totalBillBdt' | 'paymentStatus' | 'profitEstimateBdt' | 'createdAt' | 'updatedAt'>> = [
    {
      orderId: 'POS-2026-001',
      orderDate: today,
      cnDate: today,
      bdDate: '',
      customerName: 'Sourov Ahmed',
      mobileNo: '+880 1711 234567',
      importerClient: 'HTI',
      shippingMark: 'HTI-BD-01',
      websiteOrderNo: 'WEB-8849',
      itemDetails: 'Women Silk Scarf Accessories (Taobao Order)',
      chinaCourierTracking: 'SF14092847192',
      currentStatus: 'Received in CN Hub',
      supplierName: 'Taobao',
      quantity: 3,
      unitPriceRmb: 4.0,
      rmbRateBdt: 19.5,
      purchaseCostPaidBdt: 0,
      serviceType: 'Sourcing Only',
      cnWeightKg: 0.8,
      bdWeightKg: 0.8,
      shippingRatePerKgBdt: 850,
      bdCourierName: 'Steadfast',
      bdTrackingNo: '',
      remark: 'Initial sample from spreadsheet'
    },
    {
      orderId: 'POS-2026-002',
      orderDate: today,
      cnDate: today,
      bdDate: '',
      customerName: 'Mahmudul Hasan (GadgetXpress)',
      mobileNo: '+880 1819 887766',
      importerClient: 'GX-BD',
      shippingMark: 'GX-DAC-402',
      websiteOrderNo: 'WEB-9012',
      itemDetails: 'TWS Wireless Earbuds + Smart Watch Bands',
      chinaCourierTracking: 'ZTO9823471829',
      currentStatus: 'In Transit DAC Flight',
      supplierName: '1688 Factory',
      quantity: 50,
      unitPriceRmb: 28.5,
      rmbRateBdt: 19.8,
      purchaseCostPaidBdt: 15000,
      serviceType: 'Air Cargo',
      cnWeightKg: 12.5,
      bdWeightKg: 12.5,
      shippingRatePerKgBdt: 950,
      bdCourierName: 'Pathao Courier',
      bdTrackingNo: 'PT-993847',
      remark: 'Urgent restocking air shipment'
    },
    {
      orderId: 'POS-2026-003',
      orderDate: today,
      cnDate: today,
      bdDate: '',
      customerName: 'Tanvir Rahman (Apex Apparels)',
      mobileNo: '+880 1712 998811',
      importerClient: 'APX',
      shippingMark: 'APX-CTG-09',
      websiteOrderNo: 'WEB-7731',
      itemDetails: 'Garments Zipper Rolls & Metal Buttons',
      chinaCourierTracking: 'SF7729104812',
      currentStatus: 'Customs Clearance DAC',
      supplierName: 'Alibaba Verified',
      quantity: 120,
      unitPriceRmb: 15.0,
      rmbRateBdt: 19.5,
      purchaseCostPaidBdt: 35100,
      serviceType: 'Door-to-Door',
      cnWeightKg: 35.0,
      bdWeightKg: 35.0,
      shippingRatePerKgBdt: 750,
      bdCourierName: 'In-house Trucking',
      bdTrackingNo: 'GOSH-TRK-88',
      remark: 'Commercial customs clearance included'
    }
  ];

  return items.map((item, idx) => {
    const calc = autoCalculatePosFields(item);
    return {
      ...item,
      ...calc,
      id: `pos-${idx + 1}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

function loadFromFile(): PosLedgerRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[PosLedgerService] Failed to load store:', err);
  }
  return getInitialRecords();
}

function saveToFile(data: PosLedgerRecord[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PosLedgerService] Failed to save store:', err);
  }
}

let memoryLedger: PosLedgerRecord[] = globalThis.__goshipping_pos_ledger || loadFromFile();
globalThis.__goshipping_pos_ledger = memoryLedger;

export class PosLedgerService {
  /**
   * List records with optional filtering
   */
  static async listRecords(filters?: {
    search?: string;
    serviceType?: string;
    paymentStatus?: string;
    supplier?: string;
  }): Promise<PosLedgerRecord[]> {
    let list = [...memoryLedger];

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter((r) =>
        r.orderId.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.mobileNo.includes(q) ||
        r.importerClient.toLowerCase().includes(q) ||
        r.shippingMark.toLowerCase().includes(q) ||
        r.itemDetails.toLowerCase().includes(q) ||
        r.chinaCourierTracking.toLowerCase().includes(q) ||
        (r.bdTrackingNo && r.bdTrackingNo.toLowerCase().includes(q))
      );
    }

    if (filters?.serviceType && filters.serviceType !== 'all') {
      list = list.filter((r) => r.serviceType.toLowerCase() === filters.serviceType?.toLowerCase());
    }

    if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
      list = list.filter((r) => r.paymentStatus.toLowerCase() === filters.paymentStatus?.toLowerCase());
    }

    if (filters?.supplier && filters.supplier !== 'all') {
      list = list.filter((r) => r.supplierName.toLowerCase().includes(filters.supplier?.toLowerCase() || ''));
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getById(id: string): Promise<PosLedgerRecord | null> {
    return memoryLedger.find((r) => r.id === id || r.orderId.toUpperCase() === id.toUpperCase()) || null;
  }

  /**
   * Create POS Order Record with Auto Calculations
   */
  static async createRecord(payload: Partial<PosLedgerRecord>): Promise<PosLedgerRecord> {
    const id = `pos-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const orderId = payload.orderId?.trim() || `POS-${new Date().getFullYear()}-${String(memoryLedger.length + 1).padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const calc = autoCalculatePosFields(payload);

    const record: PosLedgerRecord = {
      id,
      orderId,
      orderDate: payload.orderDate || today,
      cnDate: payload.cnDate || today,
      bdDate: payload.bdDate || '',
      customerName: payload.customerName?.trim() || 'Valued Customer',
      mobileNo: payload.mobileNo?.trim() || '',
      importerClient: payload.importerClient?.trim() || '',
      shippingMark: payload.shippingMark?.trim() || '',
      websiteOrderNo: payload.websiteOrderNo?.trim() || '',
      itemDetails: payload.itemDetails?.trim() || 'General Cargo Products',
      chinaCourierTracking: payload.chinaCourierTracking?.trim() || '',
      currentStatus: payload.currentStatus || 'Processing',
      supplierName: payload.supplierName?.trim() || 'Taobao / 1688',
      quantity: Number(payload.quantity) || 1,
      unitPriceRmb: Number(payload.unitPriceRmb) || 0,
      totalPurchaseRmb: calc.totalPurchaseRmb,
      rmbRateBdt: Number(payload.rmbRateBdt) || 19.5,
      purchaseCostBdt: calc.purchaseCostBdt,
      purchaseCostPaidBdt: Number(payload.purchaseCostPaidBdt) || 0,
      purchaseCostDueBdt: calc.purchaseCostDueBdt,
      serviceType: payload.serviceType || 'Sourcing & Shipping',
      cnWeightKg: Number(payload.cnWeightKg) || 0,
      bdWeightKg: Number(payload.bdWeightKg) || 0,
      shippingRatePerKgBdt: Number(payload.shippingRatePerKgBdt) || 0,
      internationalFreightBdt: calc.internationalFreightBdt,
      totalBillBdt: calc.totalBillBdt,
      paymentStatus: calc.paymentStatus,
      bdCourierName: payload.bdCourierName || 'Steadfast',
      bdTrackingNo: payload.bdTrackingNo || '',
      remark: payload.remark || '',
      profitEstimateBdt: calc.profitEstimateBdt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    memoryLedger.unshift(record);
    saveToFile(memoryLedger);

    // Sync to DB if accessible
    try {
      await db.insert(posLedger).values({
        id: record.id,
        orderId: record.orderId,
        orderDate: record.orderDate,
        cnDate: record.cnDate,
        bdDate: record.bdDate,
        customerName: record.customerName,
        mobileNo: record.mobileNo,
        importerClient: record.importerClient,
        shippingMark: record.shippingMark,
        websiteOrderNo: record.websiteOrderNo,
        itemDetails: record.itemDetails,
        chinaCourierTracking: record.chinaCourierTracking,
        currentStatus: record.currentStatus,
        supplierName: record.supplierName,
        quantity: record.quantity,
        unitPriceRmb: String(record.unitPriceRmb),
        totalPurchaseRmb: String(record.totalPurchaseRmb),
        rmbRateBdt: String(record.rmbRateBdt),
        purchaseCostBdt: String(record.purchaseCostBdt),
        purchaseCostPaidBdt: String(record.purchaseCostPaidBdt),
        purchaseCostDueBdt: String(record.purchaseCostDueBdt),
        serviceType: record.serviceType,
        cnWeightKg: String(record.cnWeightKg),
        bdWeightKg: String(record.bdWeightKg),
        shippingRatePerKgBdt: String(record.shippingRatePerKgBdt),
        internationalFreightBdt: String(record.internationalFreightBdt),
        totalBillBdt: String(record.totalBillBdt),
        paymentStatus: record.paymentStatus,
        bdCourierName: record.bdCourierName,
        bdTrackingNo: record.bdTrackingNo,
        remark: record.remark,
        profitEstimateBdt: String(record.profitEstimateBdt)
      });
    } catch {}

    return record;
  }

  /**
   * Update POS Record with Auto Recalculations
   */
  static async updateRecord(id: string, updates: Partial<PosLedgerRecord>): Promise<PosLedgerRecord | null> {
    const idx = memoryLedger.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const existing = memoryLedger[idx];
    const merged = { ...existing, ...updates };
    const calc = autoCalculatePosFields(merged);

    const updated: PosLedgerRecord = {
      ...merged,
      ...calc,
      id: existing.id,
      orderId: updates.orderId ? updates.orderId.trim() : existing.orderId,
      updatedAt: new Date().toISOString()
    };

    memoryLedger[idx] = updated;
    saveToFile(memoryLedger);

    // Sync to DB
    try {
      await db.update(posLedger).set({
        orderId: updated.orderId,
        orderDate: updated.orderDate,
        cnDate: updated.cnDate,
        bdDate: updated.bdDate,
        customerName: updated.customerName,
        mobileNo: updated.mobileNo,
        importerClient: updated.importerClient,
        shippingMark: updated.shippingMark,
        websiteOrderNo: updated.websiteOrderNo,
        itemDetails: updated.itemDetails,
        chinaCourierTracking: updated.chinaCourierTracking,
        currentStatus: updated.currentStatus,
        supplierName: updated.supplierName,
        quantity: updated.quantity,
        unitPriceRmb: String(updated.unitPriceRmb),
        totalPurchaseRmb: String(updated.totalPurchaseRmb),
        rmbRateBdt: String(updated.rmbRateBdt),
        purchaseCostBdt: String(updated.purchaseCostBdt),
        purchaseCostPaidBdt: String(updated.purchaseCostPaidBdt),
        purchaseCostDueBdt: String(updated.purchaseCostDueBdt),
        serviceType: updated.serviceType,
        cnWeightKg: String(updated.cnWeightKg),
        bdWeightKg: String(updated.bdWeightKg),
        shippingRatePerKgBdt: String(updated.shippingRatePerKgBdt),
        internationalFreightBdt: String(updated.internationalFreightBdt),
        totalBillBdt: String(updated.totalBillBdt),
        paymentStatus: updated.paymentStatus,
        bdCourierName: updated.bdCourierName,
        bdTrackingNo: updated.bdTrackingNo,
        remark: updated.remark,
        profitEstimateBdt: String(updated.profitEstimateBdt)
      }).where(eq(posLedger.id, id));
    } catch {}

    return updated;
  }

  /**
   * Delete Record
   */
  static async deleteRecord(id: string): Promise<boolean> {
    const len = memoryLedger.length;
    memoryLedger = memoryLedger.filter((r) => r.id !== id);
    if (memoryLedger.length !== len) {
      saveToFile(memoryLedger);
      try {
        await db.delete(posLedger).where(eq(posLedger.id, id));
      } catch {}
      return true;
    }
    return false;
  }

  /**
   * Compute POS Summary Statistics
   */
  static async getStats() {
    const totalOrders = memoryLedger.length;
    let totalPurchaseRmb = 0;
    let totalPurchaseBdt = 0;
    let totalFreightBdt = 0;
    let totalBilledBdt = 0;
    let totalCollectedBdt = 0;
    let totalDueBdt = 0;
    let totalProfitBdt = 0;
    let totalWeightKg = 0;

    for (const r of memoryLedger) {
      totalPurchaseRmb += Number(r.totalPurchaseRmb) || 0;
      totalPurchaseBdt += Number(r.purchaseCostBdt) || 0;
      totalFreightBdt += Number(r.internationalFreightBdt) || 0;
      totalBilledBdt += Number(r.totalBillBdt) || 0;
      totalCollectedBdt += Number(r.purchaseCostPaidBdt) || 0;
      totalDueBdt += Number(r.purchaseCostDueBdt) || 0;
      totalProfitBdt += Number(r.profitEstimateBdt) || 0;
      totalWeightKg += Number(r.bdWeightKg || r.cnWeightKg) || 0;
    }

    return {
      totalOrders,
      totalPurchaseRmb: Math.round(totalPurchaseRmb * 100) / 100,
      totalPurchaseBdt: Math.round(totalPurchaseBdt),
      totalFreightBdt: Math.round(totalFreightBdt),
      totalBilledBdt: Math.round(totalBilledBdt),
      totalCollectedBdt: Math.round(totalCollectedBdt),
      totalDueBdt: Math.round(totalDueBdt),
      totalProfitBdt: Math.round(totalProfitBdt),
      totalWeightKg: Math.round(totalWeightKg * 10) / 10
    };
  }

  /**
   * Export to 1:1 Google Sheet CSV
   */
  static exportToCsv(): string {
    const headers = [
      'Order ID',
      'Order Date',
      'CN Date',
      'BD Date',
      'Customer Name',
      'Mobile No',
      'Importer / Client',
      'Shipping Mark',
      'Website Order No',
      'Item / Product Details',
      'China Courier Tracking (SF/ZTO)',
      'Current Status',
      'Supplier / Shop Name',
      'Quantity (Pcs)',
      'Unit Price (RMB)',
      'Total Purchase (RMB) [Auto]',
      'RMB Rate (BDT)',
      'Purchase Cost (BDT) [Auto]',
      'Purchase Cost Paid     [ Customer ]',
      'Purchase Cost Due [Auto]',
      'Service Type',
      'CN Weight (KG)',
      'BD Weight (KG)',
      'Shipping Rate / KG (BDT)',
      'International Freight (BDT) [Auto]',
      'Total Bill (BDT) [Auto]',
      'Payment Status [Auto]',
      'BD Courier & Tracking',
      'Remark / Customer Update',
      'Profit Estimate (BDT) [Auto]'
    ];

    const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = memoryLedger.map((r) => [
      escape(r.orderId),
      escape(r.orderDate),
      escape(r.cnDate),
      escape(r.bdDate),
      escape(r.customerName),
      escape(r.mobileNo),
      escape(r.importerClient),
      escape(r.shippingMark),
      escape(r.websiteOrderNo),
      escape(r.itemDetails),
      escape(r.chinaCourierTracking),
      escape(r.currentStatus),
      escape(r.supplierName),
      escape(r.quantity),
      escape(r.unitPriceRmb.toFixed(2)),
      escape(r.totalPurchaseRmb.toFixed(2)),
      escape(r.rmbRateBdt.toFixed(2)),
      escape(r.purchaseCostBdt.toFixed(2)),
      escape(r.purchaseCostPaidBdt.toFixed(2)),
      escape(r.purchaseCostDueBdt.toFixed(2)),
      escape(r.serviceType),
      escape(r.cnWeightKg.toFixed(2)),
      escape(r.bdWeightKg.toFixed(2)),
      escape(r.shippingRatePerKgBdt.toFixed(2)),
      escape(r.internationalFreightBdt.toFixed(2)),
      escape(r.totalBillBdt.toFixed(2)),
      escape(r.paymentStatus),
      escape(r.bdCourierName ? `${r.bdCourierName}: ${r.bdTrackingNo || ''}` : (r.bdTrackingNo || '')),
      escape(r.remark),
      escape(r.profitEstimateBdt.toFixed(2))
    ].join(','));

    return [headers.map(escape).join(','), ...rows].join('\n');
  }

  /**
   * Import from CSV Text
   */
  static async importFromCsv(csvText: string): Promise<{ imported: number; errors: string[] }> {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) return { imported: 0, errors: ['CSV file is empty or missing headers'] };

    let count = 0;
    const errors: string[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        // Parse CSV fields handling quotes
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const matches: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = regex.exec(line)) !== null) {
          let val = m[1] || '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/""/g, '"');
          }
          matches.push(val.trim());
          if (regex.lastIndex >= line.length) break;
        }

        if (matches.length < 5) continue;

        const customerName = matches[4] || matches[0];
        if (!customerName) continue;

        await this.createRecord({
          orderId: matches[0] || undefined,
          orderDate: matches[1] || undefined,
          cnDate: matches[2] || undefined,
          bdDate: matches[3] || undefined,
          customerName,
          mobileNo: matches[5] || '',
          importerClient: matches[6] || '',
          shippingMark: matches[7] || '',
          websiteOrderNo: matches[8] || '',
          itemDetails: matches[9] || 'Imported Goods',
          chinaCourierTracking: matches[10] || '',
          currentStatus: matches[11] || 'Processing',
          supplierName: matches[12] || 'Taobao',
          quantity: Number(matches[13]) || 1,
          unitPriceRmb: Number(matches[14]) || 0,
          rmbRateBdt: Number(matches[16]) || 19.5,
          purchaseCostPaidBdt: Number(matches[18]) || 0,
          serviceType: matches[20] || 'Sourcing & Shipping',
          cnWeightKg: Number(matches[21]) || 0,
          bdWeightKg: Number(matches[22]) || 0,
          shippingRatePerKgBdt: Number(matches[23]) || 0,
          bdTrackingNo: matches[27] || '',
          remark: matches[28] || ''
        });
        count++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return { imported: count, errors };
  }
}
