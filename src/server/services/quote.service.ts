import { ShipmentService } from './shipment.service';

export interface QuoteRevision {
  id: string;
  quoteId: string;
  revisionNumber: number;
  baseFreightCharge: number;
  fuelSurcharge: number;
  customsClearanceFee: number;
  handlingFee: number;
  insuranceFee: number;
  otherFees: number;
  totalAmount: number;
  currency: string;
  validityDate: string;
  transitTimeDays: string;
  notes?: string;
  staffName?: string;
  createdAt: string;
}

export interface QuoteRecord {
  id: string;
  quoteNumber: string;
  customerId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  mode: 'air' | 'sea' | 'hand_carry';
  serviceType: 'door_to_door' | 'port_to_port' | 'door_to_port';
  productName?: string;
  productCategory?: string;
  productImages?: string[];
  productUrl?: string;
  declaredValue?: number;
  cargoDescription: string;
  packagingType: string;
  quantity: number;
  totalWeightKg: number;
  totalCbm: number;
  status:
    | 'submitted'
    | 'under_review'
    | 'priced'
    | 'accepted'
    | 'revision_requested'
    | 'declined'
    | 'converted_to_shipment';
  targetShipmentDate?: string;
  validityDate?: string;
  assignedStaffName?: string;
  assignedStaffId?: string;
  convertedShipmentId?: string;
  revisions: QuoteRevision[];
  createdAt: string;
  updatedAt: string;
}

let initialQuotes: QuoteRecord[] = [
  {
    id: 'qte-4401',
    quoteNumber: 'QTE-2026-4401',
    customerId: 'usr-customer-01',
    guestName: 'Apex Textiles Ltd',
    guestEmail: 'client@apextextiles.com',
    guestPhone: '+880 1711 000000',
    originCountry: 'China',
    originCity: 'Guangzhou',
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    mode: 'air',
    serviceType: 'door_to_door',
    cargoDescription: '500 Pcs Commercial Electronics & Precision Accessories in Export Cartons',
    packagingType: 'carton',
    quantity: 25,
    totalWeightKg: 480.0,
    totalCbm: 2.8,
    status: 'priced',
    targetShipmentDate: '2026-11-05T00:00:00Z',
    validityDate: '2026-11-01T23:59:59Z',
    assignedStaffName: 'Nafis Chowdhury',
    assignedStaffId: 'usr-sales-01',
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-24T11:30:00Z',
    revisions: [
      {
        id: 'rev-01',
        quoteId: 'qte-4401',
        revisionNumber: 1,
        baseFreightCharge: 262300.0,
        fuelSurcharge: 34160.0,
        customsClearanceFee: 18300.0,
        handlingFee: 9150.0,
        insuranceFee: 5490.0,
        otherFees: 0.0,
        totalAmount: 329400.0,
        currency: 'BDT',
        validityDate: '2026-11-01T23:59:59Z',
        transitTimeDays: '3 - 5 business days',
        notes: 'Includes airline direct export handling from Guangzhou BAI Hub, customs clearance at HSIA Dhaka, and local bonded delivery.',
        createdAt: '2026-10-24T11:30:00Z'
      }
    ]
  },
  {
    id: 'qte-3920',
    quoteNumber: 'QTE-2026-3920',
    customerId: 'usr-customer-01',
    guestName: 'Beximco Pharma Hub',
    guestEmail: 'supplychain@beximco.org',
    guestPhone: '+880 1819 112233',
    originCountry: 'China',
    originCity: 'Shenzhen',
    destCountry: 'Bangladesh',
    destCity: 'Chittagong',
    mode: 'sea',
    serviceType: 'port_to_port',
    cargoDescription: 'Standard Industrial Machinery Components & Electronic Hardware in Sealed Wooden Crates',
    packagingType: 'drum',
    quantity: 40,
    totalWeightKg: 8200.0,
    totalCbm: 18.0,
    status: 'under_review',
    targetShipmentDate: '2026-11-15T00:00:00Z',
    createdAt: '2026-10-24T09:15:00Z',
    updatedAt: '2026-10-24T09:15:00Z',
    revisions: []
  }
];

