import crypto from 'node:crypto';
import {
  TRACKING_STATUSES,
  PHYSICAL_STAGES,
  TrackingStatusCode,
  normalizeStatusCode,
  calculatePhysicalProgress
} from './tracking-status';
import { formatBstDateTime } from '../utils/date';
import { RealtimeService } from './realtime.service';
import { getAllAccounts } from '../auth/session';

export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export function isPhoneMatch(query: string, target?: string | null): boolean {
  if (!target) return false;
  const qDigits = normalizePhoneDigits(query);
  const tDigits = normalizePhoneDigits(target);
  if (!qDigits || qDigits.length < 6 || !tDigits || tDigits.length < 6) return false;

  if (qDigits === tDigits) return true;

  // In Bangladesh: standard 10 or 11 digits: e.g. 01711002233 vs 8801711002233
  const qLast10 = qDigits.slice(-10);
  const tLast10 = tDigits.slice(-10);
  if (qLast10.length === 10 && tLast10.length === 10 && qLast10 === tLast10) return true;

  return tDigits.endsWith(qDigits) || qDigits.endsWith(tDigits) || tDigits.includes(qDigits) || qDigits.includes(tDigits);
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  itemCode: string; // e.g. '#GA5133'
  description: string;
  imageUrl?: string;
  packagingType: '40ft_hq' | '20ft_container' | '10ft_container' | 'air_uld' | 'pallet' | 'carton' | string;
  quantity: number;
  weightKg: number;
  cbm: number;
  categoryTag: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
  declaredValue?: number;
  currency?: string;
  arrived?: boolean;
  arrivedQuantity?: number;
  arrivedWeightKg?: number;
  arrivedAt?: string;
  invoiceNumber?: string;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: string;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  title: string;
  description: string;
  locationName: string;
  eventTime: string; // ISO UTC
  occurredAtBst: string; // "25 Oct 2026, 08:15 PM BST"
  lat?: number;
  lng?: number;
  source: 'warehouse' | 'admin' | 'carrier_api' | 'driver';
  visibility: 'public' | 'internal';
  eventVersion: number;
}

