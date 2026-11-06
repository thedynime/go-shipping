import { ShipmentService, ShipmentRecord } from './shipment.service';

export interface InvoiceItem {
  itemId: string;
  itemCode?: string;
  description: string;
  packagingType?: string;
  arrivedQuantity: number;
  totalQuantity: number;
  weightKg: number;
  cbm?: number;
  ratePerKg?: number;
  amountBDT: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  shipmentId: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAddress: string;
  origin: string;
  destination: string;
  mode: 'air' | 'sea' | 'road' | 'hand_carry';
  totalWeightKg: number;
  items: InvoiceItem[];
  baseFreight: number;
  terminalHandling: number;
  customsDuty: number;
  fuelSurcharge: number;
  subtotal: number;
  vatTax: number;
  totalBDT: number;
  totalUSD: number;
  status: 'pending' | 'paid';
  issueDate: string;
  dueDate: string;
  paymentMethod: string;
  bankId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

let initialInvoices: InvoiceRecord[] = [
  {
    id: 'inv-1080',
    invoiceNumber: 'INV-2026-1080',
    shipmentId: 'shp-9812-dac',
    trackingNumber: 'GOSH-2026-9812',
    customerId: 'usr-customer-01',
    customerName: 'Apex Textiles Ltd',
    customerEmail: 'client@apextextiles.com',
    customerPhone: '+880 1711 000000',
    recipientName: 'Apex Fashion & Retail Hub',
    recipientPhone: '+880 1711-002233',
    recipientAddress: 'Plot 14, Sector 7, Uttara Model Town, Dhaka-1230, Bangladesh',
    origin: 'Guangzhou, China',
    destination: 'Dhaka, Bangladesh',
    mode: 'air',
    totalWeightKg: 850.5,
    items: [
      {
        itemId: 'itm-01',
        itemCode: '#AF-9812A',
        description: 'Air Freight LD3 ULD Container (Interlock Cotton Knit Fabrics & Accessories)',
        packagingType: 'air_uld',
        arrivedQuantity: 24,
        totalQuantity: 24,
        weightKg: 450.0,
        cbm: 2.8,
        ratePerKg: 750,
        amountBDT: 337500
      },
      {
        itemId: 'itm-02',
        itemCode: '#AF-9812B',
        description: 'Reinforced Industrial Palletized Cartons (Electronic Testing Sensors)',
        packagingType: 'pallet',
        arrivedQuantity: 18,
        totalQuantity: 18,
        weightKg: 400.5,
        cbm: 1.45,
        ratePerKg: 750,
        amountBDT: 300375
      }
    ],
    baseFreight: 637875,
    terminalHandling: 2500,
    customsDuty: 31894,
    fuelSurcharge: 2200,
    subtotal: 674469,
    vatTax: 101170,
    totalBDT: 775639,
    totalUSD: 6573,
    status: 'paid',
    issueDate: '24/10/2026',
    dueDate: '31/10/2026',
    paymentMethod: 'Bank Wire (EFT / RTGS)',
    bankId: 'scb-bd',
    notes: 'Mushak 6.3 Tax Compliant invoice for full consignment clearance at HSIA Dhaka.',
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-25T11:00:00Z'
  },
  {
    id: 'inv-1081',
    invoiceNumber: 'INV-2026-1081',
    shipmentId: 'shp-4411-ctg',
    trackingNumber: 'GOSH-2026-4411',
    customerId: 'usr-customer-02',
    customerName: 'Standard Composite Mills Ltd',
    customerEmail: 'procurement@standardmills.com',
    customerPhone: '+880 1819 223344',
    recipientName: 'Standard Composite Chittagong Mill Receiving Yard',
    recipientPhone: '+880 1819-223344',
    recipientAddress: 'Chittagong Port Access Road, North Patenga, Chittagong',
    origin: 'Shenzhen, China',
    destination: 'Chittagong, Bangladesh',
    mode: 'sea',
    totalWeightKg: 18450,
    items: [
      {
        itemId: 'itm-03',
        itemCode: '#SEA-40HQ-88',
        description: '40ft High Cube Full Container Load (Circular Weaving Looms & Accessories)',
        packagingType: '40ft_hq',
        arrivedQuantity: 1,
        totalQuantity: 1,
        weightKg: 18450,
        cbm: 68.4,
        ratePerKg: 240,
        amountBDT: 4428000
      }
    ],
    baseFreight: 4428000,
    terminalHandling: 8500,
    customsDuty: 221400,
    fuelSurcharge: 1500,
    subtotal: 4659400,
    vatTax: 698910,
    totalBDT: 5358310,
    totalUSD: 45409,
    status: 'pending',
    issueDate: '22/10/2026',
    dueDate: '29/10/2026',
    paymentMethod: 'Bank Wire (EFT / RTGS)',
    bankId: 'scb-bd',
    notes: 'Advance freight and customs duty payment collection for 40HQ FCL container.',
    createdAt: '2026-10-22T08:30:00Z',
    updatedAt: '2026-10-22T08:30:00Z'
  }
];

export class InvoiceService {
  static async listInvoices(params?: {
    shipmentId?: string;
    customerId?: string;
    status?: string;
    search?: string;
  }): Promise<InvoiceRecord[]> {
    let list = [...initialInvoices];

    if (params?.shipmentId) {
      list = list.filter((i) => i.shipmentId === params.shipmentId);
    }
    if (params?.customerId) {
      list = list.filter((i) => i.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      list = list.filter((i) => i.status === params.status);
    }
    if (params?.search) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.trackingNumber.toLowerCase().includes(q) ||
          i.destination.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getById(idOrNumber: string): Promise<InvoiceRecord | null> {
    const inv = initialInvoices.find(
      (i) => i.id === idOrNumber || i.invoiceNumber.toUpperCase() === idOrNumber.toUpperCase()
    );
    return inv || null;
  }

  static async createInvoice(data: {
    shipmentId: string;
    invoiceNumber?: string;
    issueDate?: string;
    dueDate?: string;
    paymentMethod?: string;
    bankId?: string;
    notes?: string;
    status?: 'pending' | 'paid';
    ratePerKg?: number;
    baseFreightOverride?: number;
    terminalHandlingOverride?: number;
    customsDutyOverride?: number;
    fuelSurchargeOverride?: number;
    vatTaxOverride?: number;
    selectedItems: Array<{
      itemId: string;
      itemCode?: string;
      description: string;
      packagingType?: string;
      arrivedQuantity: number;
      totalQuantity: number;
      weightKg: number;
      cbm?: number;
      ratePerKg?: number;
    }>;
  }): Promise<InvoiceRecord | null> {
    const shipment = await ShipmentService.getById(data.shipmentId);
    if (!shipment) return null;

    const id = `inv-${Date.now().toString(36)}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = data.invoiceNumber?.trim() || `INV-2026-${randomSeq}`;
    const now = new Date();
    const issueDate = data.issueDate || now.toLocaleDateString('en-GB');
    const dueDate = data.dueDate || new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-GB');

    // Default rate per KG according to mode if not specified
    const isAir = shipment.mode === 'air';
    const isSea = shipment.mode === 'sea';
    const isHandCarry = shipment.mode === 'hand_carry';
    const defaultRate = data.ratePerKg || (isAir ? 750 : isSea ? 240 : isHandCarry ? 1450 : 500);

    // Compute arrived total weight and item line costs
    let totalArrivedWeight = 0;
    const computedItems: InvoiceItem[] = data.selectedItems.map((it) => {
      const itemRate = it.ratePerKg || defaultRate;
      const weight = Number(it.weightKg) || 1;
      totalArrivedWeight += weight;
      const amountBDT = Math.round(weight * itemRate);
      return {
        itemId: it.itemId,
        itemCode: it.itemCode,
        description: it.description,
        packagingType: it.packagingType,
        arrivedQuantity: it.arrivedQuantity,
        totalQuantity: it.totalQuantity,
        weightKg: weight,
        cbm: it.cbm,
        ratePerKg: itemRate,
        amountBDT
      };
    });

    const baseFreight =
      data.baseFreightOverride !== undefined
        ? data.baseFreightOverride
        : computedItems.reduce((acc, it) => acc + it.amountBDT, 0);

    const customsDuty =
      data.customsDutyOverride !== undefined
        ? data.customsDutyOverride
        : Math.round(baseFreight * 0.05);

    const terminalHandling =
      data.terminalHandlingOverride !== undefined
        ? data.terminalHandlingOverride
        : isSea
        ? 8500
        : 2500;

    const fuelSurcharge =
      data.fuelSurchargeOverride !== undefined
        ? data.fuelSurchargeOverride
        : isAir
        ? 2200
        : 1500;

    const subtotal = baseFreight + customsDuty + terminalHandling + fuelSurcharge;
    const vatTax = data.vatTaxOverride !== undefined ? data.vatTaxOverride : Math.round(subtotal * 0.15);
    const totalBDT = subtotal + vatTax;
    const totalUSD = Math.round(totalBDT / 118);

    const newInvoice: InvoiceRecord = {
      id,
      invoiceNumber,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      customerId: shipment.customerId,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      customerPhone: shipment.customerPhone,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      recipientAddress: shipment.recipientAddress,
      origin: `${shipment.originCity}, ${shipment.originCountry}`,
      destination: `${shipment.destCity}, ${shipment.destCountry}`,
      mode: shipment.mode,
      totalWeightKg: totalArrivedWeight > 0 ? totalArrivedWeight : shipment.totalWeightKg,
      items: computedItems,
      baseFreight,
      terminalHandling,
      customsDuty,
      fuelSurcharge,
      subtotal,
      vatTax,
      totalBDT,
      totalUSD,
      status: data.status || 'pending',
      issueDate,
      dueDate,
      paymentMethod: data.paymentMethod || 'Bank Wire (EFT / RTGS)',
      bankId: data.bankId || 'scb-bd',
      notes: data.notes || `Commercial tax invoice for ${computedItems.length} arrived products under ${shipment.trackingNumber}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    initialInvoices.unshift(newInvoice);

    // Update the shipment's items to reflect their arrived state!
    const arrivedMap = new Map<string, { arrivedQty: number; arrivedWeight: number }>();
    for (const it of data.selectedItems) {
      arrivedMap.set(it.itemId, {
        arrivedQty: it.arrivedQuantity,
        arrivedWeight: it.weightKg
      });
    }

    if (shipment.items) {
      shipment.items = shipment.items.map((si: any) => {
        const arrival = arrivedMap.get(si.id);
        if (arrival) {
          return {
            ...si,
            arrived: true,
            arrivedQuantity: arrival.arrivedQty,
            arrivedWeightKg: arrival.arrivedWeight,
            arrivedAt: now.toISOString(),
            invoiceNumber
          };
        }
        return si;
      });
    }

    // If invoice is marked paid upon creation, sync shipment paymentStatus
    if (newInvoice.status === 'paid') {
      shipment.paymentStatus = 'payment_received';
    }

    return newInvoice;
  }

  static async updatePaymentStatus(
    idOrNumber: string,
    status: 'pending' | 'paid'
  ): Promise<InvoiceRecord | null> {
    const inv = initialInvoices.find(
      (i) => i.id === idOrNumber || i.invoiceNumber.toUpperCase() === idOrNumber.toUpperCase()
    );
    if (!inv) return null;

    inv.status = status;
    inv.updatedAt = new Date().toISOString();

    // Sync with shipment payment status
    const shipment = await ShipmentService.getById(inv.shipmentId);
    if (shipment) {
      if (status === 'paid') {
        shipment.paymentStatus = 'payment_received';
      }
    }

    return inv;
  }
}