export class QuoteService {
  static async listQuotes(params?: { customerId?: string; status?: string }): Promise<QuoteRecord[]> {
    let result = [...initialQuotes];
    if (params?.customerId) {
      result = result.filter((q) => q.customerId === params.customerId);
    }
    if (params?.status && params.status !== 'all') {
      result = result.filter((q) => q.status === params.status);
    }
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static async getById(quoteIdOrNumber: string): Promise<QuoteRecord | null> {
    const q = initialQuotes.find(
      (item) => item.id === quoteIdOrNumber || item.quoteNumber.toUpperCase() === quoteIdOrNumber.toUpperCase()
    );
    return q || null;
  }

  static async createQuote(data: {
    customerId?: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    originCountry: string;
    originCity: string;
    destCountry: string;
    destCity: string;
    mode: 'air' | 'sea' | 'hand_carry';
    serviceType?: 'door_to_door' | 'port_to_port' | 'door_to_port';
    productName?: string;
    productCategory?: string;
    productImages?: string[];
    productUrl?: string;
    declaredValue?: number;
    cargoDescription: string;
    packagingType?: string;
    quantity?: number;
    totalWeightKg: number;
    totalCbm: number;
    targetShipmentDate?: string;
  }): Promise<QuoteRecord> {
    const id = `qte-${Date.now().toString(36)}`;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QTE-${new Date().getFullYear()}-${randomNum}`;
    const now = new Date().toISOString();

    const newQuote: QuoteRecord = {
      id,
      quoteNumber,
      customerId: data.customerId,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      originCountry: data.originCountry,
      originCity: data.originCity,
      destCountry: data.destCountry,
      destCity: data.destCity,
      mode: data.mode,
      serviceType: data.serviceType || 'door_to_door',
      productName: data.productName,
      productCategory: data.productCategory,
      productImages: data.productImages || [],
      productUrl: data.productUrl,
      declaredValue: data.declaredValue,
      cargoDescription: data.cargoDescription,
      packagingType: data.packagingType || 'carton',
      quantity: data.quantity || 1,
      totalWeightKg: data.totalWeightKg,
      totalCbm: data.totalCbm,
      status: 'submitted',
      targetShipmentDate: data.targetShipmentDate,
      revisions: [],
      createdAt: now,
      updatedAt: now
    };

    initialQuotes.unshift(newQuote);
    return newQuote;
  }

  static async addPricingRevision(
    quoteId: string,
    revision: {
      baseFreightCharge: number;
      fuelSurcharge: number;
      customsClearanceFee: number;
      handlingFee: number;
      insuranceFee: number;
      otherFees: number;
      currency?: string;
      validityDate?: string;
      transitTimeDays?: string;
      notes?: string;
      staffName?: string;
    }
  ): Promise<QuoteRecord | null> {
    const quote = initialQuotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    const totalAmount =
      revision.baseFreightCharge +
      revision.fuelSurcharge +
      revision.customsClearanceFee +
      revision.handlingFee +
      revision.insuranceFee +
      revision.otherFees;

    const revObj: QuoteRevision = {
      id: `rev-${quote.revisions.length + 1}-${Date.now().toString(36)}`,
      quoteId: quote.id,
      revisionNumber: quote.revisions.length + 1,
      baseFreightCharge: revision.baseFreightCharge,
      fuelSurcharge: revision.fuelSurcharge,
      customsClearanceFee: revision.customsClearanceFee,
      handlingFee: revision.handlingFee,
      insuranceFee: revision.insuranceFee,
      otherFees: revision.otherFees,
      totalAmount,
      currency: revision.currency || 'BDT',
      validityDate: revision.validityDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      transitTimeDays: revision.transitTimeDays || '3-7 days',
      notes: revision.notes,
      createdAt: new Date().toISOString()
    };

    quote.revisions.unshift(revObj);
    quote.status = 'priced';
    quote.validityDate = revObj.validityDate;
    if (revision.staffName) quote.assignedStaffName = revision.staffName;
    quote.updatedAt = new Date().toISOString();

    return quote;
  }

  static async convertQuoteToShipment(
    quoteId: string,
    overrides?: {
      negotiatedPrice?: number;
      currency?: string;
      pricingNotes?: string;
      productName?: string;
      cargoDescription?: string;
      originCountry?: string;
      originCity?: string;
      destCountry?: string;
      destCity?: string;
      mode?: 'air' | 'sea' | 'road' | 'hand_carry';
      serviceLevel?: 'standard' | 'express' | 'priority';
      totalWeightKg?: number;
      totalCbm?: number;
      totalPieces?: number;
      packagingType?: string;
      recipientName?: string;
      recipientPhone?: string;
      recipientAddress?: string;
      carrierName?: string;
      voyageOrFlightNumber?: string;
      items?: Array<{
        description: string;
        itemCode?: string;
        packagingType?: string;
        quantity?: number;
        weightKg?: number;
        cbm?: number;
        categoryTag?: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
        declaredValue?: number;
      }>;
    }
  ): Promise<{ quote: QuoteRecord; shipmentId: string; shipment: any } | null> {
    const quote = initialQuotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    // If a negotiated price or custom budget was agreed upon, record a new revision
    if (overrides?.negotiatedPrice !== undefined && overrides.negotiatedPrice > 0) {
      const agreedAmount = Number(overrides.negotiatedPrice);
      const curr = overrides.currency || 'BDT';
      const revObj: QuoteRevision = {
        id: `rev-nego-${Date.now().toString(36)}`,
        quoteId: quote.id,
        revisionNumber: quote.revisions.length + 1,
        baseFreightCharge: agreedAmount,
        fuelSurcharge: 0,
        customsClearanceFee: 0,
        handlingFee: 0,
        insuranceFee: 0,
        otherFees: 0,
        totalAmount: agreedAmount,
        currency: curr,
        validityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        transitTimeDays: 'Standard Logistics Transit',
        notes: overrides.pricingNotes || 'Final negotiated budget agreed with client prior to booking conversion.',
        createdAt: new Date().toISOString()
      };
      quote.revisions.unshift(revObj);
    }

    const mode = (overrides?.mode || quote.mode || 'air') as 'air' | 'sea' | 'road' | 'hand_carry';
    const originCountry = overrides?.originCountry || quote.originCountry;
    const originCity = overrides?.originCity || quote.originCity;
    const destCountry = overrides?.destCountry || quote.destCountry;
    const destCity = overrides?.destCity || quote.destCity;
    const totalWeightKg = Number(overrides?.totalWeightKg) || quote.totalWeightKg;
    const totalCbm = Number(overrides?.totalCbm) || quote.totalCbm;
    const totalPieces = Number(overrides?.totalPieces) || quote.quantity;
    const cargoDescription = overrides?.cargoDescription || quote.cargoDescription;
    const productName = overrides?.productName || quote.productName || cargoDescription;

    const items =
      overrides?.items && overrides.items.length > 0
        ? overrides.items
        : [
            {
              description: cargoDescription,
              quantity: totalPieces,
              packagingType: overrides?.packagingType || quote.packagingType || 'carton',
              weightKg: totalWeightKg,
              cbm: totalCbm,
              categoryTag: 'Commercial' as const,
              declaredValue: quote.declaredValue
            }
          ];

    const newShipment = await ShipmentService.createShipment({
      customerId: quote.customerId || 'usr-customer-01',
      customerName: quote.guestName,
      customerEmail: quote.guestEmail,
      customerPhone: quote.guestPhone,
      productName,
      recipientName: overrides?.recipientName || `${quote.guestName} Receiving Facility`,
      recipientPhone: overrides?.recipientPhone || quote.guestPhone,
      recipientAddress: overrides?.recipientAddress || `${destCity}, ${destCountry}`,
      originCountry,
      originCity,
      destCountry,
      destCity,
      mode,
      serviceLevel: overrides?.serviceLevel || 'express',
      totalWeightKg,
      totalCbm,
      totalPieces,
      carrierName: overrides?.carrierName || (mode === 'air' ? 'GoShipping Air Priority' : mode === 'sea' ? 'GoShipping Ocean Line' : 'GoShipping Surface'),
      voyageOrFlightNumber: overrides?.voyageOrFlightNumber || (mode === 'air' ? 'Flight GOSH-CARGO' : 'Vessel GOSH-VOYAGE'),
      items
    });

    quote.status = 'converted_to_shipment';
    quote.convertedShipmentId = newShipment.id;
    quote.updatedAt = new Date().toISOString();

    return { quote, shipmentId: newShipment.id, shipment: newShipment };
  }
}