export interface ShipmentRecord {
  id: string;
  trackingNumber: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAddress: string;
  originCountry: string;
  originCity: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  destCountry: string;
  destCity: string;
  destAddress: string;
  destLat: number;
  destLng: number;
  mode: 'air' | 'sea' | 'road' | 'hand_carry';
  serviceLevel: 'standard' | 'express' | 'priority';
  status: TrackingStatusCode;
  statusCode: TrackingStatusCode;
  statusLabel: string;
  paymentStatus: 'pending' | 'payment_received';
  eventVersion: number;
  currentLocation: string;
  currentLat?: number;
  currentLng?: number;
  totalWeightKg: number;
  totalCbm: number;
  totalPieces: number;
  carrierName: string;
  carrierWaybillNumber?: string;
  voyageOrFlightNumber: string;
  billOfLadingNumber: string;
  departureTime: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  bookingReference?: string;
  notes?: string;
  items: ShipmentItem[];
  events: ShipmentEvent[];
  physicalProgress: {
    completedStagesCount: number;
    totalStagesCount: number;
    percentage: number;
    currentPhysicalStageIndex: number;
    isComplete: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastUpdatedBst: string;
}

// In-memory operational store with authentic, realistic initial data matching the 9 standard statuses
let initialShipments: ShipmentRecord[] = [
  {
    id: 'shp-9812-dac',
    trackingNumber: 'GOSH-2026-9812',
    productName: 'High-Density Interlock Cotton Knit Fabrics & Sample Garments',
    productImage: '/assets/products/cotton-fabrics.svg',
    productImages: ['/assets/products/cotton-fabrics.svg', '/assets/products/electronics.svg'],
    customerId: 'usr-customer-01',
    customerName: 'Apex Textiles Ltd',
    customerEmail: 'client@apextextiles.com',
    customerPhone: '+880 1711 000000',
    recipientName: 'Apex Fashion & Retail Hub',
    recipientPhone: '+880 1711-002233',
    recipientAddress: 'Plot 14, Sector 7, Uttara Model Town, Dhaka-1230, Bangladesh',
    originCountry: 'China',
    originCity: 'Guangzhou',
    originAddress: 'Baiyun International Logistics Park, Guangzhou, Guangdong, China',
    originLat: 23.3924,
    originLng: 113.2988,
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    destAddress: 'Cargo Village, Hazrat Shahjalal International Airport, Dhaka-1229',
    destLat: 23.8433,
    destLng: 90.4029,
    mode: 'air',
    serviceLevel: 'express',
    status: 'awaiting_customs',
    statusCode: 'awaiting_customs',
    statusLabel: 'AWAITING CUSTOMS CLEARANCE',
    paymentStatus: 'payment_received',
    eventVersion: 5,
    currentLocation: 'Dhaka Custom House, HSIA',
    currentLat: 23.8433,
    currentLng: 90.4029,
    totalWeightKg: 850.5,
    totalCbm: 4.25,
    totalPieces: 42,
    carrierName: 'Cathay Cargo / GoShipping Air Priority',
    carrierWaybillNumber: 'CX-068-92819382',
    voyageOrFlightNumber: 'Flight CX-068',
    billOfLadingNumber: 'AWB-GOSH-9812-CAN',
    departureTime: '2026-10-24T05:30:00Z',
    estimatedDelivery: '2026-10-26T14:00:00Z',
    createdAt: '2026-10-22T04:00:00Z',
    updatedAt: '2026-10-25T05:30:00Z',
    lastUpdatedBst: formatBstDateTime('2026-10-25T05:30:00Z'),
    physicalProgress: {
      completedStagesCount: 5,
      totalStagesCount: 8,
      percentage: 63,
      currentPhysicalStageIndex: 4,
      isComplete: false
    },
    items: [
      {
        id: 'itm-01',
        shipmentId: 'shp-9812-dac',
        itemCode: '#AF-9812A',
        description: 'Air Freight LD3 ULD Container (Interlock Cotton Knit Fabrics & Accessories)',
        imageUrl: '/assets/products/cotton-fabrics.svg',
        packagingType: 'air_uld',
        quantity: 24,
        weightKg: 450.0,
        cbm: 2.8,
        categoryTag: 'Commercial',
        declaredValue: 2989000,
        currency: 'BDT'
      },
      {
        id: 'itm-02',
        shipmentId: 'shp-9812-dac',
        itemCode: '#AF-9812B',
        description: 'Reinforced Industrial Palletized Cartons (Electronic Testing Sensors)',
        imageUrl: '/assets/products/electronics.svg',
        packagingType: 'pallet',
        quantity: 18,
        weightKg: 400.5,
        cbm: 1.45,
        categoryTag: 'Electronics',
        declaredValue: 2220000,
        currency: 'BDT'
      }
    ],
    events: [
      {
        id: 'evt-05',
        shipmentId: 'shp-9812-dac',
        status: 'awaiting_customs',
        statusCode: 'awaiting_customs',
        statusLabel: 'AWAITING CUSTOMS CLEARANCE',
        title: 'AWAITING CUSTOMS CLEARANCE',
        description: 'Bill of Entry C-58192 submitted to NBR Customs. Awaiting physical inspection and duty appraisal release.',
        locationName: 'Dhaka Custom House, HSIA, Bangladesh',
        eventTime: '2026-10-25T05:30:00Z', // 11:30 AM BST
        occurredAtBst: '25 Oct 2026, 11:30 AM BST',
        lat: 23.8433,
        lng: 90.4029,
        source: 'admin',
        visibility: 'public',
        eventVersion: 5
      },
      {
        id: 'evt-pay-01',
        shipmentId: 'shp-9812-dac',
        status: 'payment_received',
        statusCode: 'payment_received',
        statusLabel: 'PAYMENT RECEIVED',
        title: 'PAYMENT RECEIVED',
        description: 'Commercial invoice freight tariffs and customs clearance advance payment received in full via bank transfer.',
        locationName: 'GoShipping Corporate Finance & Billing Desk, Dhaka',
        eventTime: '2026-10-25T03:15:00Z', // 09:15 AM BST
        occurredAtBst: '25 Oct 2026, 09:15 AM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 4
      },
      {
        id: 'evt-04',
        shipmentId: 'shp-9812-dac',
        status: 'arrived_dhaka_airport',
        statusCode: 'arrived_dhaka_airport',
        statusLabel: 'ARRIVED DHAKA AIRPORT',
        title: 'ARRIVED DHAKA AIRPORT',
        description: 'Cathay Cargo Flight CX-068 landed at HSIA. Aircraft de-boarded and transferred to Cargo Village shed.',
        locationName: 'HSIA Cargo Village, Dhaka, Bangladesh',
        eventTime: '2026-10-24T22:30:00Z', // 04:30 AM BST
        occurredAtBst: '25 Oct 2026, 04:30 AM BST',
        lat: 23.8433,
        lng: 90.4029,
        source: 'carrier_api',
        visibility: 'public',
        eventVersion: 3
      },
      {
        id: 'evt-03',
        shipmentId: 'shp-9812-dac',
        status: 'dispatched_from_china',
        statusCode: 'dispatched_from_china',
        statusLabel: 'DISPATCHED FROM CHINA',
        title: 'DISPATCHED FROM CHINA',
        description: 'Export customs appraisal completed. Air freight ULD containers boarded onto flight CX-068 and departed.',
        locationName: 'Guangzhou Baiyun Airport Hub (CAN), China',
        eventTime: '2026-10-24T05:30:00Z', // 11:30 AM BST
        occurredAtBst: '24 Oct 2026, 11:30 AM BST',
        lat: 23.3924,
        lng: 113.2988,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 2
      },
      {
        id: 'evt-02',
        shipmentId: 'shp-9812-dac',
        status: 'cn_warehouse_received',
        statusCode: 'cn_warehouse_received',
        statusLabel: 'CN WAREHOUSE RECEIVED',
        title: 'CN WAREHOUSE RECEIVED',
        description: 'Consignment received at Guangzhou hub. 42 packages verified, weighed (850.5 KG), and palletized.',
        locationName: 'GoShipping Guangzhou Central Receiving Hub, China',
        eventTime: '2026-10-23T08:15:00Z', // 02:15 PM BST
        occurredAtBst: '23 Oct 2026, 02:15 PM BST',
        lat: 23.3800,
        lng: 113.2800,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 1
      },
      {
        id: 'evt-01',
        shipmentId: 'shp-9812-dac',
        status: 'purchased',
        statusCode: 'purchased',
        statusLabel: 'PURCHASED',
        title: 'PURCHASED',
        description: 'Commercial order confirmed by factory supplier. GoShipping booking created with Airway Bill allocation.',
        locationName: 'Keqiao Textile Commercial Market, Shaoxing / Guangzhou',
        eventTime: '2026-10-22T04:00:00Z', // 10:00 AM BST
        occurredAtBst: '22 Oct 2026, 10:00 AM BST',
        lat: 23.3924,
        lng: 113.2988,
        source: 'admin',
        visibility: 'public',
        eventVersion: 1
      }
    ]
  },
  {
    id: 'shp-4411-ctg',
    trackingNumber: 'GOSH-2026-4411',
    productName: 'Heavy Industrial Circular Textile Looms & Rotary Precision Units',
    customerId: 'usr-customer-01',
    customerName: 'Standard Composite Mills Ltd',
    customerEmail: 'client@apextextiles.com',
    customerPhone: '+880 1711 000000',
    recipientName: 'Standard Composite Mills Terminal Receiving',
    recipientPhone: '+880 1819-334455',
    recipientAddress: 'Industrial Area, Baizid Bostami Road, Nasirabad, Chittagong, Bangladesh',
    originCountry: 'China',
    originCity: 'Shenzhen',
    originAddress: 'Yantian International Container Terminals, Shenzhen, Guangdong, China',
    originLat: 22.5750,
    originLng: 114.2760,
    destCountry: 'Bangladesh',
    destCity: 'Chittagong',
    destAddress: 'Chittagong Port Authority (CPA) Container Terminal, Chittagong-4100',
    destLat: 22.3193,
    destLng: 91.8105,
    mode: 'sea',
    serviceLevel: 'standard',
    status: 'dispatched_from_china',
    statusCode: 'dispatched_from_china',
    statusLabel: 'DISPATCHED FROM CHINA',
    paymentStatus: 'pending',
    eventVersion: 3,
    currentLocation: 'Malacca Strait Maritime Corridor (Underway to Bay of Bengal)',
    currentLat: 5.4164,
    currentLng: 100.3327,
    totalWeightKg: 18450.0,
    totalCbm: 68.4,
    totalPieces: 1,
    carrierName: 'COSCO Shipping Lines / GoShipping Maritime',
    carrierWaybillNumber: 'COSU-628192810',
    voyageOrFlightNumber: 'COSCO GLORY (Voyage 042W)',
    billOfLadingNumber: 'BOL-GOSH-4411-YANT',
    departureTime: '2026-10-16T02:00:00Z',
    estimatedDelivery: '2026-11-04T18:00:00Z',
    createdAt: '2026-10-12T03:00:00Z',
    updatedAt: '2026-10-16T02:00:00Z',
    lastUpdatedBst: formatBstDateTime('2026-10-16T02:00:00Z'),
    physicalProgress: {
      completedStagesCount: 3,
      totalStagesCount: 8,
      percentage: 38,
      currentPhysicalStageIndex: 2,
      isComplete: false
    },
    items: [
      {
        id: 'itm-03',
        shipmentId: 'shp-4411-ctg',
        itemCode: '#SEA-40HQ-88',
        description: '40ft High Cube Full Container Load (Circular Weaving Looms & Accessories)',
        packagingType: '40ft_hq',
        quantity: 1,
        weightKg: 18450.0,
        cbm: 68.4,
        categoryTag: 'Commercial',
        declaredValue: 8850000,
        currency: 'BDT'
      }
    ],
    events: [
      {
        id: 'evt-13',
        shipmentId: 'shp-4411-ctg',
        status: 'dispatched_from_china',
        statusCode: 'dispatched_from_china',
        statusLabel: 'DISPATCHED FROM CHINA',
        title: 'DISPATCHED FROM CHINA',
        description: '40HQ container hoisted aboard COSCO GLORY at Yantian Port Berth 4. Vessel cast off and underway.',
        locationName: 'Yantian International Container Terminal, Shenzhen, China',
        eventTime: '2026-10-16T02:00:00Z',
        occurredAtBst: '16 Oct 2026, 08:00 AM BST',
        lat: 22.5750,
        lng: 114.2760,
        source: 'carrier_api',
        visibility: 'public',
        eventVersion: 3
      },
      {
        id: 'evt-12',
        shipmentId: 'shp-4411-ctg',
        status: 'cn_warehouse_received',
        statusCode: 'cn_warehouse_received',
        statusLabel: 'CN WAREHOUSE RECEIVED',
        title: 'CN WAREHOUSE RECEIVED',
        description: 'FCL container stuffed, security bolt tagged (#GOSH-SEAL-88192), and gate-in confirmed at Yantian yard.',
        locationName: 'Shenzhen Maritime Logistics Yard, China',
        eventTime: '2026-10-14T10:30:00Z',
        occurredAtBst: '14 Oct 2026, 04:30 PM BST',
        lat: 22.5700,
        lng: 114.2600,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 2
      },
      {
        id: 'evt-11',
        shipmentId: 'shp-4411-ctg',
        status: 'purchased',
        statusCode: 'purchased',
        statusLabel: 'PURCHASED',
        title: 'PURCHASED',
        description: 'Foshan heavy machinery export contract finalized and 40ft HQ slot reserved with carrier.',
        locationName: 'Foshan Industrial Heavy Machinery Park, Guangdong',
        eventTime: '2026-10-12T03:00:00Z',
        occurredAtBst: '12 Oct 2026, 09:00 AM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 1
      }
    ]
  },
  {
    id: 'shp-7733-d2d',
    trackingNumber: 'GOSH-2026-7733',
    productName: '10ft Insulated Lithium Power Storage Packs & Heavy Mechanical Tools',
    customerId: 'usr-customer-01',
    customerName: 'Dhaka Green Energy Solutions',
    customerEmail: 'client@apextextiles.com',
    customerPhone: '+880 1711 000000',
    recipientName: 'Engr. Mahbubul Alam (Operations Director)',
    recipientPhone: '+880 1912-998877',
    recipientAddress: 'Tower 49, Motijheel Commercial Area, Dhaka-1000, Bangladesh',
    originCountry: 'China',
    originCity: 'Yiwu',
    originAddress: 'Yiwu International Trade City Logistics Center, Zhejiang, China',
    originLat: 29.3068,
    originLng: 120.0751,
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    destAddress: 'Motijheel Commercial Area, Dhaka-1000, Bangladesh',
    destLat: 23.7337,
    destLng: 90.4178,
    mode: 'hand_carry',
    serviceLevel: 'priority',
    status: 'out_for_delivery',
    statusCode: 'out_for_delivery',
    statusLabel: 'OUT FOR DELIVERY',
    paymentStatus: 'payment_received',
    eventVersion: 8,
    currentLocation: 'Dhaka Metropolitan Urban Dispatch Unit, Tejgaon',
    currentLat: 23.7644,
    currentLng: 90.3957,
    totalWeightKg: 4050.0,
    totalCbm: 20.7,
    totalPieces: 2,
    carrierName: 'GoShipping Direct Express Urban Fleet',
    carrierWaybillNumber: 'D2D-7733-YW-DAC',
    voyageOrFlightNumber: 'Electric Cargo Van TRC-392 (Driver: Rafiqul Islam)',
    billOfLadingNumber: 'D2D-GOSH-7733-MANIFEST',
    departureTime: '2026-10-18T04:00:00Z',
    estimatedDelivery: '2026-10-25T11:00:00Z',
    createdAt: '2026-10-18T02:00:00Z',
    updatedAt: '2026-10-25T03:30:00Z',
    lastUpdatedBst: formatBstDateTime('2026-10-25T03:30:00Z'),
    physicalProgress: {
      completedStagesCount: 7,
      totalStagesCount: 8,
      percentage: 88,
      currentPhysicalStageIndex: 6,
      isComplete: false
    },
    items: [
      {
        id: 'itm-05',
        shipmentId: 'shp-7733-d2d',
        itemCode: '#D2D-10FT-51',
        description: '10ft Insulated Cargo Container (Lithium Polymer Batteries & E-Scooters)',
        packagingType: '10ft_container',
        quantity: 1,
        weightKg: 3200.0,
        cbm: 15.5,
        categoryTag: 'Dangerous',
        declaredValue: 5124000,
        currency: 'BDT'
      },
      {
        id: 'itm-06',
        shipmentId: 'shp-7733-d2d',
        itemCode: '#D2D-CART-98',
        description: 'Reinforced Hardware Cartons (Specialty Hand Tools & Fasteners)',
        packagingType: 'carton',
        quantity: 1,
        weightKg: 850.0,
        cbm: 5.2,
        categoryTag: 'General',
        declaredValue: 1195000,
        currency: 'BDT'
      }
    ],
    events: [
      {
        id: 'evt-27',
        shipmentId: 'shp-7733-d2d',
        status: 'out_for_delivery',
        statusCode: 'out_for_delivery',
        statusLabel: 'OUT FOR DELIVERY',
        title: 'OUT FOR DELIVERY',
        description: 'Cargo loaded on GoShipping electric van TRC-392. Final destination handover underway in Motijheel.',
        locationName: 'Dhaka Metropolitan Urban Dispatch Unit, Tejgaon',
        eventTime: '2026-10-25T03:30:00Z', // 09:30 AM BST
        occurredAtBst: '25 Oct 2026, 09:30 AM BST',
        lat: 23.7644,
        lng: 90.3957,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 8
      },
      {
        id: 'evt-pay-2',
        shipmentId: 'shp-7733-d2d',
        status: 'payment_received',
        statusCode: 'payment_received',
        statusLabel: 'PAYMENT RECEIVED',
        title: 'PAYMENT RECEIVED',
        description: 'All invoices, customs levies and delivery handling cleared through GoShipping online corporate portal.',
        locationName: 'GoShipping Corporate Finance & Billing Desk, Dhaka',
        eventTime: '2026-10-25T02:00:00Z', // 08:00 AM BST
        occurredAtBst: '25 Oct 2026, 08:00 AM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 7
      },
      {
        id: 'evt-26',
        shipmentId: 'shp-7733-d2d',
        status: 'bd_warehouse_received',
        statusCode: 'bd_warehouse_received',
        statusLabel: 'BD WAREHOUSE RECEIVED',
        title: 'BD WAREHOUSE RECEIVED',
        description: 'Customs cleared cargo received at GoShipping Dhaka central sorting hub. Route sorted for Motijheel.',
        locationName: 'GoShipping Sorting Hub, Tejgaon, Dhaka',
        eventTime: '2026-10-24T11:30:00Z', // 05:30 PM BST
        occurredAtBst: '24 Oct 2026, 05:30 PM BST',
        lat: 23.7644,
        lng: 90.3957,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 6
      },
      {
        id: 'evt-25',
        shipmentId: 'shp-7733-d2d',
        status: 'awaiting_customs',
        statusCode: 'awaiting_customs',
        statusLabel: 'AWAITING CUSTOMS CLEARANCE',
        title: 'AWAITING CUSTOMS CLEARANCE',
        description: 'Customs assessment completed at Dhaka Kamalapur ICD. Assessment notice paid and out-pass issued.',
        locationName: 'Kamalapur Inland Container Depot (ICD), Dhaka',
        eventTime: '2026-10-24T04:00:00Z', // 10:00 AM BST
        occurredAtBst: '24 Oct 2026, 10:00 AM BST',
        lat: 23.7314,
        lng: 90.4265,
        source: 'admin',
        visibility: 'public',
        eventVersion: 5
      },
      {
        id: 'evt-24',
        shipmentId: 'shp-7733-d2d',
        status: 'arrived_dhaka_airport',
        statusCode: 'arrived_dhaka_airport',
        statusLabel: 'ARRIVED DHAKA AIRPORT',
        title: 'ARRIVED DHAKA AIRPORT',
        description: 'Trans-border express linehaul arrived at Dhaka transit entry customs gate.',
        locationName: 'Dhaka Transit Entry Terminal, Bangladesh',
        eventTime: '2026-10-23T12:00:00Z', // 06:00 PM BST
        occurredAtBst: '23 Oct 2026, 06:00 PM BST',
        lat: 23.8433,
        lng: 90.4029,
        source: 'carrier_api',
        visibility: 'public',
        eventVersion: 4
      },
      {
        id: 'evt-23',
        shipmentId: 'shp-7733-d2d',
        status: 'dispatched_from_china',
        statusCode: 'dispatched_from_china',
        statusLabel: 'DISPATCHED FROM CHINA',
        title: 'DISPATCHED FROM CHINA',
        description: 'Cross-border container truck convoy departed Yiwu hub under bonded linehaul seal.',
        locationName: 'Yiwu International Logistics Terminal, China',
        eventTime: '2026-10-21T04:00:00Z', // 10:00 AM BST
        occurredAtBst: '21 Oct 2026, 10:00 AM BST',
        lat: 29.3068,
        lng: 120.0751,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 3
      },
      {
        id: 'evt-22',
        shipmentId: 'shp-7733-d2d',
        status: 'cn_warehouse_received',
        statusCode: 'cn_warehouse_received',
        statusLabel: 'CN WAREHOUSE RECEIVED',
        title: 'CN WAREHOUSE RECEIVED',
        description: 'Cargo checked into Yiwu warehouse. Palletized and measured (20.7 CBM, 4,050 KG).',
        locationName: 'GoShipping Yiwu Receiving Warehouse, China',
        eventTime: '2026-10-19T08:00:00Z', // 02:00 PM BST
        occurredAtBst: '19 Oct 2026, 02:00 PM BST',
        lat: 29.3068,
        lng: 120.0751,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 2
      },
      {
        id: 'evt-21',
        shipmentId: 'shp-7733-d2d',
        status: 'purchased',
        statusCode: 'purchased',
        statusLabel: 'PURCHASED',
        title: 'PURCHASED',
        description: 'Supplier contract verified in Yiwu International Trade City Market.',
        locationName: 'Yiwu Trade City District 2 Market',
        eventTime: '2026-10-18T02:00:00Z', // 08:00 AM BST
        occurredAtBst: '18 Oct 2026, 08:00 AM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 1
      }
    ]
  },
  {
    id: 'shp-yt0719-can',
    trackingNumber: 'YT0719701262824',
    productName: 'Ready-to-Wear Apparel & Boutique Fashion Samples',
    customerId: 'usr-customer-01',
    customerName: 'Apex Textiles Ltd',
    customerEmail: 'client@apextextiles.com',
    customerPhone: '+880 1711-223344',
    recipientName: 'Farhan Ahmed',
    recipientPhone: '+880 1711-223344',
    recipientAddress: 'Plot 14, Sector 7, Uttara Model Town, Dhaka-1230, Bangladesh',
    originCountry: 'China',
    originCity: 'Guangzhou',
    originAddress: 'Baiyun International Logistics Park, Guangzhou, Guangdong, China',
    originLat: 23.3924,
    originLng: 113.2988,
    destCountry: 'Bangladesh',
    destCity: 'Dhaka',
    destAddress: 'Cargo Village, Hazrat Shahjalal International Airport, Dhaka-1229',
    destLat: 23.8433,
    destLng: 90.4029,
    mode: 'air',
    serviceLevel: 'priority',
    status: 'dispatched_from_china',
    statusCode: 'dispatched_from_china',
    statusLabel: 'DISPATCHED FROM CHINA',
    paymentStatus: 'payment_received',
    eventVersion: 3,
    currentLocation: 'Guangzhou Baiyun Airport / In-Flight Linehaul',
    currentLat: 22.8,
    currentLng: 105.4,
    totalWeightKg: 124.5,
    totalCbm: 0.85,
    totalPieces: 8,
    carrierName: 'YTO Express / GoShipping Air Express',
    carrierWaybillNumber: 'YT0719701262824',
    voyageOrFlightNumber: 'Flight YG-9014 (Guangzhou → Dhaka)',
    billOfLadingNumber: 'AWB-YTO-07197012',
    departureTime: '2026-10-26T04:30:00Z',
    estimatedDelivery: '2026-10-29T16:00:00Z',
    createdAt: '2026-10-25T02:00:00Z',
    updatedAt: '2026-10-26T04:30:00Z',
    lastUpdatedBst: '26 Oct 2026, 10:30 AM BST',
    physicalProgress: {
      completedStagesCount: 3,
      totalStagesCount: 8,
      percentage: 38,
      currentPhysicalStageIndex: 2,
      isComplete: false
    },
    items: [
      {
        id: 'itm-yt-01',
        shipmentId: 'shp-yt0719-can',
        itemCode: '#YT-GAR-01',
        description: 'Boutique Knitted Polo Shirts & Hoodies',
        packagingType: 'carton',
        quantity: 5,
        weightKg: 80.0,
        cbm: 0.55,
        categoryTag: 'Commercial',
        declaredValue: 245000,
        currency: 'BDT'
      },
      {
        id: 'itm-yt-02',
        shipmentId: 'shp-yt0719-can',
        itemCode: '#YT-GAR-02',
        description: 'Cotton Fabric Swatch Books & Trims',
        packagingType: 'carton',
        quantity: 3,
        weightKg: 44.5,
        cbm: 0.30,
        categoryTag: 'General',
        declaredValue: 95000,
        currency: 'BDT'
      }
    ],
    events: [
      {
        id: 'evt-yt-03',
        shipmentId: 'shp-yt0719-can',
        status: 'dispatched_from_china',
        statusCode: 'dispatched_from_china',
        statusLabel: 'DISPATCHED FROM CHINA',
        title: 'DISPATCHED FROM CHINA',
        description: 'Export customs cleared and departed Baiyun Airport on scheduled linehaul flight YG-9014.',
        locationName: 'Guangzhou Baiyun Airport (CAN), China',
        eventTime: '2026-10-26T04:30:00Z',
        occurredAtBst: '26 Oct 2026, 10:30 AM BST',
        lat: 23.3924,
        lng: 113.2988,
        source: 'carrier_api',
        visibility: 'public',
        eventVersion: 3
      },
      {
        id: 'evt-yt-02',
        shipmentId: 'shp-yt0719-can',
        status: 'cn_warehouse_received',
        statusCode: 'cn_warehouse_received',
        statusLabel: 'CN WAREHOUSE RECEIVED',
        title: 'CN WAREHOUSE RECEIVED',
        description: 'Consignment safely checked in and security weighed at GoShipping Guangzhou terminal.',
        locationName: 'GoShipping Guangzhou Receiving Hub',
        eventTime: '2026-10-25T11:00:00Z',
        occurredAtBst: '25 Oct 2026, 05:00 PM BST',
        lat: 23.3924,
        lng: 113.2988,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 2
      },
      {
        id: 'evt-yt-01',
        shipmentId: 'shp-yt0719-can',
        status: 'purchased',
        statusCode: 'purchased',
        statusLabel: 'PURCHASED',
        title: 'PURCHASED',
        description: 'Order confirmed with 1688 manufacturer. Carrier waybill YT0719701262824 assigned.',
        locationName: 'Merchant Supplier Hub, Guangzhou, China',
        eventTime: '2026-10-25T02:00:00Z',
        occurredAtBst: '25 Oct 2026, 08:00 AM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 1
      }
    ]
  },
  {
    id: 'shp-777456-szx',
    trackingNumber: '777456943703045',
    productName: 'Smart LED Display Controllers & Industrial Sensors',
    customerId: 'usr-customer-02',
    customerName: 'Standard Composite Mills',
    customerEmail: 'shakil@standardcomposite.com',
    customerPhone: '+880 1819-334455',
    recipientName: 'Shakil Mahmud',
    recipientPhone: '+880 1819-334455',
    recipientAddress: 'Industrial Area, Baizid Bostami Road, Chittagong, Bangladesh',
    originCountry: 'China',
    originCity: 'Shenzhen',
    originAddress: 'Baoan International Logistics Center, Shenzhen, Guangdong, China',
    originLat: 22.5431,
    originLng: 114.0579,
    destCountry: 'Bangladesh',
    destCity: 'Chittagong',
    destAddress: 'Chittagong Port Authority / Custom House, Chittagong',
    destLat: 22.3193,
    destLng: 91.8105,
    mode: 'sea',
    serviceLevel: 'express',
    status: 'cn_warehouse_received',
    statusCode: 'cn_warehouse_received',
    statusLabel: 'CN WAREHOUSE RECEIVED',
    paymentStatus: 'pending',
    eventVersion: 2,
    currentLocation: 'Shenzhen Consolidation Hub, China',
    currentLat: 22.5431,
    currentLng: 114.0579,
    totalWeightKg: 460.0,
    totalCbm: 2.1,
    totalPieces: 15,
    carrierName: 'SF Express / GoShipping Fast Line',
    carrierWaybillNumber: '777456943703045',
    voyageOrFlightNumber: 'Vessel PACIFIC STAR (Voyage 128S)',
    billOfLadingNumber: 'BOL-SF-77745694',
    departureTime: '2026-10-28T08:00:00Z',
    estimatedDelivery: '2026-11-06T12:00:00Z',
    createdAt: '2026-10-26T06:00:00Z',
    updatedAt: '2026-10-27T09:15:00Z',
    lastUpdatedBst: '27 Oct 2026, 03:15 PM BST',
    physicalProgress: {
      completedStagesCount: 2,
      totalStagesCount: 8,
      percentage: 25,
      currentPhysicalStageIndex: 1,
      isComplete: false
    },
    items: [
      {
        id: 'itm-sf-01',
        shipmentId: 'shp-777456-szx',
        itemCode: '#SF-LED-01',
        description: 'Industrial LED Modules & Microcontrollers',
        packagingType: 'carton',
        quantity: 15,
        weightKg: 460.0,
        cbm: 2.1,
        categoryTag: 'Electronics',
        declaredValue: 890000,
        currency: 'BDT'
      }
    ],
    events: [
      {
        id: 'evt-sf-02',
        shipmentId: 'shp-777456-szx',
        status: 'cn_warehouse_received',
        statusCode: 'cn_warehouse_received',
        statusLabel: 'CN WAREHOUSE RECEIVED',
        title: 'CN WAREHOUSE RECEIVED',
        description: 'Goods received, barcoded, and palletized at GoShipping Shenzhen warehouse.',
        locationName: 'GoShipping Shenzhen Receiving Center, Baoan',
        eventTime: '2026-10-27T09:15:00Z',
        occurredAtBst: '27 Oct 2026, 03:15 PM BST',
        lat: 22.5431,
        lng: 114.0579,
        source: 'warehouse',
        visibility: 'public',
        eventVersion: 2
      },
      {
        id: 'evt-sf-01',
        shipmentId: 'shp-777456-szx',
        status: 'purchased',
        statusCode: 'purchased',
        statusLabel: 'PURCHASED',
        title: 'PURCHASED',
        description: 'Supplier order booked with tracking identifier 777456943703045.',
        locationName: 'Shenzhen Electronics Market, Huaqiangbei',
        eventTime: '2026-10-26T06:00:00Z',
        occurredAtBst: '26 Oct 2026, 12:00 PM BST',
        source: 'admin',
        visibility: 'public',
        eventVersion: 1
      }
    ]
  }
];

export class ShipmentService {
  /**
   * Get all shipments with filtering & search
   */
  static async listShipments(params?: {
    trackingNumber?: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    status?: string;
    mode?: string;
    query?: string;
  }): Promise<ShipmentRecord[]> {
    let results = [...initialShipments];

    if (params?.customerId) {
      const cId = params.customerId;
      const cName = params.customerName?.toLowerCase();
      results = results.filter(
        (s) =>
          s.customerId === cId ||
          (cName && s.customerName.toLowerCase() === cName)
      );
    }
    if (params?.status && params.status !== 'all') {
      const normalized = normalizeStatusCode(params.status);
      results = results.filter((s) => s.statusCode === normalized || s.status === params.status);
    }
    if (params?.mode && params.mode !== 'all') {
      results = results.filter((s) => s.mode === params.mode);
    }
    if (params?.query) {
      const q = params.query.toLowerCase().trim();
      results = results.filter(
        (s) =>
          s.trackingNumber.toLowerCase().includes(q) ||
          s.originCity.toLowerCase().includes(q) ||
          s.destCity.toLowerCase().includes(q) ||
          s.productName.toLowerCase().includes(q) ||
          s.carrierName.toLowerCase().includes(q) ||
          s.voyageOrFlightNumber.toLowerCase().includes(q)
      );
    }

    return results;
  }

