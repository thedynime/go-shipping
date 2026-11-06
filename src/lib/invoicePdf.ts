import { jsPDF } from 'jspdf';

export interface SettlementBankInfo {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  routingNumber: string;
  swiftCode: string;
  currency: string;
  binNumber: string;
  taxNote: string;
  country: 'BD' | 'MY' | 'GLOBAL';
}

export const SETTLEMENT_BANKS: SettlementBankInfo[] = [
  {
    id: 'scb-bd',
    bankName: 'Standard Chartered Bank Bangladesh',
    accountName: 'GoShipping Logistics Bangladesh Ltd.',
    accountNumber: '01-1184920-01',
    branch: 'Gulshan North Avenue Branch, Dhaka',
    routingNumber: '195260124',
    swiftCode: 'SCBLBDDX',
    currency: 'BDT / USD',
    binNumber: '004819273-0101',
    taxNote: 'Mushak 6.3 Tax Compliant',
    country: 'BD'
  },
  {
    id: 'city-bd',
    bankName: 'The City Bank PLC',
    accountName: 'GoShipping Logistics Bangladesh Ltd.',
    accountNumber: '1102938475001',
    branch: 'Corporate Banking Branch, Gulshan-2, Dhaka',
    routingNumber: '225261890',
    swiftCode: 'CIBLBDDH',
    currency: 'BDT',
    binNumber: '004819273-0101',
    taxNote: 'Mushak 6.3 Tax Compliant',
    country: 'BD'
  },
  {
    id: 'brac-bd',
    bankName: 'BRAC Bank PLC',
    accountName: 'GoShipping Logistics BD Ltd.',
    accountNumber: '1501203948576001',
    branch: 'Gulshan Corporate Branch, Dhaka',
    routingNumber: '060261234',
    swiftCode: 'BRAKBDDH',
    currency: 'BDT',
    binNumber: '004819273-0101',
    taxNote: 'Mushak 6.3 Tax Compliant',
    country: 'BD'
  },
  {
    id: 'dbbl-bd',
    bankName: 'Dutch-Bangla Bank PLC',
    accountName: 'GoShipping Logistics Bangladesh Ltd.',
    accountNumber: '107.120.345678',
    branch: 'Foreign Exchange Branch, Motijheel, Dhaka',
    routingNumber: '090272345',
    swiftCode: 'DBBLBDDH',
    currency: 'BDT',
    binNumber: '004819273-0101',
    taxNote: 'Mushak 6.3 Tax Compliant',
    country: 'BD'
  },
  {
    id: 'maybank-my',
    bankName: 'Malayan Banking Berhad (Maybank)',
    accountName: 'GoShipping Freight Solutions Sdn. Bhd.',
    accountNumber: '5140-1234-5678',
    branch: 'Menara Maybank, Kuala Lumpur Main Branch',
    routingNumber: 'MBBEMYKL',
    swiftCode: 'MBBEMYKL',
    currency: 'MYR / USD',
    binNumber: 'W10-1808-32000123',
    taxNote: 'Royal Malaysian Customs SST Compliant',
    country: 'MY'
  },
  {
    id: 'cimb-my',
    bankName: 'CIMB Bank Berhad',
    accountName: 'GoShipping Freight Solutions Sdn. Bhd.',
    accountNumber: '800-987-6543',
    branch: 'Menara CIMB, KL Sentral, Kuala Lumpur',
    routingNumber: 'CIBBMYKL',
    swiftCode: 'CIBBMYKL',
    currency: 'MYR / USD',
    binNumber: 'W10-1808-32000123',
    taxNote: 'Royal Malaysian Customs SST Compliant',
    country: 'MY'
  },
  {
    id: 'custom',
    bankName: 'Custom Settlement Bank',
    accountName: 'GoShipping Logistics Ltd.',
    accountNumber: 'Enter Account Number',
    branch: 'Corporate Branch',
    routingNumber: 'Enter Routing',
    swiftCode: 'Enter SWIFT',
    currency: 'BDT',
    binNumber: '004819273-0101',
    taxNote: 'Commercial Tax Invoice Compliant',
    country: 'GLOBAL'
  }
];

