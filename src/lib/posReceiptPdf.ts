import { jsPDF } from 'jspdf';
import type { PosLedgerRecord } from '../server/services/posLedger.service';

/**
 * Generates and downloads an authentic, high-resolution vector PDF receipt slip
 * directly to the user's computer without opening the browser's print dialog window.
 */
export function downloadPosReceiptPDF(order: PosLedgerRecord): void {
  // Standard 80mm thermal receipt format (80mm width x 215mm height)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 215]
  });

  const pageWidth = 80;
  const margin = 5;
  const contentWidth = pageWidth - margin * 2; // 70mm

  // Colors
  const brandRed = [234, 29, 44] as const;
  const darkMidnight = [17, 24, 30] as const;
  const textDark = [30, 41, 59] as const;
  const textMuted = [100, 116, 139] as const;
  const borderLight = [203, 213, 225] as const;
  const bgLight = [248, 250, 252] as const;

  const safeAscii = (str: string | undefined | null, fallback: string = ''): string => {
    if (!str) return fallback;
    return str
      .replace(/৳/g, 'BDT ')
      .replace(/¥/g, 'RMB ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .trim();
  };

  let y = 0;

  // 1. Top Brand Accent Stripe
  doc.setFillColor(...brandRed);
  doc.rect(0, 0, pageWidth, 3, 'F');
  y = 8;

  // 2. Company Wordmark & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...darkMidnight);
  doc.text('GOSHIPPING EXPRESS', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('China to Bangladesh Sourcing & Logistics Desk', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.text('Hotline: +880 1797-252627  |  www.goshipping.com.bd', pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Dashed Separator
  doc.setDrawColor(...borderLight);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // 3. Receipt Metadata Box
  doc.setFillColor(...bgLight);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...brandRed);
  doc.text(`POS ORDER: ${safeAscii(order.orderId, 'POS-ORD')}`, margin + 2.5, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text(`Date: ${safeAscii(order.orderDate)}`, margin + 2.5, y + 8.5);
  doc.text(`Status: ${safeAscii(order.currentStatus, 'Processing')}`, margin + 2.5, y + 12);

  if (order.shippingMark) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkMidnight);
    doc.text(`MARK: ${safeAscii(order.shippingMark)}`, pageWidth - margin - 2.5, y + 4.5, { align: 'right' });
  }
  y += 18;

  // 4. Customer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('CUSTOMER / IMPORTER', margin, y);
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text(`Name: `, margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(safeAscii(order.customerName, 'General Importer'), margin + 11, y);
  y += 3.5;

  if (order.mobileNo) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(`Phone: `, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.text(safeAscii(order.mobileNo), margin + 11, y);
    y += 3.5;
  }

  // Dashed Separator
  doc.setDrawColor(...borderLight);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // 5. Product & Sourcing Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('SOURCING DETAILS', margin, y);
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  const itemName = safeAscii(order.itemDetails, 'Consolidated Cargo Item');
  const splitItem = doc.splitTextToSize(itemName, contentWidth);
  doc.text(splitItem, margin, y);
  y += (splitItem.length * 3.2);

  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  const supplierStr = `Supplier: ${safeAscii(order.supplierName, '1688/Taobao')}  |  Qty: ${order.quantity} pcs`;
  doc.text(supplierStr, margin, y);
  y += 3.2;

  // Unit and Total RMB
  const rmbStr = `RMB Cost: ${order.quantity} x RMB ${Number(order.unitPriceRmb || 0).toFixed(2)} = RMB ${Number(order.totalPurchaseRmb || 0).toFixed(2)}`;
  doc.text(rmbStr, margin, y);
  y += 3.2;

  // Rate & BDT Purchase Cost
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  doc.text(`Rate: @ ${Number(order.rmbRateBdt || 19.5).toFixed(2)} BDT/RMB`, margin, y);
  doc.text(`Purchase BDT: ${Number(order.purchaseCostBdt || 0).toLocaleString()} BDT`, pageWidth - margin, y, { align: 'right' });
  y += 4.5;

  // Dashed Separator
  doc.setDrawColor(...borderLight);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // 6. International Freight Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('FREIGHT & LOGISTICS', margin, y);
  y += 3.5;

  const grossWeight = Number(order.bdWeightKg || order.cnWeightKg || 0);
  const freightRate = Number(order.shippingRatePerKgBdt || 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text(`Service: ${safeAscii(order.serviceType, 'Air Cargo')}`, margin, y);
  y += 3.2;
  doc.text(`Cargo Weight: ${grossWeight.toFixed(2)} KG @ BDT ${freightRate}/KG`, margin, y);
  y += 3.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...textDark);
  doc.text('Intl Freight Cost:', margin, y);
  doc.text(`${Number(order.internationalFreightBdt || 0).toLocaleString()} BDT`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // 7. Settlement Summary Block (Bold & Highlighted)
  doc.setFillColor(...bgLight);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'S');

  let sY = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.text('TOTAL BILL AMOUNT:', margin + 3, sY);
  doc.text(`${Number(order.totalBillBdt || 0).toLocaleString()} BDT`, pageWidth - margin - 3, sY, { align: 'right' });

  sY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(16, 149, 74); // Emerald Green
  doc.text('PAID / DEPOSIT:', margin + 3, sY);
  doc.text(`${Number(order.purchaseCostPaidBdt || 0).toLocaleString()} BDT`, pageWidth - margin - 3, sY, { align: 'right' });

  sY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...brandRed);
  doc.text('DUE BALANCE:', margin + 3, sY);
  doc.text(`${Number(order.purchaseCostDueBdt || 0).toLocaleString()} BDT`, pageWidth - margin - 3, sY, { align: 'right' });

  sY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  doc.text(`Payment Status: ${safeAscii(order.paymentStatus, 'Partial')}`, margin + 3, sY);
  y += 30;

  // 8. Courier & Delivery Dispatch
  if (order.bdTrackingNo || order.bdCourierName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...darkMidnight);
    doc.text('BANGLADESH COURIER HANDOVER', margin, y);
    y += 3.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textDark);
    doc.text(`Courier: ${safeAscii(order.bdCourierName, 'Steadfast')}`, margin, y);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text(`Tracking ID: ${safeAscii(order.bdTrackingNo, 'Pending Dispatch')}`, margin, y);
    y += 4;
  }

  // 9. Footer Remarks & Barcode representation
  doc.setDrawColor(...borderLight);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  if (order.remark) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(...textMuted);
    const splitRemark = doc.splitTextToSize(`Note: ${safeAscii(order.remark)}`, contentWidth);
    doc.text(splitRemark, margin, y);
    y += (splitRemark.length * 2.8) + 2;
  }

  // Barcode / Serial representation
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...darkMidnight);
  doc.text(`*${safeAscii(order.orderId)}*`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...textMuted);
  doc.text('Official Digital E-Receipt - Generated by GoShipping Logistics', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Thank you for shipping with GoShipping!', pageWidth / 2, y, { align: 'center' });

  // Direct trigger download
  const cleanId = order.orderId ? order.orderId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Receipt';
  doc.save(`GoShipping-Receipt-${cleanId}.pdf`);
}