  /**
   * Unified tracking search by Tracking Code, Email, or Phone Number
   */
  static async searchShipmentsUnified(query: string): Promise<{
    shipments: ShipmentRecord[];
    searchType: 'tracking_code' | 'email' | 'phone';
  }> {
    const raw = query.trim();
    if (!raw) {
      return { shipments: [], searchType: 'tracking_code' };
    }

    const cleanUpper = raw.toUpperCase();
    const cleanLower = raw.toLowerCase();
    const digitsOnly = normalizePhoneDigits(raw);

    const isEmail = cleanLower.includes('@');
    // Check if query is directly a known tracking number or carrier waybill before guessing phone number
    const isDirectTracking = initialShipments.some(
      (s) =>
        s.trackingNumber.toUpperCase() === cleanUpper ||
        s.id.toLowerCase() === cleanLower ||
        (s.carrierWaybillNumber && s.carrierWaybillNumber.toUpperCase() === cleanUpper) ||
        (s.billOfLadingNumber && s.billOfLadingNumber.toUpperCase() === cleanUpper)
    );
    const isPhone = !isDirectTracking && !isEmail && digitsOnly.length >= 6 && /^[\d\s+\-()]{6,}$/.test(raw);
    const searchType: 'tracking_code' | 'email' | 'phone' = isEmail ? 'email' : isPhone ? 'phone' : 'tracking_code';

    // Look up accounts matching email or phone
    const accounts = getAllAccounts();
    const matchedAccountIds = new Set<string>();

    if (isEmail) {
      for (const acc of accounts) {
        if (acc.email && acc.email.toLowerCase() === cleanLower) {
          matchedAccountIds.add(acc.id);
        }
      }
    } else if (isPhone) {
      for (const acc of accounts) {
        if (acc.phone && isPhoneMatch(raw, acc.phone)) {
          matchedAccountIds.add(acc.id);
        }
      }
    }

    const matchedShipments = initialShipments.filter((s) => {
      // 1. Direct tracking number / identifiers match
      if (
        s.trackingNumber.toUpperCase() === cleanUpper ||
        s.id.toLowerCase() === cleanLower ||
        (s.carrierWaybillNumber && s.carrierWaybillNumber.toUpperCase() === cleanUpper) ||
        (s.billOfLadingNumber && s.billOfLadingNumber.toUpperCase() === cleanUpper)
      ) {
        return true;
      }

      // 2. Partial tracking number match (if query is not email and not phone, min 4 chars)
      if (!isEmail && !isPhone && raw.length >= 4) {
        if (s.trackingNumber.toUpperCase().includes(cleanUpper)) {
          return true;
        }
      }

      // 3. Email match
      if (isEmail) {
        if (s.customerEmail && s.customerEmail.toLowerCase() === cleanLower) return true;
        if (s.recipientEmail && s.recipientEmail.toLowerCase() === cleanLower) return true;
        if (matchedAccountIds.has(s.customerId)) return true;
      }

      // 4. Phone match
      if (isPhone) {
        if (isPhoneMatch(raw, s.customerPhone)) return true;
        if (isPhoneMatch(raw, s.recipientPhone)) return true;
        if (matchedAccountIds.has(s.customerId)) return true;
      }

      return false;
    });

    // Fallback: if searchType was tracking_code but didn't match, check phone or email
    if (matchedShipments.length === 0 && !isEmail && digitsOnly.length >= 8) {
      const phoneFallbackMatches = initialShipments.filter(
        (s) =>
          isPhoneMatch(raw, s.customerPhone) ||
          isPhoneMatch(raw, s.recipientPhone) ||
          accounts.some(
            (acc) =>
              (acc.phone && isPhoneMatch(raw, acc.phone) && acc.id === s.customerId) ||
              matchedAccountIds.has(s.customerId)
          )
      );
      if (phoneFallbackMatches.length > 0) {
        return { shipments: phoneFallbackMatches, searchType: 'phone' };
      }
    }

    return { shipments: matchedShipments, searchType };
  }