export interface InvoiceRecordData {
  id?: string;
  invoiceNumber: string;
  customerName: string;
  destination?: string;
  origin?: string;
  recipient?: string;
  trackingNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'pending' | string;
  mode: string;
  weightKg: number | string;
  baseFreight: number;
  terminalHandling: number;
  customsDuty: number;
  fuelSurcharge: number;
  vatTax: number;
  totalBDT: number;
  totalUSD: number;
  paymentMethod?: string;
  items?: Array<{
    description: string;
    itemCode?: string;
    arrivedQuantity?: number;
    weightKg?: number;
    amountBDT?: number;
  }>;
  notes?: string;
}

/**
 * Generates an executive, print-perfect Commercial Tax Invoice PDF using jsPDF
 * and triggers direct browser download without opening any print window.
 */
export function downloadInvoicePDF(invoice: InvoiceRecordData, bank: SettlementBankInfo): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Colors
  const brandRed = [234, 29, 44] as const;
  const darkMidnight = [17, 24, 30] as const;
  const textDark = [30, 41, 59] as const;
  const textMuted = [100, 116, 139] as const;
  const borderLight = [226, 232, 240] as const;
  const bgLight = [248, 250, 252] as const;

  // Sanitize ASCII for standard PDF Helvetica font
  const safeString = (str: string | undefined, fallback: string = '') => {
    if (!str) return fallback;
    return str.replace(/→/g, '->').replace(/[^\x20-\x7E]/g, ' ');
  };

  const customerName = safeString(invoice.customerName, 'Registered Importer');
  const destination = safeString(invoice.destination, 'Dhaka, Bangladesh');
  const recipient = safeString(invoice.recipient, customerName);
  const origin = safeString(invoice.origin, 'Guangzhou / Yiwu CFS, China');
  const paymentMethod = safeString(invoice.paymentMethod, 'Wire Transfer / Electronic EFT');

  // 1. Top Brand Accent Stripe
  doc.setFillColor(...brandRed);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // 2. Header: Company Brand & Document Title
  // Left: Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...brandRed);
  doc.text('GOSHIPPING LOGISTICS', margin, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text('International Freight Forwarding · Customs Brokerage · Express Air & Sea Cargo', margin, 22);
  doc.text('Web: goshipping.com.bd  |  Hotline: +880 9613-820820  |  Email: billing@goshipping.com.bd', margin, 26);

  // Right: Document Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...darkMidnight);
  doc.text('COMMERCIAL TAX INVOICE', pageWidth - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...brandRed);
  doc.text(safeString(invoice.invoiceNumber, 'INV-2026-0001'), pageWidth - margin, 21.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.text(`Issue Date: ${invoice.issueDate}  |  Due Date: ${invoice.dueDate}`, pageWidth - margin, 26.5, { align: 'right' });

  // Divider
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.4);
  doc.line(margin, 30, pageWidth - margin, 30);

  // 3. Importer & Shipment Information Card (Two Columns)
  const cardY = 34;
  const cardHeight = 35;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'FD');

  // Column 1: Billed To (Importer)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('BILLED TO (IMPORTER / CLIENT):', margin + 4, cardY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...darkMidnight);
  doc.text(customerName, margin + 4, cardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.text(`Destination: ${destination}`, margin + 4, cardY + 17);
  doc.text(`Consignee / Recipient: ${recipient}`, margin + 4, cardY + 22);
  doc.text(`Origin Facility: ${origin}`, margin + 4, cardY + 27);
  doc.text(`Payment Terms: ${paymentMethod}`, margin + 4, cardY + 32);

  // Column 2: Shipment Reference & Status
  const col2X = margin + 98;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('CONSIGNMENT SPECIFICATIONS & STATUS:', col2X, cardY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brandRed);
  doc.text(`Tracking No: ${safeString(invoice.trackingNumber)}`, col2X, cardY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.text(`Transport Mode: ${String(invoice.mode || 'air').toUpperCase()} EXPRESS DOOR-TO-DOOR`, col2X, cardY + 17);
  doc.text(`Chargeable Weight: ${invoice.weightKg} KG`, col2X, cardY + 22);
  doc.text(`Compliance Standard: National Board of Revenue Mushak 6.3`, col2X, cardY + 27);

  // Status Badge Pill inside card
  const isPaid = invoice.status === 'paid';
  if (isPaid) {
    doc.setFillColor(220, 252, 231); // emerald-100
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(col2X, cardY + 29, 36, 4.5, 1, 1, 'FD');
    doc.setFillColor(22, 101, 52); // emerald-800
    doc.circle(col2X + 3.5, cardY + 31.25, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text('PAID & CLEARED', col2X + 6, cardY + 32.5);
  } else {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(col2X, cardY + 29, 38, 4.5, 1, 1, 'FD');
    doc.setFillColor(180, 83, 9); // amber-700
    doc.circle(col2X + 3.5, cardY + 31.25, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text('PAYMENT PENDING', col2X + 6, cardY + 32.5);
  }

  // 4. Line Items Table
  const tableStartY = 74;
  const tableHeaderHeight = 7.5;
  const rowHeight = 7.5;

  // Table Header Background
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, tableStartY, contentWidth, tableHeaderHeight, 'F');
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.rect(margin, tableStartY, contentWidth, tableHeaderHeight, 'S');

  // Header Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('LINE ITEM & SERVICE DESCRIPTION', margin + 4, tableStartY + 5);
  doc.text('ASSESSMENT BASIS', margin + 105, tableStartY + 5);
  doc.text('AMOUNT (BDT)', pageWidth - margin - 4, tableStartY + 5, { align: 'right' });

  // Rows definition
  const lineItems = [
    {
      name: `International Freight Charges (${String(invoice.mode || 'air').toUpperCase()} Express DDP)`,
      desc: 'Door-to-door international linehaul carriage from origin CFS to destination port',
      basis: `${invoice.weightKg} KG Chargeable`,
      amount: invoice.baseFreight,
    },
    {
      name: 'Terminal Handling Charges (THC)',
      desc: 'Airport / CFS container de-stuffing, ground handling and apron cargo transfer fee',
      basis: 'Standard CFS Tariff',
      amount: invoice.terminalHandling,
    },
    {
      name: 'Customs Clearance & Brokerage Levy',
      desc: 'Official customs brokerage, HS code tariff classification and import manifest clearance',
      basis: 'Declared Entry Assessment',
      amount: invoice.customsDuty,
    },
    {
      name: 'Fuel & Security Surcharge',
      desc: 'Aviation/maritime carrier bunker adjustment factor (BAF) and airport security levy',
      basis: 'Standard Index Factor',
      amount: invoice.fuelSurcharge,
    },
    {
      name: 'Statutory Value Added Tax (VAT 15%)',
      desc: 'Statutory government tax assessment pursuant to Bangladesh VAT Act 2012',
      basis: '15.0% Standard Rate',
      amount: invoice.vatTax,
    },
  ];

  let currentY = tableStartY + tableHeaderHeight;

  lineItems.forEach((item, index) => {
    // Alternating background
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, currentY, contentWidth, rowHeight + 2, 'F');
    }

    doc.setDrawColor(...borderLight);
    doc.line(margin, currentY + rowHeight + 2, pageWidth - margin, currentY + rowHeight + 2);

    // Title & description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkMidnight);
    doc.text(item.name, margin + 4, currentY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text(item.desc, margin + 4, currentY + 7.5);

    // Basis
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(item.basis, margin + 105, currentY + 5.5);

    // Amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkMidnight);
    doc.text(`BDT ${item.amount.toLocaleString()}`, pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

    currentY += rowHeight + 2;
  });

  // Total Summary Box
  const totalBoxY = currentY + 3;
  const totalBoxHeight = 14;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, totalBoxY, contentWidth, totalBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkMidnight);
  doc.text('TOTAL AMOUNT DUE:', margin + 6, totalBoxY + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...brandRed);
  doc.text(`BDT ${invoice.totalBDT.toLocaleString()}`, pageWidth - margin - 6, totalBoxY + 6.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(`Equivalent: ~USD $${invoice.totalUSD.toLocaleString()} (Statutory Exchange Basis)`, pageWidth - margin - 6, totalBoxY + 11, { align: 'right' });

  // 5. Dynamic Settlement Bank & Wire Instructions Card
  const bankBoxY = totalBoxY + totalBoxHeight + 5;
  const bankBoxHeight = 36;

  doc.setFillColor(...bgLight);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, bankBoxY, contentWidth, bankBoxHeight, 2, 2, 'FD');

  // Header line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text('OFFICIAL SETTLEMENT BANK & WIRE REMITTANCE INSTRUCTIONS', margin + 4, bankBoxY + 5.5);

  // Bank details left column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkMidnight);
  doc.text(bank.bankName, margin + 4, bankBoxY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text(`Beneficiary Account Name: ${bank.accountName}`, margin + 4, bankBoxY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Account Number: ${bank.accountNumber}`, margin + 4, bankBoxY + 21.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Routing Number: ${bank.routingNumber}   |   SWIFT / BIC Code: ${bank.swiftCode}`, margin + 4, bankBoxY + 26.5);
  doc.text(`Branch Location: ${bank.branch}`, margin + 4, bankBoxY + 31.5);

  // Bank details right column (BIN & Tax Compliance)
  const bankRightX = pageWidth - margin - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkMidnight);
  doc.text(`BIN / Tax Registration: ${bank.binNumber}`, bankRightX, bankBoxY + 11.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(bank.taxNote, bankRightX, bankBoxY + 16.5, { align: 'right' });
  doc.text(`Accepted Currencies: ${bank.currency}`, bankRightX, bankBoxY + 21.5, { align: 'right' });
  doc.text('EFT / RTGS / Swift Wire transfers supported', bankRightX, bankBoxY + 26.5, { align: 'right' });

  // 6. Remittance Notes & Legal Terms
  const termsY = bankBoxY + bankBoxHeight + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('TERMS OF BILLING & REMITTANCE COMPLIANCE:', margin, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`1. Please specify Invoice Number [${invoice.invoiceNumber}] and Tracking Code [${invoice.trackingNumber}] in your bank wire narration.`, margin, termsY + 4.5);
  doc.text('2. Payments are strictly due on or before customs release at the designated terminal unless covered by pre-approved commercial credit.', margin, termsY + 8.5);
  doc.text('3. This document is an authentic electronic commercial tax invoice generated by GoShipping Enterprise ERP and requires no physical seal.', margin, termsY + 12.5);

  // 7. Signature & Stamp Blocks
  const sigY = termsY + 18;

  // Importer Acknowledgement
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY + 10, margin + 60, sigY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('Importer Authorized Receiver / Signature', margin, sigY + 14);

  // GoShipping Authorized Signatory & Digital Seal
  const authX = pageWidth - margin - 65;
  doc.line(authX, sigY + 10, pageWidth - margin, sigY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkMidnight);
  doc.text('GoShipping Logistics Bangladesh Ltd.', authX, sigY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text('Authorized Signatory — Treasury & Billing Desk', authX, sigY + 17.5);

  // 8. Footer
  const footerY = 286;
  doc.setDrawColor(...borderLight);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('GoShipping Logistics Platform · Generated by Enterprise Billing Cloud · Page 1 of 1', pageWidth / 2, footerY + 4, { align: 'center' });

  // 9. Trigger Direct PDF Download
  const cleanInvoiceId = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`GoShipping_Invoice_${cleanInvoiceId}.pdf`);
}