  /**
   * Get single shipment by tracking number, id, email, or phone
   */
  static async getByTrackingNumber(trackingNumber: string): Promise<ShipmentRecord | null> {
    const clean = trackingNumber.trim().toUpperCase();
    const direct = initialShipments.find(
      (s) => s.trackingNumber.toUpperCase() === clean || s.id.toLowerCase() === trackingNumber.toLowerCase()
    );
    if (direct) return { ...direct };

    const { shipments } = await this.searchShipmentsUnified(trackingNumber);
    return shipments.length > 0 ? { ...shipments[0] } : null;
  }

  /**
   * Get direct reference to shipment by ID or Tracking
   */
  static async getById(idOrTracking: string): Promise<ShipmentRecord | null> {
    const clean = idOrTracking.trim();
    const found = initialShipments.find(
      (s) => s.id === clean || s.trackingNumber.toUpperCase() === clean.toUpperCase()
    );
    return found || null;
  }

  /**
   * Update selective product item arrival statuses
   */
  static async updateItemArrivals(
    shipmentId: string,
    arrivals: Array<{ itemId: string; arrived: boolean; arrivedQuantity?: number; arrivedWeightKg?: number }>
  ): Promise<ShipmentRecord | null> {
    const shipment = await this.getById(shipmentId);
    if (!shipment) return null;

    const arrivalMap = new Map<string, { arrived: boolean; arrivedQuantity?: number; arrivedWeightKg?: number }>();
    arrivals.forEach((a) => arrivalMap.set(a.itemId, a));

    if (shipment.items) {
      shipment.items = shipment.items.map((si: ShipmentItem) => {
        const match = arrivalMap.get(si.id);
        if (match) {
          return {
            ...si,
            arrived: match.arrived,
            arrivedQuantity: match.arrivedQuantity !== undefined ? match.arrivedQuantity : si.quantity,
            arrivedWeightKg: match.arrivedWeightKg !== undefined ? match.arrivedWeightKg : si.weightKg,
            arrivedAt: match.arrived ? new Date().toISOString() : undefined
          };
        }
        return si;
      });
    }

    shipment.updatedAt = new Date().toISOString();
    return shipment;
  }

  /**
   * Create master shipment
   */
  static async createShipment(data: {
    trackingNumber?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    productName?: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    recipientAddress?: string;
    originCountry: string;
    originCity: string;
    originAddress?: string;
    originLat?: number;
    originLng?: number;
    destCountry: string;
    destCity: string;
    destAddress?: string;
    destLat?: number;
    destLng?: number;
    mode: 'air' | 'sea' | 'road' | 'hand_carry';
    serviceLevel: 'standard' | 'express' | 'priority';
    totalWeightKg: number;
    totalCbm: number;
    totalPieces: number;
    items?: Array<{
      description: string;
      itemCode?: string;
      packagingType?: string;
      quantity?: number;
      weightKg?: number;
      cbm?: number;
      categoryTag?: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
      declaredValue?: number;
      currency?: string;
    }>;
    estimatedDelivery?: string;
    carrierName?: string;
    voyageOrFlightNumber?: string;
    billOfLadingNumber?: string;
    notes?: string;
  }): Promise<ShipmentRecord> {
    const id = `shp-${Date.now().toString(36)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = data.trackingNumber?.trim()
      ? data.trackingNumber.trim().toUpperCase()
      : `GOSH-${new Date().getFullYear()}-${randomSuffix}`;
    const now = new Date().toISOString();

    const originLat =
      data.originLat ||
      (data.originCity.toLowerCase().includes('guangzhou')
        ? 23.3924
        : data.originCity.toLowerCase().includes('yiwu')
        ? 29.3068
        : 22.5431);
    const originLng =
      data.originLng ||
      (data.originCity.toLowerCase().includes('guangzhou')
        ? 113.2988
        : data.originCity.toLowerCase().includes('yiwu')
        ? 120.0751
        : 114.0579);
    const destLat = data.destLat || (data.destCity.toLowerCase().includes('chittagong') ? 22.3193 : 23.8433);
    const destLng = data.destLng || (data.destCity.toLowerCase().includes('chittagong') ? 91.8105 : 90.4029);

    const defaultItems: ShipmentItem[] =
      data.items && data.items.length > 0
        ? data.items.map((it, idx) => ({
            id: `itm-${id}-${idx}`,
            shipmentId: id,
            itemCode: it.itemCode || `#ITM-${1000 + idx}`,
            description: it.description,
            packagingType: it.packagingType || 'carton',
            quantity: it.quantity || 1,
            weightKg: it.weightKg || data.totalWeightKg,
            cbm: it.cbm || data.totalCbm,
            categoryTag: it.categoryTag || 'Commercial',
            declaredValue: it.declaredValue,
            currency: it.currency || 'BDT'
          }))
        : [
            {
              id: `itm-${id}-0`,
              shipmentId: id,
              itemCode: `#GOSH-${randomSuffix}`,
              description: data.productName || `${data.mode.toUpperCase()} Commercial Cargo Consignment`,
              packagingType: data.mode === 'sea' ? '40ft_hq' : data.mode === 'air' ? 'air_uld' : 'pallet',
              quantity: data.totalPieces,
              weightKg: data.totalWeightKg,
              cbm: data.totalCbm,
              categoryTag: 'Commercial',
              declaredValue: 2450000,
              currency: 'BDT'
            }
          ];

    const initialEvent: ShipmentEvent = {
      id: `evt-${id}-init`,
      shipmentId: id,
      status: 'purchased',
      statusCode: 'purchased',
      statusLabel: 'PURCHASED',
      title: 'PURCHASED',
      description: `Commercial consignment registered and booked from ${data.originCity}, ${data.originCountry} to ${data.destCity}, ${data.destCountry}.`,
      locationName: `${data.originCity} Operations Hub, ${data.originCountry}`,
      eventTime: now,
      occurredAtBst: formatBstDateTime(now),
      lat: originLat,
      lng: originLng,
      source: 'admin',
      visibility: 'public',
      eventVersion: 1
    };

    const newShipment: ShipmentRecord = {
      id,
      trackingNumber,
      productName: data.productName || 'Commercial Freight Cargo',
      customerId: data.customerId || 'usr-customer-01',
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      recipientName: data.recipientName || `${data.customerName} Receiving Hub`,
      recipientPhone: data.recipientPhone || '+880 1711-000000',
      recipientEmail: data.recipientEmail,
      recipientAddress: data.recipientAddress || `${data.destCity}, ${data.destCountry}`,
      originCountry: data.originCountry,
      originCity: data.originCity,
      originAddress: data.originAddress || `${data.originCity} International Terminal`,
      originLat,
      originLng,
      destCountry: data.destCountry,
      destCity: data.destCity,
      destAddress: data.destAddress || `${data.destCity} Cargo Receiving Station`,
      destLat,
      destLng,
      mode: data.mode,
      serviceLevel: data.serviceLevel,
      status: 'purchased',
      statusCode: 'purchased',
      statusLabel: 'PURCHASED',
      paymentStatus: 'pending',
      eventVersion: 1,
      currentLocation: `${data.originCity} Receiving Hub`,
      currentLat: originLat,
      currentLng: originLng,
      totalWeightKg: data.totalWeightKg,
      totalCbm: data.totalCbm,
      totalPieces: data.totalPieces,
      carrierName: data.carrierName || 'GoShipping Logistics Lines',
      voyageOrFlightNumber:
        data.voyageOrFlightNumber ||
        (data.mode === 'air' ? 'Flight GS-701' : data.mode === 'sea' ? 'Vessel GS OCEAN-12' : 'Truck TRC-101'),
      billOfLadingNumber: data.billOfLadingNumber || `BL-${trackingNumber}`,
      departureTime: now,
      estimatedDelivery: data.estimatedDelivery || new Date(Date.now() + 6 * 86400000).toISOString(),
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      lastUpdatedBst: formatBstDateTime(now),
      items: defaultItems,
      events: [initialEvent],
      physicalProgress: {
        completedStagesCount: 1,
        totalStagesCount: 8,
        percentage: 13,
        currentPhysicalStageIndex: 0,
        isComplete: false
      }
    };

    initialShipments.unshift(newShipment);

    // Broadcast new consignment
    RealtimeService.broadcastShipmentUpdate({
      trackingNumber: newShipment.trackingNumber,
      shipmentId: newShipment.id,
      status: newShipment.status,
      statusCode: newShipment.statusCode,
      statusLabel: newShipment.statusLabel,
      paymentStatus: newShipment.paymentStatus,
      version: newShipment.eventVersion,
      updatedAt: newShipment.updatedAt,
      latestEvent: initialEvent
    }).catch(() => {});

    return newShipment;
  }

  /**
   * Update shipment status and atomically record a new verified tracking event
   */
  static async updateStatus(
    shipmentId: string,
    data: {
      status: TrackingStatusCode | string;
      title?: string;
      description?: string;
      locationName?: string;
      lat?: number;
      lng?: number;
      source?: 'warehouse' | 'admin' | 'carrier_api' | 'driver';
      eventTime?: string; // ISO string if specified by admin
      notes?: string;
      visibility?: 'public' | 'internal';
      paymentStatus?: 'pending' | 'payment_received';
    }
  ): Promise<ShipmentRecord | null> {
    const shipment = initialShipments.find((s) => s.id === shipmentId || s.trackingNumber === shipmentId);
    if (!shipment) return null;

    const normalizedCode = normalizeStatusCode(data.status);
    const statusDef = TRACKING_STATUSES[normalizedCode];
    const nowIso = new Date().toISOString();
    const eventTimeIso = data.eventTime ? new Date(data.eventTime).toISOString() : nowIso;
    const eventBst = formatBstDateTime(eventTimeIso);

    // Increment optimistic version
    shipment.eventVersion += 1;

    // Unconditionally update shipment status to the chosen status so UI and live tracker match
    shipment.status = normalizedCode;
    shipment.statusCode = normalizedCode;
    shipment.statusLabel = statusDef.label;

    // Mark payment status if payment_received
    if (normalizedCode === 'payment_received' || data.paymentStatus === 'payment_received') {
      shipment.paymentStatus = 'payment_received';
    }

    if (data.locationName) {
      shipment.currentLocation = data.locationName;
    } else if (statusDef.defaultLocation) {
      shipment.currentLocation = statusDef.defaultLocation;
    }
    if (data.lat !== undefined) shipment.currentLat = data.lat;
    if (data.lng !== undefined) shipment.currentLng = data.lng;

    const eventId = `evt-${crypto.randomBytes(4).toString('hex')}`;
    const newEvent: ShipmentEvent = {
      id: eventId,
      shipmentId: shipment.id,
      status: normalizedCode,
      statusCode: normalizedCode,
      statusLabel: statusDef.label,
      title: data.title || statusDef.label,
      description: data.description || statusDef.defaultDescription,
      locationName: data.locationName || statusDef.defaultLocation,
      eventTime: eventTimeIso,
      occurredAtBst: eventBst,
      lat: data.lat,
      lng: data.lng,
      source: data.source || 'admin',
      visibility: data.visibility || 'public',
      eventVersion: shipment.eventVersion
    };

    // Add event at top of events list
    shipment.events.unshift(newEvent);
    shipment.updatedAt = nowIso;
    shipment.lastUpdatedBst = formatBstDateTime(nowIso);

    // Recalculate physical progress from actual events
    shipment.physicalProgress = calculatePhysicalProgress(shipment.status, shipment.events);

    // Publish to real-time synchronization channels
    RealtimeService.broadcastShipmentUpdate({
      trackingNumber: shipment.trackingNumber,
      shipmentId: shipment.id,
      status: shipment.status,
      statusCode: shipment.statusCode,
      statusLabel: shipment.statusLabel,
      paymentStatus: shipment.paymentStatus,
      version: shipment.eventVersion,
      updatedAt: shipment.updatedAt,
      latestEvent: {
        id: newEvent.id,
        statusCode: newEvent.statusCode,
        statusLabel: newEvent.statusLabel,
        title: newEvent.title,
        description: newEvent.description,
        locationName: newEvent.locationName,
        eventTime: newEvent.eventTime
      }
    }).catch((err) => {
      console.warn('[ShipmentService] Realtime broadcast error:', err.message);
    });

    return shipment;
  }

  /**
   * Legacy wrapper: Add event
   */
  static async addEvent(
    shipmentId: string,
    eventData: {
      status: string;
      title: string;
      description: string;
      locationName: string;
      lat?: number;
      lng?: number;
      source?: 'warehouse' | 'admin' | 'carrier_api';
      eventTime?: string;
    }
  ): Promise<ShipmentRecord | null> {
    return this.updateStatus(shipmentId, eventData);
  }

  /**
   * Delete a shipment (Admin function)
   */
  static async deleteShipment(id: string): Promise<boolean> {
    const index = initialShipments.findIndex((s) => s.id === id || s.trackingNumber === id);
    if (index === -1) return false;
    initialShipments.splice(index, 1);
    return true;
  }

  /**
   * Update shipment details (Admin function)
   */
  static async updateShipment(
    id: string,
    updates: Partial<ShipmentRecord>
  ): Promise<ShipmentRecord | null> {
    const shipment = initialShipments.find((s) => s.id === id || s.trackingNumber === id);
    if (!shipment) return null;

    Object.assign(shipment, updates, { updatedAt: new Date().toISOString() });
    shipment.lastUpdatedBst = formatBstDateTime(shipment.updatedAt);
    return shipment;
  }

  /**
   * Delete tracking event
   */
  static async deleteEvent(shipmentId: string, eventId: string): Promise<boolean> {
    const shipment = initialShipments.find((s) => s.id === shipmentId || s.trackingNumber === shipmentId);
    if (!shipment) return false;

    const eventIndex = shipment.events.findIndex((e) => e.id === eventId);
    if (eventIndex === -1) return false;

    shipment.events.splice(eventIndex, 1);
    shipment.updatedAt = new Date().toISOString();
    shipment.lastUpdatedBst = formatBstDateTime(shipment.updatedAt);
    shipment.physicalProgress = calculatePhysicalProgress(shipment.status, shipment.events);
    return true;
  }
}
