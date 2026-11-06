import SearchableSelect, { type SearchableSelectOption } from "./SearchableSelect";
import { ReferenceSelect } from "./ReferenceSelect";
import BannersManager from './BannersManager';
import TestimonialsManager from './TestimonialsManager';
import PosLedgerTerminal from './PosLedgerTerminal';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ShipmentRecord, ShipmentItem } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';
import type { WarehouseRecord } from '../../server/services/warehouse.service';
import { TRACKING_STATUSES, normalizeStatusCode, calculatePhysicalProgress, type TrackingStatusCode } from '../../server/services/tracking-status';
import { DESTINATION_ADDRESS_CONFIGS, PHONE_DIAL_CODES } from '../marketing/shippingLocations';
import { downloadInvoicePDF, SETTLEMENT_BANKS, type SettlementBankInfo } from '../../lib/invoicePdf';
import {
  StatCardSkeleton,
  OverviewSkeleton,
  TableTabSkeleton,
  WarehousesSkeleton,
  InvoicesTabSkeleton
} from '../common/DashboardSkeleton';

interface CustomerItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  activeShipmentsCount: number;
  totalQuotesCount: number;
  tier: string;
}

interface AuditItem {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
  details?: any;
}

export interface OrderItemForm {
  id: string;
  description: string;
  packagingType: string;
  categoryTag: 'Commercial' | 'General' | 'Electronics' | 'Liquids' | 'Dangerous' | 'Perishable';
  quantity: number;
  weightKg: number;
  cbm: number;
  declaredValue?: number;
}


const PACKAGE_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'air_uld', label: 'Air ULD (LD3 / Contour Container)', badge: 'Air' },
  { value: 'carton', label: 'Carton (Corrugated Export Box)', badge: 'Common' },
  { value: 'wooden_crate', label: 'Wooden Crate (Heavy / Fragile Cargo)' },
  { value: 'pallet', label: 'Pallet (Plastic / Heat-Treated Wood)' },
  { value: 'container_20ft', label: '20ft FCL Container', badge: 'Sea' },
  { value: 'container_40ft', label: '40ft HQ Container', badge: 'Sea' },
  { value: 'gunny_bag', label: 'Gunny / Poly Bag', badge: 'Parcel' },
  { value: 'drum', label: 'Steel / Plastic Drum Container' },
  { value: 'loose', label: 'Loose Cargo (Unpackaged)' }
];

const CATEGORY_OPTIONS: SearchableSelectOption[] = [
  { value: 'Commercial', label: 'Commercial Cargo (General Goods)' },
  { value: 'Garments', label: 'Garments & Fashion Apparel' },
  { value: 'Textiles', label: 'Fabric Rolls & Raw Textiles' },
  { value: 'Electronics', label: 'Consumer Electronics & Gadgets' },
  { value: 'Liquids', label: 'Liquids & Cosmetics (Permitted)' },
  { value: 'Dangerous', label: 'Dangerous Goods (Battery / DG)' },
  { value: 'Perishable', label: 'Perishable & Cold Chain' },
  { value: 'Machinery', label: 'Industrial Machinery & Spare Parts' }
];

const ORIGIN_OPTIONS: SearchableSelectOption[] = [
  { value: 'Guangzhou', label: 'Guangzhou (CAN Hub)', badge: 'China' },
  { value: 'Yiwu', label: 'Yiwu (YIW Trade City Hub)', badge: 'China' },
  { value: 'Shenzhen', label: 'Shenzhen (SZX Port & Airport)', badge: 'China' },
  { value: 'Shanghai', label: 'Shanghai (PVG Pudong Hub)', badge: 'China' },
  { value: 'Hong Kong', label: 'Hong Kong (HKG Freight Hub)', badge: 'China' }
];

const DESTINATION_OPTIONS: SearchableSelectOption[] = [
  { value: 'Dhaka', label: 'Dhaka (HSIA Airport Hub / Kurmitola)', badge: 'BD' },
  { value: 'Chittagong', label: 'Chittagong (Seaport CFS / Patenga)', badge: 'BD' },
  { value: 'Tejgaon', label: 'Dhaka Central (Tejgaon ICD)', badge: 'BD' },
  { value: 'Savar', label: 'Dhaka North (DEPZ Savar Hub)', badge: 'BD' }
];

const ORDER_STATUS_CONFIG: Record<
  TrackingStatusCode,
  {
    label: string;
    shortLabel: string;
    stepNumber: number;
    badgeClass: string;
    dotClass: string;
    description: string;
  }
> = {
  purchased: {
    label: 'Purchased / Order Created',
    shortLabel: 'Purchased',
    stepNumber: 1,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100 hover:border-slate-300',
    dotClass: 'bg-slate-400',
    description: 'Manifest created, awaiting hub delivery'
  },
  cn_warehouse_received: {
    label: 'CN Warehouse Received',
    shortLabel: 'CN Received',
    stepNumber: 2,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/90 hover:bg-blue-100/70 hover:border-blue-300',
    dotClass: 'bg-blue-500',
    description: 'Measured & sorted at Guangzhou/Yiwu hub'
  },
  dispatched_from_china: {
    label: 'Dispatched from China',
    shortLabel: 'Dispatched (CN)',
    stepNumber: 3,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/90 hover:bg-indigo-100/70 hover:border-indigo-300',
    dotClass: 'bg-indigo-500',
    description: 'Departed China via international carrier'
  },
  arrived_dhaka_airport: {
    label: 'Arrived Dhaka Airport',
    shortLabel: 'Arrived (DAC)',
    stepNumber: 4,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/90 hover:bg-purple-100/70 hover:border-purple-300',
    dotClass: 'bg-purple-500',
    description: 'Touched down at Dhaka HSIA Cargo Terminal'
  },
  awaiting_customs: {
    label: 'Awaiting Customs Clearance',
    shortLabel: 'Customs Clearance',
    stepNumber: 5,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90 hover:bg-amber-100/70 hover:border-amber-300',
    dotClass: 'bg-amber-500 animate-pulse',
    description: 'Under customs appraisal & duty assessment'
  },
  bd_warehouse_received: {
    label: 'BD Warehouse Received',
    shortLabel: 'BD Received',
    stepNumber: 6,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/90 hover:bg-sky-100/70 hover:border-sky-300',
    dotClass: 'bg-sky-500',
    description: 'Released from customs and sorted in Dhaka hub'
  },
  payment_received: {
    label: 'Payment Received',
    shortLabel: 'Payment Cleared',
    stepNumber: 7,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 hover:bg-emerald-100/70 hover:border-emerald-300',
    dotClass: 'bg-emerald-500',
    description: 'Tariffs and handling charges settled in full'
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    shortLabel: 'Out for Delivery',
    stepNumber: 8,
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200/90 hover:bg-orange-100/70 hover:border-orange-300',
    dotClass: 'bg-orange-500',
    description: 'Courier van dispatched for doorstep delivery'
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    stepNumber: 9,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400',
    dotClass: 'bg-emerald-600',
    description: 'Delivered to consignee with proof of delivery'
  }
};

interface StatusQuickDropdownProps {
  shipmentId: string;
  currentStatus: string;
  onUpdate: (id: string, newStatus: string) => Promise<void> | void;
  openUpward?: boolean;
}

function StatusQuickDropdown({
  shipmentId,
  currentStatus,
  onUpdate,
  openUpward = false
}: StatusQuickDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalized = normalizeStatusCode(currentStatus);
  const activeConfig = ORDER_STATUS_CONFIG[normalized] || ORDER_STATUS_CONFIG.purchased;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (code: TrackingStatusCode) => {
    if (code === normalized) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    setIsOpen(false);
    try {
      await onUpdate(shipmentId, code);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium border shadow-2xs transition-colors cursor-pointer select-none ${
          activeConfig.badgeClass
        } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        title="Click to update shipment stage"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeConfig.dotClass}`} />
        <span className="truncate max-w-[150px] sm:max-w-[185px]">{activeConfig.label}</span>
        <svg
          className={`w-3 h-3 text-current opacity-60 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 w-72 rounded-lg bg-white shadow-xl border border-slate-200 py-1 text-xs text-slate-800 left-0 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Update Live Tracking Stage</span>
            <span className="font-mono text-[9px] text-slate-400">9 stages</span>
          </div>

          <div className="max-h-64 overflow-y-auto py-0.5 divide-y divide-slate-50">
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => {
              const isSelected = key === normalized;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(key as TrackingStatusCode)}
                  className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-red-50/40 text-slate-900 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${config.dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate ${isSelected ? 'font-semibold text-slate-900' : 'font-normal'}`}>
                        {config.label}
                      </span>
                      {isSelected && (
                        <svg
                          className="w-3.5 h-3.5 text-[#EA1D2C] shrink-0 ml-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface UserRowActionMenuProps {
  user: any;
  onImpersonate: (id: string, name: string) => void;
  onEdit: (u: any) => void;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string, name: string) => void;
  openUpward?: boolean;
}

function UserRowActionMenu({
  user,
  onImpersonate,
  onEdit,
  onToggleStatus,
  onDelete,
  openUpward = false
}: UserRowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-right" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
        title="Admin actions menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-52 rounded-lg bg-white shadow-xl border border-slate-200 py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Admin Actions</span>
            <span className="font-mono text-[9px] text-slate-400">Account</span>
          </div>

          <div className="py-1">
            {/* 1. Ghost Login (Impersonate) */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onImpersonate(user.id, user.fullName);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-800 font-medium transition-colors cursor-pointer group"
            >
              <svg className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" viewBox="0 0 24 24">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <div>
                <span className="block text-xs font-semibold text-slate-900 group-hover:text-[#EA1D2C] transition-colors">Login as User</span>
                <span className="block text-[10px] text-slate-400">Masquerade session</span>
              </div>
            </button>

            {/* 2. Edit Profile */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEdit(user);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="text-xs">Edit User Profile</span>
            </button>

            {/* 3. Suspend / Activate */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onToggleStatus(user.id, user.status);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              {user.status === 'active' ? (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  <span className="text-xs text-amber-700">Suspend Account</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span className="text-xs text-emerald-700">Activate Account</span>
                </>
              )}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-1">
            {/* 4. Delete User */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onDelete(user.id, user.fullName);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-red-500 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span className="text-xs font-medium">Delete Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOperationsIsland({ initialTab = 'overview' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'pos_ledger' || initialTab === 'ledger') return 'orders';
    return initialTab;
  });
  const [ordersSubView, setOrdersSubView] = useState<'sourcing' | 'freight'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      const t = params.get('tab');
      if (v === 'freight' || t === 'shipments' || t === 'tracking') return 'freight';
      if (v === 'sourcing' || t === 'pos_ledger' || t === 'ledger') return 'sourcing';
    }
    if (initialTab === 'pos_ledger' || initialTab === 'ledger') return 'sourcing';
    return 'sourcing';
  });
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter for shipments
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentModeFilter, setShipmentModeFilter] = useState('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');

  // Search & filter for quotes
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('all');

  // Search & filter for invoices
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoicePaidOverrides, setInvoicePaidOverrides] = useState<Record<string, boolean>>({});
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [selectedSettlementBankId, setSelectedSettlementBankId] = useState<string>('scb-bd');
  const [customBankDetails, setCustomBankDetails] = useState<SettlementBankInfo>({
    id: 'custom',
    bankName: 'City Bank PLC',
    accountName: 'GoShipping Logistics Bangladesh Ltd.',
    accountNumber: '1102938475001',
    branch: 'Corporate Banking Branch, Gulshan-2, Dhaka',
    routingNumber: '225261890',
    swiftCode: 'CIBLBDDH',
    currency: 'BDT',
    binNumber: '004819273-0101',
    taxNote: 'Mushak 6.3 Tax Compliant',
    country: 'GLOBAL'
  });
  const [isEditingBank, setIsEditingBank] = useState<boolean>(false);

  const currentSettlementBank: SettlementBankInfo = useMemo(() => {
    if (selectedSettlementBankId === 'custom') {
      return customBankDetails;
    }
    const found = SETTLEMENT_BANKS.find(b => b.id === selectedSettlementBankId);
    return found || SETTLEMENT_BANKS[0];
  }, [selectedSettlementBankId, customBankDetails]);

  // Modals state
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedQuoteForPricing, setSelectedQuoteForPricing] = useState<QuoteRecord | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 3000);
  };

  // Live Invoices state from server
  const [serverInvoices, setServerInvoices] = useState<any[]>([]);

  // Selective Product Invoicing & Payment Collection (In-Page Studio, no popup)
  const [invoiceSubView, setInvoiceSubView] = useState<'list' | 'generate'>('list');
  const [selectedShipmentForInvoice, setSelectedShipmentForInvoice] = useState<ShipmentRecord | null>(null);
  const [invoiceSelectedItems, setInvoiceSelectedItems] = useState<Record<string, boolean>>({});
  const [invoiceItemArrivedQtys, setInvoiceItemArrivedQtys] = useState<Record<string, number>>({});
  const [invoiceItemArrivedWeights, setInvoiceItemArrivedWeights] = useState<Record<string, number>>({});
  const [invoiceRatePerKg, setInvoiceRatePerKg] = useState<number>(750);
  const [invoiceCustomNumber, setInvoiceCustomNumber] = useState<string>('');
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>('');
  const [invoicePaymentStatus, setInvoicePaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<string>('Bank Wire (EFT / RTGS)');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  // Convert Quote to Shipment Modal (with budget negotiation and full editing)
  const [showConvertQuoteModal, setShowConvertQuoteModal] = useState(false);
  const [selectedQuoteForConvert, setSelectedQuoteForConvert] = useState<QuoteRecord | null>(null);
  const [convertNegotiatedPrice, setConvertNegotiatedPrice] = useState<number>(0);
  const [convertCurrency, setConvertCurrency] = useState<string>('BDT');
  const [convertPricingNotes, setConvertPricingNotes] = useState<string>('');
  const [convertMode, setConvertMode] = useState<'air' | 'sea' | 'road' | 'hand_carry'>('air');
  const [convertServiceLevel, setConvertServiceLevel] = useState<'standard' | 'express' | 'priority'>('express');
  const [convertOriginCountry, setConvertOriginCountry] = useState<string>('China');
  const [convertOriginCity, setConvertOriginCity] = useState<string>('Guangzhou');
  const [convertDestCountry, setConvertDestCountry] = useState<string>('Bangladesh');
  const [convertDestCity, setConvertDestCity] = useState<string>('Dhaka');
  const [convertCargoDescription, setConvertCargoDescription] = useState<string>('');
  const [convertProductName, setConvertProductName] = useState<string>('');
  const [convertTotalWeightKg, setConvertTotalWeightKg] = useState<number>(0);
  const [convertTotalCbm, setConvertTotalCbm] = useState<number>(0);
  const [convertQuantity, setConvertQuantity] = useState<number>(1);
  const [convertPackagingType, setConvertPackagingType] = useState<string>('carton');
  const [convertRecipientName, setConvertRecipientName] = useState<string>('');
  const [convertRecipientPhone, setConvertRecipientPhone] = useState<string>('');
  const [convertRecipientAddress, setConvertRecipientAddress] = useState<string>('');
  const [convertCarrierName, setConvertCarrierName] = useState<string>('');
  const [convertVoyageOrFlight, setConvertVoyageOrFlight] = useState<string>('');
  const [convertItems, setConvertItems] = useState<Array<{
    description: string;
    itemCode?: string;
    packagingType?: string;
    quantity: number;
    weightKg: number;
    cbm: number;
    categoryTag: 'General' | 'Commercial' | 'Liquids' | 'Dangerous' | 'Perishable' | 'Electronics';
  }>>([]);
  const [isConvertingQuote, setIsConvertingQuote] = useState(false);

  // New Consignment Form State
  const [newCustName, setNewCustName] = useState('');
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientAddress, setNewRecipientAddress] = useState('');
  const [newOriginCountry, setNewOriginCountry] = useState('China');
  const [newOriginCity, setNewOriginCity] = useState('Guangzhou');
  const [newDestCountry, setNewDestCountry] = useState('Bangladesh');
  const [newDestCity, setNewDestCity] = useState('Dhaka');
  const [newMode, setNewMode] = useState<'air' | 'sea' | 'hand_carry'>('air');
  const [newServiceLevel, setNewServiceLevel] = useState<'standard' | 'express' | 'priority'>('express');
  const [newCarrier, setNewCarrier] = useState('');
  const [newVoyage, setNewVoyage] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Section 4: Dynamic Structured Delivery Address State
  const [recipientContactName, setRecipientContactName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [recipientState, setRecipientState] = useState('Dhaka Division');
  const [recipientCity, setRecipientCity] = useState('Dhaka');
  const [recipientPostcode, setRecipientPostcode] = useState('');
  const [recipientPhoneCode, setRecipientPhoneCode] = useState('+880');
  const [recipientPhoneBody, setRecipientPhoneBody] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const currentAddressConfig = DESTINATION_ADDRESS_CONFIGS[newDestCountry] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
  const currentStates = currentAddressConfig.states;
  const matchedStateObj = currentStates.find((s) => s.name === recipientState) || currentStates[0];
  const currentAvailableCities = matchedStateObj ? matchedStateObj.cities : [recipientCity];

  const compiledAddress = useMemo(() => {
    return [
      addressLine1.trim(),
      addressLine2.trim(),
      recipientCity.trim(),
      recipientState.trim(),
      recipientPostcode.trim(),
      newDestCountry
    ].filter(Boolean).join(', ');
  }, [addressLine1, addressLine2, recipientCity, recipientState, recipientPostcode, newDestCountry]);

  const compiledPhone = useMemo(() => {
    if (!recipientPhoneBody.trim()) return '';
    return `${recipientPhoneCode} ${recipientPhoneBody.trim()}`.trim();
  }, [recipientPhoneCode, recipientPhoneBody]);

  const handleCountryChange = (country: string) => {
    setNewDestCountry(country);
    const config = DESTINATION_ADDRESS_CONFIGS[country] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
    const defaultState = config.states[0]?.name || '';
    const defaultCity = config.states[0]?.cities[0] || '';
    setRecipientState(defaultState);
    setRecipientCity(defaultCity);
    setNewDestCity(defaultCity);
    setAddressLine1('');
    setAddressLine2('');
    setRecipientPostcode('');
    setRecipientPhoneCode(config.dialCode);
    setRecipientPhoneBody('');
  };

  const handleStateChange = (stateName: string) => {
    setRecipientState(stateName);
    const config = DESTINATION_ADDRESS_CONFIGS[newDestCountry] || DESTINATION_ADDRESS_CONFIGS.Bangladesh;
    const stateObj = config.states.find((s) => s.name === stateName);
    if (stateObj && stateObj.cities.length > 0) {
      const firstCity = stateObj.cities[0];
      setRecipientCity(firstCity);
      setNewDestCity(firstCity);
    }
  };

  // Dynamic Multi-Product Line Items
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([
    {
      id: 'item-1',
      description: '',
      packagingType: 'carton',
      categoryTag: 'Commercial',
      quantity: '' as any,
      weightKg: '' as any,
      cbm: '' as any,
      declaredValue: '' as any
    }
  ]);

  const addOrderItem = () => {
    const nextId = `item-${Date.now().toString(36)}-${orderItems.length + 1}`;
    setOrderItems((prev) => [
      ...prev,
      {
        id: nextId,
        description: '',
        packagingType: 'carton',
        categoryTag: 'Commercial',
        quantity: '' as any,
        weightKg: '' as any,
        cbm: '' as any,
        declaredValue: '' as any
      }
    ]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length <= 1) {
      alert('At least one product item is required for the consignment.');
      return;
    }
    setOrderItems((prev) => prev.filter((it) => it.id !== id));
  };

  const duplicateOrderItem = (item: OrderItemForm) => {
    const nextId = `item-${Date.now().toString(36)}-${orderItems.length + 1}`;
    setOrderItems((prev) => [
      ...prev,
      {
        ...item,
        id: nextId,
        description: item.description ? `${item.description} (Copy)` : ''
      }
    ]);
  };

  const updateOrderItem = (id: string, field: keyof OrderItemForm, value: any) => {
    setOrderItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // Live Auto-Calculated Totals across all products
  const orderTotals = useMemo(() => {
    const totalPieces = orderItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const totalWeight = orderItems.reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);
    const totalCbm = orderItems.reduce((acc, it) => acc + (Number(it.cbm) || 0), 0);
    const totalDeclaredValue = orderItems.reduce((acc, it) => acc + (Number(it.declaredValue) || 0), 0);
    const volumetricWeight = Math.round(totalCbm * 167);
    const chargeableWeight = Math.max(totalWeight, volumetricWeight);

    return {
      totalItems: orderItems.length,
      totalPieces,
      totalWeight: Number(totalWeight.toFixed(2)),
      totalCbm: Number(totalCbm.toFixed(2)),
      volumetricWeight,
      chargeableWeight: Number(chargeableWeight.toFixed(2)),
      totalDeclaredValue
    };
  }, [orderItems]);

  const [submittingConsignment, setSubmittingConsignment] = useState(false);

  // Live Tracking Quick Control & Feedback
  const [createdShipmentResult, setCreatedShipmentResult] = useState<{
    trackingNumber: string;
    customerName: string;
    route: string;
    mode: string;
  } | null>(null);
  const [liveStatusFeedback, setLiveStatusFeedback] = useState<{
    trackingNumber: string;
    newStatus: string;
    statusLabel: string;
  } | null>(null);
  const [newCustomTrackingNumber, setNewCustomTrackingNumber] = useState('');
  const [newInitialStatus, setNewInitialStatus] = useState<string>('purchased');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Quick Status Updater in Dashboard Overview
  const [quickShipmentId, setQuickShipmentId] = useState<string>('');
  const [quickTargetStage, setQuickTargetStage] = useState<string>('arrived_dhaka_airport');
  const [updatingQuickStage, setUpdatingQuickStage] = useState(false);

  // Pricing Form State
  const [baseFreight, setBaseFreight] = useState('175000');
  const [fuelSurcharge, setFuelSurcharge] = useState('14500');
  const [customsClearanceFee, setCustomsClearanceFee] = useState('10500');
  const [handlingFee, setHandlingFee] = useState('6000');
  const [pricingNotes, setPricingNotes] = useState('Door-to-door delivery with pre-cleared customs at HSIA Dhaka.');
  const [submittingPricing, setSubmittingPricing] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Add / Edit User Form State
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('password');
  const [userRole, setUserRole] = useState('customer');
  const [userStatus, setUserStatus] = useState('active');
  const [userPhone, setUserPhone] = useState('');
  const [userCompanyName, setUserCompanyName] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userBin, setUserBin] = useState('');
  const [submittingUser, setSubmittingUser] = useState(false);

  // Warehouse Facility Management State
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [showEditWarehouseModal, setShowEditWarehouseModal] = useState(false);
  const [showDeleteWarehouseModal, setShowDeleteWarehouseModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseRecord | null>(null);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseCountryFilter, setWarehouseCountryFilter] = useState('all');
  const [submittingWarehouse, setSubmittingWarehouse] = useState(false);
  const [deletingWarehouse, setDeletingWarehouse] = useState(false);

  // Warehouse Form State
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whCountry, setWhCountry] = useState('China');
  const [whCity, setWhCity] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whContactPerson, setWhContactPerson] = useState('');
  const [whPhone, setWhPhone] = useState('');
  const [whEmail, setWhEmail] = useState('');
  const [whCapacitySqft, setWhCapacitySqft] = useState(25000);
  const [whCurrentOccupancyPct, setWhCurrentOccupancyPct] = useState(50);
  const [whIsActive, setWhIsActive] = useState(true);

  // New Consignment Customer Link & Real-time Selection State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderCustomerMode, setOrderCustomerMode] = useState<'existing' | 'new'>('existing');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [newCustomerFullName, setNewCustomerFullName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerPassword, setNewCustomerPassword] = useState('');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');

  // Dynamic Shipping Routes & Fulfillment Configuration State
  const [adminShippingConfig, setAdminShippingConfig] = useState<any>(null);
  const [savingShippingConfig, setSavingShippingConfig] = useState(false);
  const [shippingConfigSuccessMsg, setShippingConfigSuccessMsg] = useState<string | null>(null);

  // Customer Filtering & Live Selection Mappings
  const filteredCustomersForOrder = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const comp = (u.companyName || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || comp.includes(q) || phone.includes(q);
    });
  }, [users, customerSearchQuery]);

  const allCustomerOptions = useMemo(() => {
    const staffRoles = ['super_admin', 'ops_manager', 'warehouse_staff', 'sales_team', 'support_agent'];
    const isStaff = (r?: string) => staffRoles.includes(r || '');

    const customerUsers = users.filter((u) => u.role === 'customer' || (!isStaff(u.role) && !u.role));
    const validCustomers = customers.filter((c) => c.role === 'customer' || (!isStaff(c.role) && !c.role));

    const seen = new Set<string>();
    const combined: any[] = [];
    for (const item of [...customerUsers, ...validCustomers]) {
      const key = item.id || item.email?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    if (combined.length > 0) return combined;
    return [
      { id: 'usr-customer-01', fullName: 'Farhan Ahmed', companyName: 'Apex Textiles Ltd', email: 'farhan@apextextiles.com', phone: '+880 1711-223344', role: 'customer', address: 'Export Processing Zone, Savar, Dhaka 1349, Bangladesh' },
      { id: 'usr-customer-02', fullName: 'Shakil Mahmud', companyName: 'Standard Composite Mills', email: 'shakil@standardcomposite.com', phone: '+880 1819-334455', role: 'customer', address: 'Industrial Area, Baizid Bostami Road, Chittagong, Bangladesh' },
      { id: 'usr-customer-03', fullName: 'Tasnim Hasan', companyName: 'Meghna Knitwear Cargo', email: 'tasnim@meghnaknit.com', phone: '+880 1912-445566', role: 'customer', address: 'Plot 14, Sector 7, Uttara Model Town, Dhaka 1230, Bangladesh' }
    ];
  }, [users, customers]);

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((wh) => {
      if (warehouseCountryFilter !== 'all' && wh.country.toLowerCase() !== warehouseCountryFilter.toLowerCase()) {
        return false;
      }
      if (!warehouseSearch.trim()) return true;
      const q = warehouseSearch.trim().toLowerCase();
      return (
        wh.code.toLowerCase().includes(q) ||
        wh.name.toLowerCase().includes(q) ||
        wh.city.toLowerCase().includes(q) ||
        wh.country.toLowerCase().includes(q) ||
        wh.address.toLowerCase().includes(q) ||
        (wh.contactPerson && wh.contactPerson.toLowerCase().includes(q))
      );
    });
  }, [warehouses, warehouseCountryFilter, warehouseSearch]);

  const activeChinaWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.country.toLowerCase() === 'china' && w.isActive);
  }, [warehouses]);

  const originWarehouseList = useMemo(() => {
    if (activeChinaWarehouses.length > 0) return activeChinaWarehouses;
    return [
      {
        id: 'wh-can-01',
        code: 'CAN-GZ',
        name: 'Guangzhou Central Receiving & Intake Hub',
        country: 'China',
        city: 'Guangzhou',
        address: '765, Sanyuanli Avenue, Baiyun District, Guangzhou (广州市白云区三元里大道765号)',
        contactPerson: 'Warehouse Intake Lead',
        phone: '+86 20 8888 1234',
        email: 'gz.ops@goshipping.com.bd',
        capacitySqft: 50000,
        currentOccupancyPct: 65,
        isActive: true
      }
    ];
  }, [activeChinaWarehouses]);

  const selectedOriginWarehouse = useMemo(() => {
    return (
      originWarehouseList.find((w) => w.city.toLowerCase() === newOriginCity.toLowerCase()) ||
      originWarehouseList[0]
    );
  }, [originWarehouseList, newOriginCity]);

  const destinationHubList = useMemo(() => {
    const list: { key: string; label: string; country: string; city: string; warehouse: WarehouseRecord }[] = [];

    // Bangladesh
    const bdWhs = warehouses.filter((w) => w.country.toLowerCase() === 'bangladesh' && w.isActive);
    if (bdWhs.length > 0) {
      bdWhs.forEach((w) => {
        list.push({
          key: `Bangladesh:${w.city}`,
          label: w.city === 'Dhaka' ? 'Dhaka' : w.city,
          country: 'Bangladesh',
          city: w.city,
          warehouse: w
        });
      });
    } else {
      list.push({
        key: 'Bangladesh:Dhaka',
        label: 'Dhaka',
        country: 'Bangladesh',
        city: 'Dhaka',
        warehouse: {
          id: 'wh-dac-01',
          code: 'DAC-HUB',
          name: 'Dhaka Central Hub & Pickup Point',
          country: 'Bangladesh',
          city: 'Dhaka',
          address: '43/31, Sabujkanon, Dhaka- 1214, Bangladesh',
          contactPerson: 'Kamal Hossain',
          phone: '+880 1711 223344',
          email: 'dhaka.hub@goshipping.com.bd',
          capacitySqft: 25000,
          currentOccupancyPct: 68,
          isActive: true
        }
      });
    }

    // Malaysia
    const myWhs = warehouses.filter((w) => w.country.toLowerCase() === 'malaysia' && w.isActive);
    if (myWhs.length > 0) {
      myWhs.forEach((w) => {
        list.push({
          key: `Malaysia:${w.city}`,
          label: 'Malaysia',
          country: 'Malaysia',
          city: w.city,
          warehouse: w
        });
      });
    } else {
      list.push({
        key: 'Malaysia:Selangor',
        label: 'Malaysia',
        country: 'Malaysia',
        city: 'Selangor',
        warehouse: {
          id: 'wh-my-01',
          code: 'MY-KUL',
          name: 'Malaysia Receiving & Logistics Hub',
          country: 'Malaysia',
          city: 'Selangor',
          address: 'Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor.',
          contactPerson: 'GoShipping Malaysia Ops',
          phone: '+60 11-1234 5678',
          email: 'my.ops@goshipping.com.bd',
          capacitySqft: 35000,
          currentOccupancyPct: 42,
          isActive: true
        }
      });
    }

    return list;
  }, [warehouses]);

  const selectedDestWarehouse = useMemo(() => {
    const matched = destinationHubList.find(
      (opt) =>
        opt.country.toLowerCase() === newDestCountry.toLowerCase() &&
        (opt.city.toLowerCase() === newDestCity.toLowerCase() || opt.country.toLowerCase() === 'malaysia')
    );
    return matched?.warehouse || destinationHubList[0]?.warehouse;
  }, [destinationHubList, newDestCountry, newDestCity]);

  const activeDestWarehouses = useMemo(() => {
    return warehouses.filter((w) => w.country.toLowerCase() === newDestCountry.toLowerCase() && w.isActive);
  }, [warehouses, newDestCountry]);

  const customerSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return allCustomerOptions.map((cust) => ({
      value: cust.id,
      label: cust.companyName ? `${cust.companyName} (${cust.fullName})` : cust.fullName,
      sublabel: `${cust.email} · ${cust.phone || 'No phone recorded'}`,
      badge: cust.role || 'customer'
    }));
  }, [allCustomerOptions]);

  const currentSelectedCustomer = useMemo(() => {
    return (
      users.find((u) => u.id === selectedCustomerId) ||
      customers.find((c) => c.id === selectedCustomerId) ||
      allCustomerOptions.find((c) => c.id === selectedCustomerId)
    );
  }, [users, customers, selectedCustomerId, allCustomerOptions]);

  const selectCustomerForOrder = (target: any) => {
    setSelectedCustomerId(target.id);
    setNewCustName(target.companyName || target.fullName || '');
    setNewRecipientName(target.fullName || '');
    setRecipientContactName(target.fullName || target.companyName || '');
    if (target.phone) {
      setNewRecipientPhone(target.phone);
      const cleaned = target.phone.replace(/\s+/g, '');
      if (cleaned.startsWith('+880')) {
        setRecipientPhoneCode('+880');
        setRecipientPhoneBody(cleaned.slice(4));
      } else if (cleaned.startsWith('+60')) {
        setRecipientPhoneCode('+60');
        setRecipientPhoneBody(cleaned.slice(3));
      } else if (cleaned.startsWith('+86')) {
        setRecipientPhoneCode('+86');
        setRecipientPhoneBody(cleaned.slice(3));
      } else {
        setRecipientPhoneBody(target.phone);
      }
    }
    if (target.address) {
      setNewRecipientAddress(target.address);
      setAddressLine1(target.address);
    }
    setIsCustomerDropdownOpen(false);
  };

  // Email Diagnostics State
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('ops@goshipping.com.bd');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [copiedDnsField, setCopiedDnsField] = useState<string | null>(null);

  const copyDnsValue = (text: string, fieldId: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedDnsField(fieldId);
      setTimeout(() => setCopiedDnsField(null), 2500);
    }
  };

  // Admin Self-Profile State
  const [adminProfileName, setAdminProfileName] = useState('');
  const [adminProfileEmail, setAdminProfileEmail] = useState('');
  const [adminProfilePhone, setAdminProfilePhone] = useState('');
  const [adminProfileCompany, setAdminProfileCompany] = useState('');
  const [adminProfilePassword, setAdminProfilePassword] = useState('');
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);
  const [adminProfileSuccessMsg, setAdminProfileSuccessMsg] = useState('');
  const [adminProfileError, setAdminProfileError] = useState('');

  const loadAdminProfile = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setAdminProfileName(data.user.fullName || '');
        setAdminProfileEmail(data.user.email || '');
        setAdminProfilePhone(data.user.phone || '');
        setAdminProfileCompany(data.user.companyName || '');
      }
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'settings' || activeTab === 'profile') {
      loadAdminProfile();
    }
  }, [activeTab]);

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdminProfile(true);
    setAdminProfileSuccessMsg('');
    setAdminProfileError('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: adminProfileName,
          email: adminProfileEmail,
          phone: adminProfilePhone,
          companyName: adminProfileCompany,
          ...(adminProfilePassword ? { password: adminProfilePassword } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update admin profile');
      setAdminProfileSuccessMsg('Admin profile information updated successfully!');
      setAdminProfilePassword('');
      setTimeout(() => setAdminProfileSuccessMsg(''), 4000);
      loadAdminProfile();
      loadData();
    } catch (err: any) {
      setAdminProfileError(err.message || 'Error updating profile');
    } finally {
      setSavingAdminProfile(false);
    }
  };

  const handleSaveShippingConfig = async () => {
    if (!adminShippingConfig) return;
    setSavingShippingConfig(true);
    setShippingConfigSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/shipping-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminShippingConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
      setShippingConfigSuccessMsg('Shipping configuration updated successfully.');
      showToast('Shipping configuration and fulfillment rules updated', 'success');
      setTimeout(() => setShippingConfigSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Error saving shipping configuration: ${err.message}`);
    } finally {
      setSavingShippingConfig(false);
    }
  };

  // Sync tab & view with URL
  useEffect(() => {
    const handleUrlChange = () => {
      const url = new URL(window.location.href);
      let tabParam = url.searchParams.get('tab');
      const viewParam = url.searchParams.get('view');
      if (tabParam === 'email') {
        setActiveTab('overview');
        url.searchParams.set('tab', 'overview');
        window.history.replaceState({}, '', url.toString());
        return;
      }
      if (tabParam === 'pos_ledger' || tabParam === 'ledger') {
        tabParam = 'orders';
        setOrdersSubView('sourcing');
      }
      if (tabParam && tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
      if (viewParam === 'sourcing' || viewParam === 'freight') {
        setOrdersSubView(viewParam);
      } else if (tabParam === 'shipments' || tabParam === 'tracking') {
        setOrdersSubView('freight');
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);

    const handleCustomSwitch = (e: any) => {
      const detail = e.detail;
      const targetTab = typeof detail === 'string' ? detail : detail?.tab;
      const targetView = typeof detail === 'object' ? detail?.view : undefined;
      if (targetTab === 'pos_ledger' || targetTab === 'ledger') {
        setActiveTab('orders');
        setOrdersSubView('sourcing');
      } else if (targetTab && targetTab !== activeTab) {
        setActiveTab(targetTab);
      }
      if (targetView === 'sourcing' || targetView === 'freight') {
        setOrdersSubView(targetView);
      }
    };
    window.addEventListener('switch-dashboard-tab', handleCustomSwitch);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('switch-dashboard-tab', handleCustomSwitch);
    };
  }, [activeTab]);

  const switchOrdersView = (view: 'sourcing' | 'freight') => {
    setOrdersSubView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'orders');
    url.searchParams.set('view', view);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: { tab: 'orders', view } }));
  };

  const switchTab = (tab: string, view?: 'sourcing' | 'freight') => {
    const normalizedTab = (tab === 'pos_ledger' || tab === 'ledger') ? 'orders' : tab;
    const effectiveView = view || ((tab === 'pos_ledger' || tab === 'ledger') ? 'sourcing' : (tab === 'shipments' || tab === 'tracking') ? 'freight' : undefined);
    
    setActiveTab(normalizedTab);
    if (effectiveView) {
      setOrdersSubView(effectiveView);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', normalizedTab);
    if (effectiveView) {
      url.searchParams.set('view', effectiveView);
    } else {
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: { tab: normalizedTab, view: effectiveView } }));
  };

  const loadData = async (manualSync = false) => {
    setLoading(true);
    if (manualSync) setSyncState('syncing');
    try {
      const t = Date.now();
      const fetchOpts: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };

      const [resShip, resQte, resWh, resCust, resAudit, resUsers, resConfig, resInv] = await Promise.all([
        fetch(`/api/shipments?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, shipments: [] })),
        fetch(`/api/quotes?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, quotes: [] })),
        fetch(`/api/warehouses?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, warehouses: [] })),
        fetch(`/api/admin/customers?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, customers: [] })),
        fetch(`/api/admin/audit-logs?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, logs: [] })),
        fetch(`/api/admin/users?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, users: [] })),
        fetch(`/api/admin/shipping-config?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`/api/invoices?_t=${t}`, fetchOpts).then((r) => r.json()).catch(() => ({ success: false, invoices: [] }))
      ]);

      if (resShip.success && resShip.shipments) {
        setShipments(resShip.shipments);
      }
      if (resQte.success && resQte.quotes) setQuotes(resQte.quotes);
      if (resWh.success && resWh.warehouses) setWarehouses(resWh.warehouses);
      if (resCust.success && resCust.customers) setCustomers(resCust.customers);
      if (resAudit.success && resAudit.logs) setAuditLogs(resAudit.logs);
      if (resUsers.success && resUsers.users) setUsers(resUsers.users);
      if (resConfig.success && resConfig.config) setAdminShippingConfig(resConfig.config);
      if (resInv.success && resInv.invoices) setServerInvoices(resInv.invoices);

      if (manualSync) {
        setSyncState('synced');
        showToast('All operational records synchronized', 'success');
        setTimeout(() => setSyncState('idle'), 2500);
      }
    } catch (err) {
      console.error('Failed to load operational data:', err);
      if (manualSync) {
        setSyncState('error');
        showToast('Failed to sync records with server', 'error');
        setTimeout(() => setSyncState('idle'), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadEmailStatus = async () => {
    setLoadingEmailStatus(true);
    try {
      const res = await fetch('/api/admin/email/status');
      const data = await res.json();
      if (data.success) {
        setEmailStatus(data);
      }
    } catch (e) {
      console.error('Failed to load email status', e);
    } finally {
      setLoadingEmailStatus(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailStatus();
    }
  }, [activeTab]);

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    setVerifyMessage(null);
    try {
      const res = await fetch('/api/admin/email/verify', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setVerifyMessage('Domain verification check requested from Resend.');
        await loadEmailStatus();
      } else {
        setVerifyMessage(data.error || 'Verification check failed.');
      }
    } catch (err: any) {
      setVerifyMessage(err.message || 'Network error triggering verification.');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailRecipient })
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          message: `Test email dispatched successfully! ID: ${data.emailId || 'OK'}`
        });
      } else {
        setTestEmailResult({
          success: false,
          message: `Error: ${data.error || data.message || 'Dispatch failed'}`
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: `Network error: ${err.message}`
      });
    } finally {
      setSendingTestEmail(false);
    }
  };



  // Handler: Create Master Consignment & Tracking Order
  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingConsignment(true);
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustName = newCustName.trim();
      let finalRecipientName = recipientContactName.trim() || newRecipientName.trim();
      let finalRecipientPhone = compiledPhone || newRecipientPhone.trim();
      let finalRecipientAddress = compiledAddress || newRecipientAddress.trim();

      // If Admin opted to Register New Customer Account on the fly
      if (orderCustomerMode === 'new') {
        if (!newCustomerFullName.trim()) {
          throw new Error('Please enter customer full name.');
        }
        if (!newCustomerEmail.trim() || !newCustomerEmail.includes('@')) {
          throw new Error('Please enter a valid customer email address.');
        }
        if (!newCustomerPhone.trim()) {
          throw new Error('Please enter customer phone/WhatsApp number.');
        }

        const existingAcc = users.find(
          (u) => u.email.toLowerCase() === newCustomerEmail.trim().toLowerCase()
        );

        if (existingAcc) {
          finalCustomerId = existingAcc.id;
          finalCustName = newCustomerCompany.trim() || existingAcc.companyName || existingAcc.fullName;
          finalRecipientName = newCustomerFullName.trim() || existingAcc.fullName;
          finalRecipientPhone = newCustomerPhone.trim() || existingAcc.phone;
          finalRecipientAddress = newCustomerAddress.trim() || existingAcc.address || `${newDestCity}, Bangladesh`;
        } else {
          // Register new user account via API
          const userRes = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: newCustomerFullName.trim(),
              email: newCustomerEmail.trim().toLowerCase(),
              password: newCustomerPassword.trim() || 'password123',
              role: 'customer',
              status: 'active',
              phone: newCustomerPhone.trim(),
              companyName: newCustomerCompany.trim() || newCustomerFullName.trim(),
              address: newCustomerAddress.trim() || `${newDestCity}, Bangladesh`
            })
          });

          if (!userRes.ok) {
            const errData = await userRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to create new customer user account.');
          }

          const createdUser = await userRes.json();
          if (createdUser.user) {
            setUsers((prev) => [createdUser.user, ...prev.filter((u) => u.id !== createdUser.user.id)]);
            setCustomers((prev) => [
              {
                ...createdUser.user,
                activeShipmentsCount: 0,
                totalQuotesCount: 0,
                tier: 'Commercial Importer'
              },
              ...prev.filter((c) => c.id !== createdUser.user.id)
            ]);
            setSelectedCustomerId(createdUser.user.id);
          }
          finalCustomerId = createdUser.user?.id || `usr-${Date.now()}`;
          finalCustName = newCustomerCompany.trim() || newCustomerFullName.trim();
          finalRecipientName = newCustomerFullName.trim();
          finalRecipientPhone = newCustomerPhone.trim();
          finalRecipientAddress = newCustomerAddress.trim() || `${newDestCity}, Bangladesh`;
        }
      } else {
        if (!finalCustomerId) {
          throw new Error('Please select an existing customer account or switch to "Register New Client".');
        }
        if (!finalCustName) {
          finalCustName = currentSelectedCustomer?.companyName || currentSelectedCustomer?.fullName || 'Valued Customer';
        }
        if (!finalRecipientName) {
          finalRecipientName = currentSelectedCustomer?.fullName || finalCustName;
        }
      }

      if (finalCustName.length < 2) {
        finalCustName = 'Valued Customer';
      }

      const invalidItems = orderItems.filter((it) => !it.description.trim() || !(Number(it.weightKg) > 0));
      if (invalidItems.length > 0) {
        throw new Error('Please fill in product description and weight (KG) for all cargo items.');
      }

      if (!newCustomTrackingNumber.trim()) {
        throw new Error('Please enter a tracking number manually for this consignment.');
      }
      const trackingCodeToUse = newCustomTrackingNumber.trim().toUpperCase();

      const finalCustomerEmail =
        orderCustomerMode === 'new'
          ? newCustomerEmail.trim().toLowerCase()
          : currentSelectedCustomer?.email;
      const finalCustomerPhone =
        orderCustomerMode === 'new'
          ? newCustomerPhone.trim()
          : currentSelectedCustomer?.phone;

      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: trackingCodeToUse,
          customerId: finalCustomerId || 'usr-customer-01',
          customerName: finalCustName,
          customerEmail: finalCustomerEmail,
          customerPhone: finalCustomerPhone,
          recipientName: finalRecipientName,
          recipientPhone: finalRecipientPhone,
          recipientAddress: finalRecipientAddress,
          originCountry: newOriginCountry,
          originCity: newOriginCity,
          destCountry: newDestCountry,
          destCity: newDestCity,
          destAddress: finalRecipientAddress,
          mode: newMode,
          serviceLevel: newServiceLevel,
          carrierName: newCarrier,
          voyageOrFlightNumber: newVoyage,
          totalWeightKg: Math.max(0.1, Number(orderTotals.totalWeight) || 10),
          totalCbm: Math.max(0.01, Number(orderTotals.totalCbm) || 0.1),
          totalPieces: Math.max(1, Math.round(Number(orderTotals.totalPieces) || 1)),
          notes: deliveryNotes.trim() || deliveryInstructions.trim(),
          items: orderItems.map((it, idx) => ({
            itemCode: `#ITM-${1000 + idx}`,
            description: it.description.trim() || 'Commercial Cargo Item',
            packagingType: it.packagingType,
            quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
            weightKg: Math.max(0.1, Number(it.weightKg) || 10),
            cbm: Math.max(0.01, Number(it.cbm) || 0.05),
            categoryTag: it.categoryTag,
            declaredValue: Number(it.declaredValue) || undefined,
            currency: 'BDT'
          }))
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        let errMsg = errJson.error || 'Failed to create consignment';
        if (Array.isArray(errJson.details) && errJson.details.length > 0) {
          const detailMsgs = errJson.details
            .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
            .join(' | ');
          errMsg = `${errMsg} [${detailMsgs}]`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();

      // If initial status is not purchased, advance status immediately
      if (newInitialStatus && newInitialStatus !== 'purchased') {
        await fetch(`/api/shipments/${data.shipment.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newInitialStatus })
        });
      }

      setCreatedShipmentResult({
        trackingNumber: data.shipment.trackingNumber,
        customerName: finalCustName,
        route: `${newOriginCity} → ${newDestCity}`,
        mode: newMode.toUpperCase()
      });

      setCustomerSearchQuery('');
      setNewCustomerFullName('');
      setNewCustomerEmail('');
      setNewCustomerPhone('');
      setNewCustomerCompany('');
      setNewCustomerAddress('');
      setNewInitialStatus('purchased');
      showToast(`Order ${data.shipment.trackingNumber} created with ${orderItems.length} products!`, 'success');
      loadData(false);
      switchTab('orders');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingConsignment(false);
    }
  };

  // Handler: Quick Status Update with Immediate Feedback & Optimistic UI
  const handleQuickStatusUpdate = async (id: string, newStatus: string) => {
    const norm = normalizeStatusCode(newStatus);
    const statusDef = TRACKING_STATUSES[norm];
    const newLabel = statusDef ? statusDef.label : norm.toUpperCase();

    // 1. Optimistic Instant UI Update - 0ms response
    setShipments((prev) =>
      prev.map((s) => {
        if (s.id === id || s.trackingNumber === id) {
          const updatedEvents = [
            {
              id: `evt-opt-${Date.now()}`,
              shipmentId: s.id,
              status: norm,
              statusCode: norm,
              statusLabel: newLabel,
              title: newLabel,
              description: statusDef?.defaultDescription || 'Status updated',
              locationName: statusDef?.defaultLocation || s.currentLocation,
              eventTime: new Date().toISOString(),
              occurredAtBst: 'Just now',
              source: 'admin' as const,
              visibility: 'public' as const,
              eventVersion: (s.eventVersion || 1) + 1
            },
            ...s.events
          ];
          return {
            ...s,
            status: norm,
            statusCode: norm,
            statusLabel: newLabel,
            currentLocation: statusDef?.defaultLocation || s.currentLocation,
            events: updatedEvents,
            physicalProgress: calculatePhysicalProgress(norm, updatedEvents)
          };
        }
        return s;
      })
    );

    // Immediate notification banner
    const target = shipments.find((s) => s.id === id || s.trackingNumber === id);
    if (target) {
      setLiveStatusFeedback({
        trackingNumber: target.trackingNumber,
        newStatus: norm,
        statusLabel: newLabel
      });

      // Cross-tab & in-window 0ms instant synchronizations
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('goshipping-status-updated', {
            detail: { trackingNumber: target.trackingNumber, newStatus: norm, statusLabel: newLabel }
          })
        );
        try {
          const bc = new BroadcastChannel('goshipping_tracking_sync');
          bc.postMessage({
            type: 'SHIPMENT_STATUS_UPDATED',
            trackingNumber: target.trackingNumber,
            newStatus: norm,
            statusLabel: newLabel,
            timestamp: Date.now()
          });
          bc.close();
        } catch (e) {}

        try {
          localStorage.setItem(
            'goshipping_live_sync',
            JSON.stringify({ code: target.trackingNumber, status: norm, time: Date.now() })
          );
        } catch (e) {}
      }
    }

    // 2. Persist to API
    try {
      const res = await fetch(`/api/shipments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: norm })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Status update failed');
      }
      const data = await res.json();
      if (data.shipment) {
        setShipments((prev) =>
          prev.map((s) => (s.id === data.shipment.id || s.trackingNumber === data.shipment.trackingNumber ? data.shipment : s))
        );
      }
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
      loadData(); // Revert on network failure
    }
  };

  // Handler: Instant Overview Stage Update
  const handleInstantOverviewStatusUpdate = async () => {
    const targetShipment = shipments.find((s) => s.id === quickShipmentId || s.trackingNumber === quickShipmentId) || shipments[0];
    if (!targetShipment) return;
    setUpdatingQuickStage(true);
    try {
      await handleQuickStatusUpdate(targetShipment.id, quickTargetStage);
    } finally {
      setUpdatingQuickStage(false);
    }
  };

  // Handler: Delete Shipment
  const handleDeleteShipment = async (id: string, trackingNumber: string) => {
    if (!confirm(`Are you sure you want to permanently delete order ${trackingNumber}?`)) return;
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handler: Price Quote
  const handlePriceQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteForPricing) return;
    setSubmittingPricing(true);
    try {
      const res = await fetch(`/api/quotes/${selectedQuoteForPricing.id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseFreightCharge: parseFloat(baseFreight) || 150000,
          fuelSurcharge: parseFloat(fuelSurcharge) || 12000,
          customsClearanceFee: parseFloat(customsClearanceFee) || 10000,
          handlingFee: parseFloat(handlingFee) || 5000,
          currency: 'BDT',
          notes: pricingNotes
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to price quote');
      }
      alert(`Quote ${selectedQuoteForPricing.quoteNumber} priced successfully!`);
      setShowPricingModal(false);
      setSelectedQuoteForPricing(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingPricing(false);
    }
  };

  // =========================================================
  // QUOTE CONVERSION HANDLERS (Negotiation, Edit & Conversion)
  // =========================================================
  const handleOpenConvertQuote = (q: QuoteRecord) => {
    setSelectedQuoteForConvert(q);
    const latestRev = q.revisions && q.revisions.length > 0 ? q.revisions[0] : null;
    setConvertNegotiatedPrice(latestRev ? latestRev.totalAmount : 0);
    setConvertCurrency(latestRev ? latestRev.currency : 'BDT');
    setConvertPricingNotes(latestRev?.notes || '');
    setConvertMode((q.mode || 'air') as any);
    setConvertServiceLevel(q.serviceType === 'door_to_door' ? 'express' : 'standard');
    setConvertOriginCountry(q.originCountry || 'China');
    setConvertOriginCity(q.originCity || 'Guangzhou');
    setConvertDestCountry(q.destCountry || 'Bangladesh');
    setConvertDestCity(q.destCity || 'Dhaka');
    setConvertCargoDescription(q.cargoDescription || 'Commercial Freight Cargo');
    setConvertProductName(q.productName || q.cargoDescription || 'Commercial Freight Cargo');
    setConvertTotalWeightKg(q.totalWeightKg || 10);
    setConvertTotalCbm(q.totalCbm || 0.1);
    setConvertQuantity(q.quantity || 1);
    setConvertPackagingType(q.packagingType || 'carton');
    setConvertRecipientName(q.guestName || 'Consignee Partner');
    setConvertRecipientPhone(q.guestPhone || '+880 1711-000000');
    setConvertRecipientAddress(`${q.destCity || 'Dhaka'}, Bangladesh`);
    setConvertCarrierName(q.mode === 'air' ? 'GoShipping Air Priority' : q.mode === 'sea' ? 'GoShipping Ocean Line' : 'GoShipping Surface');
    setConvertVoyageOrFlight(q.mode === 'air' ? 'Flight GOSH-CARGO' : 'Vessel GOSH-VOYAGE');

    setConvertItems([
      {
        description: q.cargoDescription || 'Commercial Freight Goods',
        itemCode: `#QTE-ITM-01`,
        quantity: q.quantity || 1,
        weightKg: q.totalWeightKg || 10,
        cbm: q.totalCbm || 0.1,
        packagingType: q.packagingType || 'carton',
        categoryTag: 'Commercial'
      }
    ]);

    setShowConvertQuoteModal(true);
  };

  const handleSaveConvertQuote = async (withEdits = true) => {
    if (!selectedQuoteForConvert) return;
    setIsConvertingQuote(true);
    try {
      const payload = withEdits ? {
        negotiatedPrice: convertNegotiatedPrice,
        currency: convertCurrency,
        pricingNotes: convertPricingNotes,
        mode: convertMode,
        serviceLevel: convertServiceLevel,
        originCountry: convertOriginCountry,
        originCity: convertOriginCity,
        destCountry: convertDestCountry,
        destCity: convertDestCity,
        cargoDescription: convertCargoDescription,
        productName: convertProductName,
        totalWeightKg: convertTotalWeightKg,
        totalCbm: convertTotalCbm,
        totalPieces: convertQuantity,
        packagingType: convertPackagingType,
        recipientName: convertRecipientName,
        recipientPhone: convertRecipientPhone,
        recipientAddress: convertRecipientAddress,
        carrierName: convertCarrierName,
        voyageOrFlightNumber: convertVoyageOrFlight,
        items: convertItems
      } : {};

      const res = await fetch(`/api/quotes/${selectedQuoteForConvert.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to convert quote');
      }

      const data = await res.json();
      showToast(`Quote ${selectedQuoteForConvert.quoteNumber} converted to shipment ${data.shipmentId}!`, 'success');
      setShowConvertQuoteModal(false);
      setSelectedQuoteForConvert(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error converting quote');
    } finally {
      setIsConvertingQuote(false);
    }
  };

  // Legacy single-click fallback handler
  const handleConvertQuote = async (quoteId: string, quoteNumber: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      handleOpenConvertQuote(quote);
    } else {
      handleSaveConvertQuote(false);
    }
  };

  // =========================================================
  // SELECTIVE PRODUCT INVOICE & ARRIVAL HANDLERS (IN-PAGE STUDIO)
  // =========================================================
  const getEffectiveShipmentItems = (s: ShipmentRecord | null): ShipmentItem[] => {
    if (!s) return [];
    if (s.items && s.items.length > 0) return s.items;
    return [{
      id: `${s.id}-item-1`,
      shipmentId: s.id,
      itemCode: `#${s.trackingNumber?.slice(-6) || 'PKG-1'}`,
      description: s.productName || 'General Commercial Consignment',
      packagingType: s.mode === 'air' ? 'carton' : 'pallet',
      quantity: s.totalPieces || 1,
      weightKg: s.totalWeightKg || 100,
      cbm: s.totalCbm || 0.5,
      categoryTag: 'Commercial',
      arrived: true,
      arrivedQuantity: s.totalPieces || 1,
      arrivedWeightKg: s.totalWeightKg || 100
    }];
  };

  const handleOpenGenerateInvoice = (shipment: ShipmentRecord) => {
    setSelectedShipmentForInvoice(shipment);
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    setInvoiceCustomNumber(`INV-2026-${randomSeq}`);

    const isAir = shipment.mode === 'air';
    const isSea = shipment.mode === 'sea';
    const isHandCarry = shipment.mode === 'hand_carry';
    const defaultRate = isAir ? 750 : isSea ? 240 : isHandCarry ? 1450 : 500;
    setInvoiceRatePerKg(defaultRate);

    const items = getEffectiveShipmentItems(shipment);
    const selMap: Record<string, boolean> = {};
    const qtyMap: Record<string, number> = {};
    const weightMap: Record<string, number> = {};

    items.forEach((it) => {
      selMap[it.id] = true;
      qtyMap[it.id] = it.quantity || 1;
      weightMap[it.id] = it.weightKg || Math.round((shipment.totalWeightKg || 100) / items.length);
    });

    setInvoiceSelectedItems(selMap);
    setInvoiceItemArrivedQtys(qtyMap);
    setInvoiceItemArrivedWeights(weightMap);
    setInvoicePaymentStatus('pending');
    setInvoicePaymentMethod('Bank Wire (EFT / RTGS)');
    setInvoiceDueDate(new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB'));
    setInvoiceNotes(`Commercial freight tariff and customs clearance invoice for ${shipment.trackingNumber}`);
    setInvoiceSubView('generate');
    switchTab('invoices');
  };

  const handleSelectShipmentForInvoice = (shipmentId: string) => {
    const s = shipments.find(item => item.id === shipmentId);
    if (s) {
      handleOpenGenerateInvoice(s);
    }
  };

  const effectiveInvoiceItems = useMemo(() => {
    return getEffectiveShipmentItems(selectedShipmentForInvoice);
  }, [selectedShipmentForInvoice]);

  const computedArrivedWeight = useMemo(() => {
    if (!effectiveInvoiceItems || effectiveInvoiceItems.length === 0) return 0;
    let sum = 0;
    for (const it of effectiveInvoiceItems) {
      if (invoiceSelectedItems[it.id]) {
        const w = invoiceItemArrivedWeights[it.id] !== undefined ? invoiceItemArrivedWeights[it.id] : it.weightKg;
        sum += Number(w) || 0;
      }
    }
    return Math.round(sum * 10) / 10;
  }, [effectiveInvoiceItems, invoiceSelectedItems, invoiceItemArrivedWeights]);

  const computedSelectedCount = useMemo(() => {
    if (!effectiveInvoiceItems || effectiveInvoiceItems.length === 0) return 0;
    return effectiveInvoiceItems.filter(it => invoiceSelectedItems[it.id]).length;
  }, [effectiveInvoiceItems, invoiceSelectedItems]);

  const computedBaseFreight = Math.round(computedArrivedWeight * invoiceRatePerKg);
  const computedCustoms = Math.round(computedBaseFreight * 0.05);
  const computedTHC = selectedShipmentForInvoice?.mode === 'sea' ? 8500 : 2500;
  const computedFuel = selectedShipmentForInvoice?.mode === 'air' ? 2200 : 1500;
  const computedSubtotal = computedBaseFreight + computedCustoms + computedTHC + computedFuel;
  const computedVAT = Math.round(computedSubtotal * 0.15);
  const computedTotalBDT = computedSubtotal + computedVAT;

  const handleCreateShipmentInvoice = async () => {
    if (!selectedShipmentForInvoice) return;

    // Filter only selected items
    const selectedList: any[] = [];
    for (const it of effectiveInvoiceItems) {
      if (invoiceSelectedItems[it.id]) {
        selectedList.push({
          itemId: it.id,
          itemCode: it.itemCode,
          description: it.description,
          packagingType: it.packagingType,
          arrivedQuantity: invoiceItemArrivedQtys[it.id] !== undefined ? invoiceItemArrivedQtys[it.id] : it.quantity,
          totalQuantity: it.quantity,
          weightKg: invoiceItemArrivedWeights[it.id] !== undefined ? invoiceItemArrivedWeights[it.id] : it.weightKg,
          cbm: it.cbm,
          ratePerKg: invoiceRatePerKg
        });
      }
    }

    if (selectedList.length === 0) {
      showToast('Please select at least one arrived product to include in this invoice.', 'error');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const payload = {
        shipmentId: selectedShipmentForInvoice.id,
        invoiceNumber: invoiceCustomNumber,
        ratePerKg: invoiceRatePerKg,
        dueDate: invoiceDueDate,
        paymentMethod: invoicePaymentMethod,
        status: invoicePaymentStatus,
        notes: invoiceNotes,
        selectedItems: selectedList
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate invoice');
      }

      const data = await res.json();
      showToast(`Invoice ${data.invoice.invoiceNumber} generated successfully!`, 'success');
      setInvoiceSubView('list');
      await loadData();

      // Open preview immediately
      setPreviewInvoice(data.invoice);
    } catch (err: any) {
      showToast(err.message || 'Error generating invoice', 'error');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // =========================================================
  // USER MANAGEMENT HANDLERS (Ghost Login, Suspend, CRUD)
  // =========================================================
  const handleImpersonateUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to log in as "${userName}"? You will view the portal directly through this user's profile without needing their password.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
      window.location.href = data.redirectUrl || '/dashboard';
    } catch (err: any) {
      alert(err.message || 'Impersonation failed');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const actionName = currentStatus === 'active' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Status toggle failed');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to permanently delete user "${userName}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      loadData();
    } catch (err: any) {
      alert(err.message || 'User deletion failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userFullName,
          email: userEmail,
          password: userPassword || 'password',
          role: userRole,
          status: userStatus,
          phone: userPhone,
          companyName: userCompanyName || userFullName,
          address: userAddress,
          binNumber: userBin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      // Instantly update local state so user appears dynamically across all dropdowns
      if (data.user) {
        setUsers((prev) => [data.user, ...prev.filter((u) => u.id !== data.user.id)]);
        if (data.user.role === 'customer') {
          setCustomers((prev) => [
            {
              ...data.user,
              activeShipmentsCount: 0,
              totalQuotesCount: 0,
              tier: 'Commercial Importer'
            },
            ...prev.filter((c) => c.id !== data.user.id)
          ]);
        }
      }

      let emailNotice = '';
      if (data.emailFallback) {
        emailNotice = '\n\nNote: Email forwarded via Resend Sandbox (Recipient: ' + data.user.email + ').';
      } else if (data.emailSent) {
        emailNotice = `\n\nOnboarding credentials email dispatched directly to ${data.user.email} from notifications@send.goshipping.com.bd!`;
      } else if (data.emailWarning) {
        emailNotice = `\n\nEmail status: ${data.emailWarning}`;
      }

      alert(`User profile created successfully for ${data.user.fullName}!${emailNotice}`);
      setShowAddUserModal(false);
      resetUserForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setSubmittingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userFullName,
          email: userEmail,
          role: userRole,
          status: userStatus,
          phone: userPhone,
          companyName: userCompanyName,
          address: userAddress,
          binNumber: userBin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      alert('User profile updated successfully!');
      setShowEditUserModal(false);
      resetUserForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating user');
    } finally {
      setSubmittingUser(false);
    }
  };

  const openEditUserModal = (u: any) => {
    setEditingUserId(u.id);
    setUserFullName(u.fullName || '');
    setUserEmail(u.email || '');
    setUserRole(u.role || 'customer');
    setUserStatus(u.status || 'active');
    setUserPhone(u.phone || '');
    setUserCompanyName(u.companyName || '');
    setUserAddress(u.address || '');
    setUserBin(u.binNumber || '');
    setShowEditUserModal(true);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserFullName('');
    setUserEmail('');
    setUserPassword('password');
    setUserRole('customer');
    setUserStatus('active');
    setUserPhone('');
    setUserCompanyName('');
    setUserAddress('');
    setUserBin('');
  };

  // Warehouse Facility Management Handlers
  const openAddWarehouseModal = () => {
    setWhCode('');
    setWhName('');
    setWhCountry('China');
    setWhCity('Guangzhou');
    setWhAddress('');
    setWhContactPerson('');
    setWhPhone('+86 20 8888 0000');
    setWhEmail('ops@goshipping.com.bd');
    setWhCapacitySqft(35000);
    setWhCurrentOccupancyPct(50);
    setWhIsActive(true);
    setShowAddWarehouseModal(true);
  };

  const openEditWarehouseModal = (wh: WarehouseRecord) => {
    setSelectedWarehouse(wh);
    setWhCode(wh.code);
    setWhName(wh.name);
    setWhCountry(wh.country);
    setWhCity(wh.city);
    setWhAddress(wh.address);
    setWhContactPerson(wh.contactPerson || '');
    setWhPhone(wh.phone || '');
    setWhEmail(wh.email || '');
    setWhCapacitySqft(wh.capacitySqft || 25000);
    setWhCurrentOccupancyPct(wh.currentOccupancyPct || 50);
    setWhIsActive(wh.isActive !== undefined ? wh.isActive : true);
    setShowEditWarehouseModal(true);
  };

  const openDeleteWarehouseModal = (wh: WarehouseRecord) => {
    setSelectedWarehouse(wh);
    setShowDeleteWarehouseModal(true);
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWarehouse(true);
    try {
      const res = await fetch('/api/admin/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          country: whCountry.trim(),
          city: whCity.trim(),
          address: whAddress.trim(),
          contactPerson: whContactPerson.trim(),
          phone: whPhone.trim(),
          email: whEmail.trim(),
          capacitySqft: Number(whCapacitySqft) || 20000,
          currentOccupancyPct: Number(whCurrentOccupancyPct) || 0,
          isActive: whIsActive
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create warehouse');
      }

      const data = await res.json();
      showToast(`Warehouse facility ${data.warehouse.code} created successfully.`);
      setShowAddWarehouseModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Error creating warehouse: ${err.message}`);
    } finally {
      setSubmittingWarehouse(false);
    }
  };

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    setSubmittingWarehouse(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${selectedWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
          country: whCountry.trim(),
          city: whCity.trim(),
          address: whAddress.trim(),
          contactPerson: whContactPerson.trim(),
          phone: whPhone.trim(),
          email: whEmail.trim(),
          capacitySqft: Number(whCapacitySqft) || 20000,
          currentOccupancyPct: Number(whCurrentOccupancyPct) || 0,
          isActive: whIsActive
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update warehouse');
      }

      showToast(`Warehouse facility ${whCode.toUpperCase()} updated successfully.`);
      setShowEditWarehouseModal(false);
      setSelectedWarehouse(null);
      await loadData();
    } catch (err: any) {
      alert(`Error updating warehouse: ${err.message}`);
    } finally {
      setSubmittingWarehouse(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!selectedWarehouse) return;
    setDeletingWarehouse(true);
    try {
      const res = await fetch(`/api/admin/warehouses/${selectedWarehouse.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete warehouse');
      }

      showToast(`Warehouse facility ${selectedWarehouse.code} deleted successfully.`);
      setShowDeleteWarehouseModal(false);
      setSelectedWarehouse(null);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting warehouse: ${err.message}`);
    } finally {
      setDeletingWarehouse(false);
    }
  };

  // Filtered shipments: Instant real-time multi-field search across tracking #, customer name, company name, email, phone number, destination, route & cargo
  const filteredShipments = shipments.filter((s) => {
    const q = shipmentSearch.trim().toLowerCase();
    const matchesMode = shipmentModeFilter === 'all' || s.mode === shipmentModeFilter;
    const matchesStatus = shipmentStatusFilter === 'all' || s.status === shipmentStatusFilter;

    if (!q) {
      return matchesMode && matchesStatus;
    }

    // Correlate with registered customer account in allCustomerOptions
    const linkedCust = allCustomerOptions.find((c) => {
      const matchId = c.id && s.customerId && c.id.toLowerCase() === s.customerId.toLowerCase();
      const matchName = c.fullName && s.customerName && c.fullName.toLowerCase() === s.customerName.toLowerCase();
      const matchComp = c.companyName && s.customerName && c.companyName.toLowerCase() === s.customerName.toLowerCase();
      const matchEmail = c.email && s.customerEmail && c.email.toLowerCase() === s.customerEmail.toLowerCase();
      return matchId || matchName || matchComp || matchEmail;
    });

    // Flexible phone number digit matching (ignoring hyphens, spaces, and country code formats)
    const qDigits = q.replace(/\D/g, '');
    const sCustPhoneDigits = (s.customerPhone || '').replace(/\D/g, '');
    const sRecipPhoneDigits = (s.recipientPhone || '').replace(/\D/g, '');
    const linkedPhoneDigits = (linkedCust?.phone || '').replace(/\D/g, '');

    const matchesPhone =
      qDigits.length >= 3 &&
      (sCustPhoneDigits.includes(qDigits) ||
        sRecipPhoneDigits.includes(qDigits) ||
        linkedPhoneDigits.includes(qDigits));

    const matchesQ =
      s.trackingNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      (s.customerEmail && s.customerEmail.toLowerCase().includes(q)) ||
      (s.customerPhone && s.customerPhone.toLowerCase().includes(q)) ||
      (s.recipientName && s.recipientName.toLowerCase().includes(q)) ||
      (s.recipientPhone && s.recipientPhone.toLowerCase().includes(q)) ||
      (s.recipientEmail && s.recipientEmail.toLowerCase().includes(q)) ||
      (s.recipientAddress && s.recipientAddress.toLowerCase().includes(q)) ||
      (s.originCity && s.originCity.toLowerCase().includes(q)) ||
      (s.destCity && s.destCity.toLowerCase().includes(q)) ||
      (s.productName && s.productName.toLowerCase().includes(q)) ||
      (s.voyageOrFlightNumber && s.voyageOrFlightNumber.toLowerCase().includes(q)) ||
      (linkedCust?.companyName && linkedCust.companyName.toLowerCase().includes(q)) ||
      (linkedCust?.fullName && linkedCust.fullName.toLowerCase().includes(q)) ||
      (linkedCust?.email && linkedCust.email.toLowerCase().includes(q)) ||
      matchesPhone;

    return matchesQ && matchesMode && matchesStatus;
  });

  // Filtered quotes: Real-time search by quote #, customer name, company name, email, phone number & route
  const filteredQuotes = quotes.filter((q) => {
    const query = quoteSearch.trim().toLowerCase();
    const matchesStatus = quoteStatusFilter === 'all' || q.status === quoteStatusFilter;

    if (!query) {
      return matchesStatus;
    }

    const linkedCust = allCustomerOptions.find((c) => {
      const matchId = c.id && q.customerId && c.id.toLowerCase() === q.customerId.toLowerCase();
      const matchName = c.fullName && q.guestName && c.fullName.toLowerCase() === q.guestName.toLowerCase();
      const matchEmail = c.email && q.guestEmail && c.email.toLowerCase() === q.guestEmail.toLowerCase();
      return matchId || matchName || matchEmail;
    });

    const qDigits = query.replace(/\D/g, '');
    const guestPhoneDigits = (q.guestPhone || '').replace(/\D/g, '');
    const linkedPhoneDigits = (linkedCust?.phone || '').replace(/\D/g, '');

    const matchesPhone =
      qDigits.length >= 3 &&
      (guestPhoneDigits.includes(qDigits) || linkedPhoneDigits.includes(qDigits));

    const matchesQuery =
      q.quoteNumber.toLowerCase().includes(query) ||
      q.guestName.toLowerCase().includes(query) ||
      (q.guestEmail && q.guestEmail.toLowerCase().includes(query)) ||
      (q.guestPhone && q.guestPhone.toLowerCase().includes(query)) ||
      (q.originCity && q.originCity.toLowerCase().includes(query)) ||
      (q.destCity && q.destCity.toLowerCase().includes(query)) ||
      (q.cargoDescription && q.cargoDescription.toLowerCase().includes(query)) ||
      (q.productName && q.productName.toLowerCase().includes(query)) ||
      (linkedCust?.companyName && linkedCust.companyName.toLowerCase().includes(query)) ||
      (linkedCust?.fullName && linkedCust.fullName.toLowerCase().includes(query)) ||
      (linkedCust?.email && linkedCust.email.toLowerCase().includes(query)) ||
      matchesPhone;

    return matchesQuery && matchesStatus;
  });

  // Filtered users: Real-time search by full name, company name, email, phone number, address or BIN
  const filteredUsers = users.filter((u) => {
    const query = userSearch.trim().toLowerCase();
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;

    if (!query) {
      return matchesRole && matchesStatus;
    }

    const qDigits = query.replace(/\D/g, '');
    const userPhoneDigits = (u.phone || '').replace(/\D/g, '');
    const matchesPhone = qDigits.length >= 3 && userPhoneDigits.includes(qDigits);

    const matchesQuery =
      u.fullName?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.companyName?.toLowerCase().includes(query) ||
      u.phone?.toLowerCase().includes(query) ||
      u.address?.toLowerCase().includes(query) ||
      u.binNumber?.toLowerCase().includes(query) ||
      matchesPhone;

    return matchesQuery && matchesRole && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'out_for_delivery':
        return 'bg-orange-50 text-orange-700 border-orange-300';
      case 'payment_received':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'bd_warehouse_received':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'awaiting_customs':
      case 'customs_clearance':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'arrived_dhaka_airport':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'dispatched_from_china':
      case 'in_transit':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'cn_warehouse_received':
      case 'warehouse_received':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'purchased':
      case 'order_created':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getQuoteBadge = (status: string) => {
    switch (status) {
      case 'priced':
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'converted':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'under_review':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // KPIs
  const activeConsignmentsCount = shipments.filter((s) => s.status !== 'delivered').length;
  const inTransitAirCount = shipments.filter((s) => s.mode === 'air' && s.status === 'in_transit').length;
  const seaContainersCount = shipments.filter((s) => s.mode === 'sea').length;
  const pendingQuotesCount = quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review').length;

  const getAdminHeaderDetails = (tab: string) => {
    switch (tab) {
      case 'shipments':
      case 'tracking':
      case 'orders':
      case 'pos_ledger':
      case 'ledger':
        return {
          title: ordersSubView === 'sourcing' ? 'POS Sourcing & Freight Ledger' : 'Orders & Freight Shipments',
          subtitle: ordersSubView === 'sourcing'
            ? 'Unified order desk: Taobao & 1688 product purchasing, supplier ledger, and vector receipts'
            : 'Track live international shipments, update delivery status, and manage customs clearance'
        };
      case 'quotes':
        return {
          title: 'Price Quotes',
          subtitle: 'Review customer quote requests and update pricing'
        };
      case 'invoices':
      case 'invoice':
        return {
          title: 'Invoices & Billing',
          subtitle: 'Manage client invoices, payment status, and tax receipts'
        };
      case 'warehouses':
        return {
          title: 'Warehouse Locations',
          subtitle: 'Addresses and contact info for China and Bangladesh warehouses'
        };
      case 'users':
        return {
          title: 'Users & Staff',
          subtitle: 'Manage user accounts, roles, and admin permissions'
        };
      case 'customers':
        return {
          title: 'Customers',
          subtitle: 'Customer accounts, contact details, and order history'
        };
      case 'audit':
        return {
          title: 'Activity Logs',
          subtitle: 'History of admin actions, logins, and status updates'
        };
      case 'new_order':
        return {
          title: 'Create Consignment Order',
          subtitle: 'Add multiple cargo products, configure linehaul route, and initialize live tracking'
        };
      case 'overview':
      default:
        return {
          title: 'Admin Dashboard',
          subtitle: 'Overview of shipments, warehouse activity, and delivery status'
        };
    }
  };

  const headerDetails = getAdminHeaderDetails(activeTab);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-['Inter',sans-serif]">
      {/* Top Application Header Bar - Left-Hand Centric with Title, Status & Actions */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            id="admin-mobile-menu-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-none cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif] truncate">
            {headerDetails.title}
          </h1>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">



          {/* 3. + New Order Button / Back to Orders Button */}
          {activeTab === 'new_order' ? (
            <button
              type="button"
              onClick={() => switchTab('orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-none shadow-2xs cursor-pointer"
              title="Return to Orders list"
            >
              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to Orders</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewCustomTrackingNumber('');
                switchTab('new_order');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-none shadow-xs cursor-pointer"
              title="Create New Consignment Order"
            >
              <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Order</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {loading ? (
          <div className="space-y-6 animate-in fade-in duration-150">
            {activeTab === 'overview' && <OverviewSkeleton />}

            {(activeTab === 'shipments' || activeTab === 'orders' || activeTab === 'tracking') && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
                <TableTabSkeleton columns={7} rows={6} />
              </>
            )}

            {(activeTab === 'invoices' || activeTab === 'invoice') && (
              <InvoicesTabSkeleton />
            )}

            {activeTab === 'quotes' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
                <TableTabSkeleton columns={6} rows={5} />
              </>
            )}

            {(activeTab === 'users' || activeTab === 'customers') && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
                <TableTabSkeleton columns={6} rows={5} />
              </>
            )}

            {activeTab === 'warehouses' && (
              <WarehousesSkeleton />
            )}

            {activeTab === 'audit' && (
              <TableTabSkeleton columns={5} rows={6} hasFilters={false} />
            )}

            {activeTab === 'new_order' && (
              <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs animate-pulse">
                <div className="h-6 w-48 bg-slate-200 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* KPI COUNTER CARDS (Visible across overview, orders, quotes, etc.) */}
        {activeTab !== 'new_order' && !(activeTab === 'orders' && ordersSubView === 'sourcing') && activeTab !== 'pos_ledger' && activeTab !== 'ledger' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Shipments</span>
              <div className="text-2xl font-bold text-slate-900 font-['Manrope',sans-serif] tabular-nums">
                {activeConsignmentsCount || shipments.length}
              </div>
              <p className="text-xs text-slate-500">China ⇄ Bangladesh shipments</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Air Freight in Transit</span>
              <div className="text-2xl font-bold text-sky-600 font-['Manrope',sans-serif] tabular-nums">
                {inTransitAirCount || 1}
              </div>
              <p className="text-xs text-slate-500">Active flights with tracking</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sea Freight in Transit</span>
              <div className="text-2xl font-bold text-indigo-600 font-['Manrope',sans-serif] tabular-nums">
                {seaContainersCount || 2}
              </div>
              <p className="text-xs text-slate-500">Cargo ships & port arrivals</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-slate-200 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Quotes</span>
              <div className="text-2xl font-bold text-amber-600 font-['Manrope',sans-serif] tabular-nums">
                {pendingQuotesCount}
              </div>
              <p className="text-xs text-slate-500">Waiting for price review</p>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: OVERVIEW (Default Dashboard Command Center)           */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* SUPER ADMIN LIVE TRACKER CONTROL CENTER */}
            <div className="bg-gradient-to-r from-red-50/90 via-rose-50/40 to-slate-50 border-2 border-red-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EA1D2C] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                        Quick Tracking &amp; Orders
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EA1D2C] text-white uppercase tracking-wider font-mono">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Create tracking orders, assign tracking codes, and update delivery status in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomTrackingNumber('');
                      switchTab('new_order');
                    }}
                    className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-none"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Create Tracking Order</span>
                  </button>
                </div>
              </div>

              {/* 3 Quick Action Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Block 1: Create Order */}
                <div className="p-4 rounded-xl bg-white border border-red-100 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#EA1D2C] uppercase tracking-wider">Order Creation</span>
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] mt-0.5">
                      Create New Order
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Register goods from China supplier, set receiver info, and generate a tracking number (e.g. <code className="font-mono text-[#EA1D2C]">GOSH-2026-XXXX</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomTrackingNumber('');
                      switchTab('new_order');
                    }}
                    className="w-full py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#EA1D2C] text-xs font-bold transition-none cursor-pointer text-center"
                  >
                    + Open Order Form
                  </button>
                </div>

                {/* Block 2: 1-Click Instant Live Status Changer */}
                <div className="p-4 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider">Status Update</span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Update Shipment Status
                  </h3>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">Select Shipment</label>
                      <ReferenceSelect
                        value={quickShipmentId || (shipments[0]?.id || '')}
                        onChange={(newId) => {
                          setQuickShipmentId(newId);
                          const found = shipments.find((s) => s.id === newId || s.trackingNumber === newId);
                          if (found) {
                            setQuickTargetStage(normalizeStatusCode(found.status));
                          }
                        }}
                        options={shipments.map((s) => ({
                          value: s.id,
                          label: `${s.trackingNumber} — ${s.customerName}`,
                          badge: s.status.toUpperCase()
                        }))}
                        placeholder="Select Shipment"
                        searchable={true}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">New Status</label>
                      <ReferenceSelect
                        value={quickTargetStage}
                        onChange={(val) => setQuickTargetStage(val)}
                        options={[
                          { value: 'purchased', label: 'PURCHASED', badge: 'Step 1' },
                          { value: 'cn_warehouse_received', label: 'CN WAREHOUSE RECEIVED', badge: 'Step 2' },
                          { value: 'dispatched_from_china', label: 'DISPATCHED FROM CHINA', badge: 'Step 3' },
                          { value: 'arrived_dhaka_airport', label: 'ARRIVED DHAKA AIRPORT', badge: 'Step 4' },
                          { value: 'awaiting_customs', label: 'AWAITING CUSTOMS', badge: 'Step 5' },
                          { value: 'bd_warehouse_received', label: 'BD WAREHOUSE RECEIVED', badge: 'Step 6' },
                          { value: 'payment_received', label: 'PAYMENT RECEIVED', badge: 'Step 7' },
                          { value: 'out_for_delivery', label: 'OUT FOR DELIVERY', badge: 'Step 8' },
                          { value: 'delivered', label: 'DELIVERED', badge: 'Done' }
                        ]}
                        placeholder="Select Status"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={updatingQuickStage || shipments.length === 0}
                      onClick={handleInstantOverviewStatusUpdate}
                      className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {updatingQuickStage ? 'Updating Status…' : 'Update Status'}
                    </button>
                  </div>
                </div>

                {/* Block 3: Public Tracker Preview */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Verification</span>
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] mt-0.5">
                      View Public Tracker
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Check how customers see the physical progress bar and live updates on the tracking portal.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {shipments.length > 0 && (
                      <a
                        href={`/tracking?code=${encodeURIComponent(shipments[0]?.trackingNumber || 'GOSH-2026-9812')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-lg border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Open {shipments[0]?.trackingNumber} Tracker</span>
                        <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Update Feedback Banner */}
              {liveStatusFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>
                      Tracker for <strong>{liveStatusFeedback.trackingNumber}</strong> updated to <strong>{liveStatusFeedback.statusLabel}</strong>!
                    </span>
                  </div>
                  <a
                    href={`/tracking?code=${encodeURIComponent(liveStatusFeedback.trackingNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 shrink-0 inline-flex items-center gap-1"
                  >
                    <span>View Public Tracker</span>
                    <span>↗</span>
                  </a>
                </div>
              )}
            </div>

            {/* Corridor Status Notification Banner */}
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-950 font-['Manrope',sans-serif]">
                    China to Bangladesh &amp; Malaysia Shipping Routes are Active
                  </h3>
                  <p className="text-[11px] text-emerald-700">
                    Guangzhou, Dhaka, and Selangor facilities are receiving and dispatching packages normally.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => switchTab('shipments')}
                  className="px-3 py-1.5 rounded-md bg-white border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  View All Orders →
                </button>
              </div>
            </div>

            {/* Split Grid: Recent Consignments & Pending Quotations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Consignments */}
              <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Recent Orders
                    </h2>
                    <p className="text-xs text-slate-500">Latest shipments and live tracking updates</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('shipments')}
                    className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50/40 text-xs font-semibold text-slate-700 hover:text-[#EA1D2C] shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View All Orders</span>
                    <span className="font-mono text-[10px] text-slate-400">({shipments.length})</span>
                    <span className="text-[11px]">→</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Tracking Code</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Route &amp; Carrier</th>
                        <th className="py-2.5 px-3">Live Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shipments.slice(0, 5).map((s, idx) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <div>{s.trackingNumber}</div>
                            <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                              {s.packageCount || s.items.length} pkg · {s.mode?.toUpperCase()}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 truncate max-w-[140px] sm:max-w-[180px]">{s.customerName}</div>
                            <div className="text-[10px] text-slate-400">{s.items.length} units · {s.totalWeightKg} KG</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800">
                              {s.originCity} → {s.destCity}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase">{s.mode} · {s.voyageOrFlightNumber}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusQuickDropdown
                              shipmentId={s.id}
                              currentStatus={s.status}
                              onUpdate={handleQuickStatusUpdate}
                              openUpward={idx >= 3}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white hover:text-[#EA1D2C] hover:bg-red-50/50 border border-slate-200 hover:border-red-200 shadow-2xs hover:shadow-xs transition-colors cursor-pointer group shrink-0"
                                title="Open Live Multi-Modal Tracker"
                              >
                                <svg
                                  className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#EA1D2C] transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.2" />
                                </svg>
                                <span>Track</span>
                                <svg
                                  className="w-3 h-3 text-slate-400 group-hover:text-[#EA1D2C] -ml-0.5 transition-colors"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path d="M7 17l9.2-9.2M17 17V8H8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </a>

                              <button
                                type="button"
                                onClick={() => handleOpenGenerateInvoice(s)}
                                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition-colors cursor-pointer shrink-0"
                                title="Generate commercial invoice for this order"
                              >
                                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                <span>Invoice</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Col: Pending Rate Inquiries Queue */}
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                        Recent Quotes
                      </h2>
                      <p className="text-xs text-slate-500">Price requests waiting for review</p>
                    </div>
                    <button
                      onClick={() => switchTab('quotes')}
                      className="text-xs font-bold text-[#EA1D2C] hover:underline"
                    >
                      All ({quotes.length})
                    </button>
                  </div>

                  <div className="space-y-3">
                    {quotes.slice(0, 4).map((q) => (
                      <div key={q.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-2 bg-slate-50/40">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900">{q.quoteNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getQuoteBadge(q.status)}`}>
                            {q.status}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-800">
                          {q.guestName} ({q.originCity} → {q.destCity})
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{q.totalWeightKg} KG · {q.totalCbm} CBM</span>
                          {q.status === 'submitted' || q.status === 'under_review' ? (
                            <button
                              onClick={() => {
                                setSelectedQuoteForPricing(q);
                                setShowPricingModal(true);
                              }}
                              className="px-2 py-0.5 rounded bg-[#EA1D2C] text-white text-[10px] font-bold hover:bg-[#D41523] transition-colors"
                            >
                              Set Price →
                            </button>
                          ) : (
                            <span className="font-bold text-emerald-700 font-mono">
                              ৳{q.revisions[0]?.totalAmount.toLocaleString()} BDT
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {quotes.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No quotation requests found</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => switchTab('quotes')}
                  className="w-full py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors text-center block mt-3"
                >
                  Manage All Quotations & Pricing →
                </button>
              </div>
            </div>

            {/* Warehouse Hubs Summary Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    China &amp; Bangladesh Warehouse Locations
                  </h2>
                  <p className="text-xs text-slate-500">Storage capacity, inbound receiving, and consolidation status</p>
                </div>
                <button
                  onClick={() => switchTab('warehouses')}
                  className="text-xs font-bold text-[#EA1D2C] hover:underline"
                >
                  View Details ({warehouses.length})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors space-y-3 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {wh.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                            {wh.city}, {wh.country}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">{wh.name}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Hub"></span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Capacity Occupancy</span>
                        <span className="font-mono font-bold text-slate-800">{wh.currentOccupancyPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wh.currentOccupancyPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${wh.currentOccupancyPct}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{wh.capacitySqft.toLocaleString()} sqft</span>
                      <span className="font-medium text-slate-700">{wh.contactPerson}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: CREATE NEW CONSIGNMENT ORDER (DEDICATED FULL PAGE)   */}
        {/* ========================================================= */}
        {activeTab === 'new_order' && (
          <div className="space-y-6 max-w-7xl mx-auto pb-12 font-['Inter',sans-serif]">
            {/* Top Page Header & Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-[#EA1D2C] border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C] animate-pulse"></span>
                    Consignment Dispatch Page
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] font-mono text-slate-500">Live Order Total Summary</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-['Manrope',sans-serif] tracking-tight">
                  Create Consignment Order
                </h2>
                <p className="text-xs text-slate-500">
                  Assign client, configure international shipping route, add multiple cargo products, and generate live tracking code.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => switchTab('orders')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-none cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Back to Orders</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateConsignment} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: 4 FORM SECTIONS (lg:col-span-8) */}
              <div className="lg:col-span-8 space-y-6">

                {/* 1. CUSTOMER ACCOUNT & CLIENT ASSIGNMENT */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                        1. Customer Assignment
                      </h3>
                      <p className="text-xs text-slate-500">
                        Link order to an existing registered customer or onboard a new client
                      </p>
                    </div>

                    {/* Toggle: Existing vs New */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setOrderCustomerMode('existing')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-none cursor-pointer ${
                          orderCustomerMode === 'existing'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Existing Client
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderCustomerMode('new')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-none cursor-pointer ${
                          orderCustomerMode === 'new'
                            ? 'bg-white text-[#EA1D2C] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        + Register New Client
                      </button>
                    </div>
                  </div>

                  {orderCustomerMode === 'existing' ? (
                    <div className="space-y-3 pt-1">
                      <SearchableSelect
                        label="Customer Account"
                        required
                        value={selectedCustomerId}
                        onChange={(newVal) => {
                          const found = allCustomerOptions.find((c) => c.id === newVal);
                          if (found) selectCustomerForOrder(found);
                        }}
                        options={customerSelectOptions}
                        placeholder="Click to select or search customer (e.g. Apex Textiles Ltd)..."
                        searchPlaceholder="Type customer name, company, email, phone or BIN number..."
                      />

                      {/* Display auto-filled customer coordinates badge */}
                      {currentSelectedCustomer && (
                        <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-bold text-slate-900">
                              {currentSelectedCustomer.companyName || currentSelectedCustomer.fullName}
                            </span>
                            <span className="text-emerald-800 font-mono text-[11px]">
                              ({currentSelectedCustomer.email} · {currentSelectedCustomer.phone || 'No phone'})
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                            Auto-filled into Delivery Address
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* On-The-Fly New Customer Registration Form */
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={newCustomerFullName}
                            onChange={(e) => {
                              setNewCustomerFullName(e.target.value);
                              if (!newRecipientName) setNewRecipientName(e.target.value);
                            }}
                            placeholder="e.g. Tarek Rahman"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Company Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={newCustomerCompany}
                            onChange={(e) => setNewCustomerCompany(e.target.value)}
                            placeholder="e.g. Prime Apparels BD Ltd"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Email Address (for Live Status Alerts) *
                          </label>
                          <input
                            type="email"
                            value={newCustomerEmail}
                            onChange={(e) => setNewCustomerEmail(e.target.value)}
                            placeholder="client@company.com"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Phone / WhatsApp *
                          </label>
                          <input
                            type="tel"
                            value={newCustomerPhone}
                            onChange={(e) => {
                              setNewCustomerPhone(e.target.value);
                              setNewRecipientPhone(e.target.value);
                            }}
                            placeholder="+880 1711-XXXXXX"
                            required={orderCustomerMode === 'new'}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Default Delivery Address
                          </label>
                          <input
                            type="text"
                            value={newCustomerAddress}
                            onChange={(e) => {
                              setNewCustomerAddress(e.target.value);
                              setNewRecipientAddress(e.target.value);
                            }}
                            placeholder="Plot 12, Sector 3, Uttara, Dhaka"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Initial Portal Password
                          </label>
                          <input
                            type="text"
                            value={newCustomerPassword}
                            onChange={(e) => setNewCustomerPassword(e.target.value)}
                            placeholder="password123"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. ROUTE & SHIPPING METHOD (Matches Image 1) */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                      2. Route &amp; Shipping Method
                    </h3>
                    <p className="text-xs text-slate-500">
                      Specify origin China hub, destination (Bangladesh / Malaysia), carrier, and flight/voyage details
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Origin Hub (China) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-slate-800">
                          Origin Hub (China)
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {originWarehouseList.length} Active
                        </span>
                      </div>

                      {/* Selector for Origin matching reference style */}
                      <ReferenceSelect
                        value={newOriginCity}
                        onChange={(cityVal) => {
                          setNewOriginCity(cityVal);
                          setNewOriginCountry('China');
                        }}
                        options={originWarehouseList.map((wh) => ({
                          value: wh.city,
                          label: wh.city,
                          badge: wh.code,
                        }))}
                        placeholder="Select Origin Hub"
                      />
                    </div>

                    {/* 2. Destination Hub (BD / MY) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-slate-800">
                          Destination Hub
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          BD / MY
                        </span>
                      </div>

                      {/* Selector for Destination Hub matching reference style */}
                      <ReferenceSelect
                        value={
                          destinationHubList.find(
                            (opt) =>
                              newDestCountry.toLowerCase() === opt.country.toLowerCase() &&
                              (newDestCity.toLowerCase() === opt.city.toLowerCase() || opt.country.toLowerCase() === 'malaysia')
                          )?.key || (newDestCountry.toLowerCase() === 'malaysia' ? 'my-selangor' : 'bd-dhaka')
                        }
                        onChange={(keyVal) => {
                          const chosen = destinationHubList.find((opt) => opt.key === keyVal);
                          if (chosen) {
                            if (chosen.country !== newDestCountry) {
                              handleCountryChange(chosen.country);
                            }
                            setNewDestCity(chosen.city);
                            setRecipientCity(chosen.city);
                          }
                        }}
                        options={destinationHubList.map((opt) => ({
                          value: opt.key,
                          label: opt.label,
                          badge: opt.country === 'Malaysia' ? 'MY' : 'BD',
                        }))}
                        placeholder="Select Destination Hub"
                      />
                    </div>

                    {/* 3. Shipping Method */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-slate-800">
                          Shipping Method
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          3 Modes
                        </span>
                      </div>

                      {/* Selector for Shipping Method matching reference style */}
                      <ReferenceSelect
                        value={newMode}
                        onChange={(modeVal) => setNewMode(modeVal as any)}
                        options={[
                          { value: 'air', label: 'By Air', badge: 'Air' },
                          { value: 'sea', label: 'By Ship', badge: 'Sea' },
                          { value: 'hand_carry', label: 'Hand Carry', badge: 'Express' },
                        ]}
                        placeholder="Select Shipping Method"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Carrier Name
                      </label>
                      <input
                        type="text"
                        value={newCarrier}
                        onChange={(e) => setNewCarrier(e.target.value)}
                        placeholder="e.g. Cathay Cargo / GoShipping Air"
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Flight / Ship Number
                      </label>
                      <input
                        type="text"
                        value={newVoyage}
                        onChange={(e) => setNewVoyage(e.target.value)}
                        placeholder="e.g. Flight CX-068"
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. CARGO DETAILS & MULTIPLE PRODUCTS INVENTORY (Matches Image 2 + Multi-product) */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                          3. Cargo Details &amp; Multi-Product Inventory
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-[#EA1D2C] border border-red-200">
                          {orderItems.length} {orderItems.length === 1 ? 'Product' : 'Products'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Add every product item in this shipment. A customer can order multiple different products together.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addOrderItem}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-none cursor-pointer inline-flex items-center gap-1.5 shadow-2xs shrink-0"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add Product</span>
                    </button>
                  </div>

                  {/* Dynamic Product Cards */}
                  <div className="space-y-4">
                    {orderItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-slate-50/70 transition-none space-y-3.5 shadow-2xs"
                      >
                        {/* Item Card Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 font-['Manrope',sans-serif]">
                              {item.description ? item.description.slice(0, 40) : `Product Item ${index + 1}`}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.categoryTag}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => duplicateOrderItem(item)}
                              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition-none cursor-pointer inline-flex items-center gap-1"
                              title="Duplicate this item"
                            >
                              <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect width="13" height="13" x="9" y="9" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                              <span className="hidden sm:inline">Duplicate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => removeOrderItem(item.id)}
                              disabled={orderItems.length <= 1}
                              className={`p-1.5 rounded border transition-none cursor-pointer ${
                                orderItems.length <= 1
                                  ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                                  : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                              title={orderItems.length <= 1 ? 'Minimum 1 product required' : 'Remove product item'}
                            >
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Product Description */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Product Description *
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateOrderItem(item.id, 'description', e.target.value)}
                            placeholder="e.g. Commercial Fabrics, Apparel, Electronics..."
                            required
                            className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        {/* Package Type, Category, Quantity (Searchable Selectors with Generous Right Padding) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <SearchableSelect
                              label="Package Type"
                              value={item.packagingType}
                              onChange={(val) => updateOrderItem(item.id, 'packagingType', val)}
                              options={PACKAGE_TYPE_OPTIONS}
                              placeholder="Select package..."
                              searchPlaceholder="Search package type..."
                            />
                          </div>

                          <div>
                            <SearchableSelect
                              label="Product Category"
                              value={item.categoryTag}
                              onChange={(val) => updateOrderItem(item.id, 'categoryTag', val as any)}
                              options={CATEGORY_OPTIONS}
                              placeholder="Select category..."
                              searchPlaceholder="Search category..."
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Quantity (Pieces / Cartons) *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                              placeholder="e.g. 10"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>
                        </div>

                        {/* Weight, Volume, Declared Value */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Weight (KG) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              value={item.weightKg ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'weightKg', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 50"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Volume (CBM) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              value={item.cbm ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'cbm', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 0.4"
                              required
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Declared Value (BDT)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.declaredValue ?? ''}
                              onChange={(e) => updateOrderItem(item.id, 'declaredValue', e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="e.g. 50000"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Product Large Action Bar */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={addOrderItem}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-dashed border-red-300 hover:border-[#EA1D2C] bg-red-50/50 hover:bg-red-50 text-[#EA1D2C] font-bold text-xs transition-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add Another Product Item</span>
                    </button>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Quick presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          addOrderItem();
                          setTimeout(() => {
                            setOrderItems((prev) => {
                              const copy = [...prev];
                              const target = copy[copy.length - 1];
                              if (target) {
                                target.description = 'Cotton Knit Fabrics (Cartons)';
                                target.packagingType = 'carton';
                                target.categoryTag = 'Commercial';
                                target.quantity = 10;
                                target.weightKg = 150;
                                target.cbm = 0.8;
                              }
                              return copy;
                            });
                          }, 0);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        + Cotton Cartons
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addOrderItem();
                          setTimeout(() => {
                            setOrderItems((prev) => {
                              const copy = [...prev];
                              const target = copy[copy.length - 1];
                              if (target) {
                                target.description = 'Electronic PCB & Accessories';
                                target.packagingType = 'carton';
                                target.categoryTag = 'Electronics';
                                target.quantity = 5;
                                target.weightKg = 45;
                                target.cbm = 0.25;
                              }
                              return copy;
                            });
                          }, 0);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                      >
                        + Electronics
                      </button>
                    </div>
                  </div>

                  {/* Live Auto-Calculated Cargo Totals Bar */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                      <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        Order Total Summary
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                        Auto-Summed across {orderTotals.totalItems} products
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Packages</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalPieces} <span className="text-xs font-normal text-slate-400">pcs</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Gross Weight</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalWeight} <span className="text-xs font-normal text-slate-400">KG</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Volume</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums">
                          {orderTotals.totalCbm} <span className="text-xs font-normal text-slate-400">CBM</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-amber-400 uppercase font-semibold">Chargeable Weight</div>
                        <div className="text-lg font-bold font-['Manrope',sans-serif] tabular-nums text-amber-300">
                          {orderTotals.chargeableWeight} <span className="text-xs font-normal text-slate-400">KG</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          Max(Gross, {orderTotals.volumetricWeight} Vol)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. DYNAMIC DESTINATION DELIVERY ADDRESS */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 font-['Manrope',sans-serif]">
                          4. Delivery Address in {newDestCountry}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{currentAddressConfig.flag}</span>
                          <span>{newDestCountry}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Final destination doorstep, consignee contact and localized dispatch coordinates
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                      {newDestCountry === 'Malaysia' ? 'West & East Malaysia' : 'All 8 Divisions'}
                    </span>
                  </div>

                  {/* Recipient Name and Phone with Country Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Recipient / Consignee Contact Name <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientContactName}
                        onChange={(e) => {
                          setRecipientContactName(e.target.value);
                          setNewRecipientName(e.target.value);
                        }}
                        placeholder={newDestCountry === 'Malaysia' ? 'e.g. Lotus Mart Sdn Bhd / David Tan' : 'e.g. Apex Fashion Retail Hub / Farhan Ahmed'}
                        required
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phone Number with Country Code <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <div className="relative flex items-center h-10 w-full rounded-lg border border-slate-300 bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900">
                        {/* Compact Dial Code Selector with Flag & Code only */}
                        <div className="relative flex items-center shrink-0 pl-3 pr-2.5 border-r border-slate-200">
                          <select
                            value={recipientPhoneCode}
                            onChange={(e) => setRecipientPhoneCode(e.target.value)}
                            aria-label="Select Country Code"
                            className="appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                          >
                            {PHONE_DIAL_CODES.map((dial) => (
                              <option key={dial.code + dial.country} value={dial.code}>
                                {dial.flag} {dial.code}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="w-3 h-3 text-slate-400 pointer-events-none absolute right-1.5 stroke-[2.5]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>

                        {/* Phone Number Body Input */}
                        <input
                          type="tel"
                          value={recipientPhoneBody}
                          onChange={(e) => {
                            setRecipientPhoneBody(e.target.value);
                            setNewRecipientPhone(`${recipientPhoneCode} ${e.target.value}`);
                          }}
                          placeholder={newDestCountry === 'Malaysia' ? '11 1234 5678' : '1601 111994'}
                          required
                          className="flex-1 h-full px-3 text-xs text-slate-900 font-mono focus:outline-none bg-transparent placeholder-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Line 1 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Address (Street / Building / Plot / Road) <span className="text-[#EA1D2C]">*</span>
                    </label>
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        setNewRecipientAddress(e.target.value);
                      }}
                      placeholder={newDestCountry === 'Malaysia' ? 'e.g. Lot 2720-B, Jalan Industri 12' : 'e.g. Flat 2/B, 16, 16/1 Basubazar Lane, Dayaganj'}
                      required
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Address 2 (Suite / Unit / Floor / Industrial Area)
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                    </div>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder={newDestCountry === 'Malaysia' ? 'e.g. Kampung Baru Sungai Buloh' : 'e.g. Suite 402, 4th Floor, Apex Commercial Hub'}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    />
                  </div>

                  {/* 4-Column Selectors: Country, State/Division, City, Postcode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Country Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Country Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <ReferenceSelect
                        value={newDestCountry}
                        onChange={(val) => handleCountryChange(val)}
                        options={[
                          { value: 'Bangladesh', label: 'Bangladesh', badge: 'BD' },
                          { value: 'Malaysia', label: 'Malaysia', badge: 'MY' }
                        ]}
                        placeholder="Select Country"
                      />
                    </div>

                    {/* State / Division Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {currentAddressConfig.stateLabel} Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <ReferenceSelect
                        value={recipientState}
                        onChange={(val) => handleStateChange(val)}
                        options={currentStates.map((st) => ({
                          value: st.name,
                          label: st.name
                        }))}
                        placeholder={`Select ${currentAddressConfig.stateLabel}`}
                        searchable={currentStates.length > 6}
                      />
                    </div>

                    {/* City Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        City Selector <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <ReferenceSelect
                        value={recipientCity}
                        onChange={(val) => {
                          setRecipientCity(val);
                          setNewDestCity(val);
                        }}
                        options={currentAvailableCities.map((ct) => ({
                          value: ct,
                          label: ct
                        }))}
                        placeholder="Select City"
                        searchable={currentAvailableCities.length > 6}
                      />
                    </div>

                    {/* Postcode */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Post Code
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={recipientPostcode}
                        onChange={(e) => setRecipientPostcode(e.target.value)}
                        placeholder={newDestCountry === 'Malaysia' ? '47000' : '1204'}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  {/* Delivery Notes & Special Handling */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Delivery Notes &amp; Special Handling Instructions
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Optional</span>
                    </div>
                    <textarea
                      value={deliveryNotes}
                      onChange={(e) => {
                        setDeliveryNotes(e.target.value);
                        setDeliveryInstructions(e.target.value);
                      }}
                      rows={2}
                      placeholder="e.g. Direct door-to-door delivery. Call recipient 2 hours before gate arrival."
                      className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none bg-white"
                    />
                  </div>

                  {/* Live Dispatch Coordinates Preview Box */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>Live Dispatch Coordinates</span>
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {compiledPhone}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 break-words leading-relaxed">
                      {compiledAddress || 'No address specified yet'}
                    </p>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: STICKY MANIFEST SUMMARY & DISPATCH (lg:col-span-4) */}
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">

                {/* Live Manifest Review Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Consignment Order Summary
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ready to Dispatch
                    </span>
                  </div>

                  {/* Manual Tracking Number Input Box */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                        Tracking Number <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Manual Entry</span>
                    </div>
                    <input
                      type="text"
                      value={newCustomTrackingNumber}
                      onChange={(e) => setNewCustomTrackingNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. GOSH-2026-9812 or Airway Bill / BL"
                      required
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <p className="text-[10px] text-slate-500">
                      Enter the carrier airway bill (AWB), ocean B/L or consignment tracking code manually.
                    </p>
                  </div>

                  {/* Initial Status Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Physical Stage
                    </label>
                    <ReferenceSelect
                      value={newInitialStatus}
                      onChange={(val) => setNewInitialStatus(val)}
                      options={[
                        { value: 'purchased', label: '1. PURCHASED (Default Initial)', badge: 'Step 1' },
                        { value: 'cn_warehouse_received', label: '2. CN WAREHOUSE RECEIVED', badge: 'Step 2' },
                        { value: 'dispatched_from_china', label: '3. DISPATCHED FROM CHINA', badge: 'Step 3' },
                        { value: 'arrived_dhaka_airport', label: '4. ARRIVED DHAKA AIRPORT', badge: 'Step 4' },
                        { value: 'awaiting_customs', label: '5. AWAITING CUSTOMS CLEARANCE', badge: 'Step 5' },
                        { value: 'bd_warehouse_received', label: '6. BD WAREHOUSE RECEIVED', badge: 'Step 6' },
                        { value: 'out_for_delivery', label: '7. OUT FOR DELIVERY', badge: 'Step 7' },
                        { value: 'delivered', label: '8. DELIVERED', badge: 'Final' }
                      ]}
                      placeholder="Select Initial Physical Stage"
                    />
                  </div>

                  {/* Summary Breakdown */}
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Route</span>
                      <span className="font-semibold text-slate-900">{newOriginCity}, CN → {newDestCity}, {newDestCountry === 'Malaysia' ? 'MY' : 'BD'}</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Mode &amp; Carrier</span>
                      <span className="font-semibold text-slate-900">{(newMode === 'air' ? 'BY AIR' : newMode === 'sea' ? 'BY SHIP' : 'HAND CARRY')} ({newVoyage})</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                        {orderCustomerMode === 'new' ? (newCustomerCompany || newCustomerFullName || 'New Customer') : (currentSelectedCustomer?.companyName || currentSelectedCustomer?.fullName || 'Assigned')}
                      </span>
                    </div>

                    <div className="py-2 flex items-start justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Deliver To</span>
                      <span className="font-semibold text-slate-900 text-right truncate max-w-[170px]" title={compiledAddress}>
                        {recipientContactName || 'Consignee'} ({recipientCity}, {newDestCountry === 'Malaysia' ? 'MY' : 'BD'})
                      </span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Total Products</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalItems} distinct items</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Total Packages</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalPieces} pcs</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Gross Weight</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalWeight} KG</span>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-500">Volume</span>
                      <span className="font-semibold text-slate-900">{orderTotals.totalCbm} CBM</span>
                    </div>

                    <div className="py-2.5 flex items-center justify-between bg-red-50/60 px-2 rounded-lg mt-1">
                      <span className="font-bold text-[#EA1D2C]">Chargeable Weight</span>
                      <span className="font-bold text-base text-[#EA1D2C] tabular-nums">
                        {orderTotals.chargeableWeight} KG
                      </span>
                    </div>
                  </div>

                  {/* Primary Dispatch Button */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={submittingConsignment}
                      className="w-full py-3 px-4 rounded-xl bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-none shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submittingConsignment ? (
                        <>
                          <svg className="w-4 h-4 animate-spin stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          <span>Creating Consignment...</span>
                        </>
                      ) : (
                        <>
                          <span>Create &amp; Dispatch Order</span>
                          <span className="font-bold">→</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => switchTab('orders')}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-none cursor-pointer text-center"
                    >
                      Cancel &amp; Return to Orders
                    </button>
                  </div>

                  {/* NBR & Customs Compliance Note */}
                  <div className="pt-2 text-[10px] text-slate-400 text-center leading-relaxed">
                    National Board of Revenue (NBR) Mushak 6.3 compliant manifest generation. Real-time telemetry initialized.
                  </div>
                </div>

                {/* Hub & Warehouse Coordinates Card */}
                <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-['Manrope',sans-serif]">
                        Hub &amp; Warehouse Coordinates
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                      {selectedOriginWarehouse?.code || 'CN'} → {selectedDestWarehouse?.code || 'DEST'}
                    </span>
                  </div>

                  {/* Origin Warehouse Address */}
                  {selectedOriginWarehouse && (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 mb-0.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">CN</span> Origin Hub ({selectedOriginWarehouse.city})
                        </span>
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                          {selectedOriginWarehouse.code}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {selectedOriginWarehouse.address}
                      </p>
                      {selectedOriginWarehouse.phone && (
                        <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Intake Contact:</span>
                          <span className="font-mono font-medium text-slate-800">{selectedOriginWarehouse.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Destination Warehouse Address */}
                  {selectedDestWarehouse && (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 mb-0.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-slate-800">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">{newDestCountry === 'Malaysia' ? 'MY' : 'BD'}</span> Destination Hub ({selectedDestWarehouse.city})
                        </span>
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                          {selectedDestWarehouse.code}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {selectedDestWarehouse.address}
                      </p>
                      {selectedDestWarehouse.phone && (
                        <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Dispatch Hub:</span>
                          <span className="font-mono font-medium text-slate-800">{selectedDestWarehouse.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transit SLA */}
                  <div className="p-3 rounded-lg bg-red-50/60 border border-red-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-[#EA1D2C] stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {newMode === 'air' ? 'Air Cargo' : newMode === 'sea' ? 'Ocean Freight' : 'Hand Carry'} SLA
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-[#EA1D2C]">
                      {newMode === 'air' ? '7–14 Days' : newMode === 'sea' ? '30–45 Days' : '24–48 Hours'}
                    </span>
                  </div>
                </div>

              </div>

            </form>
          </div>
        )}
        {/* ========================================================= */}
        {/* TAB: UNIFIED ORDERS & SOURCING POS LEDGER DESK            */}
        {/* ========================================================= */}
        {(activeTab === 'shipments' || activeTab === 'tracking' || activeTab === 'orders' || activeTab === 'pos_ledger' || activeTab === 'ledger') && (
          <div className="space-y-6">
            {/* Top Level Sub-view Segmented Switcher & Quick Actions */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => switchOrdersView('sourcing')}
                  className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-none cursor-pointer ${
                    ordersSubView === 'sourcing'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                    <path d="m14 13 2 2 4-4" />
                  </svg>
                  <span>Sourcing POS Ledger</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    ordersSubView === 'sourcing' ? 'bg-[#EA1D2C] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    POS
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => switchOrdersView('freight')}
                  className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center gap-2 transition-none cursor-pointer ${
                    ordersSubView === 'freight'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                  <span>Freight Shipments</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    ordersSubView === 'freight' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {shipments.length}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setNewCustomTrackingNumber('');
                    switchTab('new_order');
                  }}
                  className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-none cursor-pointer"
                  title="Create New Consignment Order"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>+ New Freight Order</span>
                </button>
              </div>
            </div>

            {/* Sub-view 1: Sourcing POS Ledger Terminal */}
            {ordersSubView === 'sourcing' && (
              <PosLedgerTerminal showToast={showToast} />
            )}

            {/* Sub-view 2: Freight Shipments Desk */}
            {ordersSubView === 'freight' && (
              <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 space-y-5 shadow-xs">
                {/* Header: Breadcrumb Pill, Executive Title, Sync & New Consignment Action */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Freight Desk
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-mono font-medium text-slate-500">
                        {shipments.length} Active Shipments
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope',sans-serif] tracking-tight">
                      All Freight Shipments &amp; Consignments
                    </h2>
                    <p className="text-xs text-slate-500">
                      Track live shipments, update delivery progress, and manage customs clearance.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomTrackingNumber('');
                        switchTab('new_order');
                      }}
                      className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-none cursor-pointer"
                      title="Create New Consignment Order"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>New Order</span>
                    </button>
                  </div>
                </div>

            {/* Quick KPI Overview Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50">
                <div className="text-[11px] font-semibold text-slate-500">Total Weight</div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                  {shipments.reduce((acc, s) => acc + (s.totalWeightKg || 0), 0).toLocaleString()} <span className="text-xs text-slate-400 font-sans">KG</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{shipments.length} Active Shipments</div>
              </div>

              <div className="p-3.5 rounded-lg border border-blue-100 bg-blue-50/40">
                <div className="text-[11px] font-semibold text-blue-700">In Transit</div>
                <div className="text-lg font-bold font-mono text-blue-900 mt-1">
                  {shipments.filter(s => ['dispatched_from_china', 'arrived_dhaka_airport', 'in_transit'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-blue-600 mt-0.5">Air &amp; Sea Shipments</div>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-100 bg-amber-50/40">
                <div className="text-[11px] font-semibold text-amber-700">In Customs</div>
                <div className="text-lg font-bold font-mono text-amber-900 mt-1">
                  {shipments.filter(s => ['awaiting_customs', 'customs_clearance'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Dhaka &amp; Chittagong Customs</div>
              </div>

              <div className="p-3.5 rounded-lg border border-emerald-100 bg-emerald-50/40">
                <div className="text-[11px] font-semibold text-emerald-700">Delivered</div>
                <div className="text-lg font-bold font-mono text-emerald-900 mt-1">
                  {shipments.filter(s => ['out_for_delivery', 'delivered'].includes(s.status)).length}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Delivered to Customer</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                  placeholder="Search by name, company, email, phone, or tracking #..."
                  className="w-full h-9 pl-8 pr-8 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
                />
                {shipmentSearch && (
                  <button
                    type="button"
                    onClick={() => setShipmentSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer transition-none"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ReferenceSelect
                  value={shipmentModeFilter}
                  onChange={(val) => setShipmentModeFilter(val)}
                  size="sm"
                  className="w-44 shrink-0"
                  options={[
                    { value: 'all', label: 'All Shipping Modes' },
                    { value: 'air', label: 'By Air', badge: 'Air' },
                    { value: 'sea', label: 'By Ship', badge: 'Sea' },
                    { value: 'hand_carry', label: 'Hand Carry', badge: 'Express' }
                  ]}
                />

                <ReferenceSelect
                  value={shipmentStatusFilter}
                  onChange={(val) => setShipmentStatusFilter(val)}
                  size="sm"
                  className="w-48 shrink-0"
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'purchased', label: 'PURCHASED' },
                    { value: 'cn_warehouse_received', label: 'CN WAREHOUSE RECEIVED' },
                    { value: 'dispatched_from_china', label: 'DISPATCHED FROM CHINA' },
                    { value: 'arrived_dhaka_airport', label: 'ARRIVED DHAKA AIRPORT' },
                    { value: 'awaiting_customs', label: 'AWAITING CUSTOMS' },
                    { value: 'bd_warehouse_received', label: 'BD WAREHOUSE RECEIVED' },
                    { value: 'payment_received', label: 'PAYMENT RECEIVED' },
                    { value: 'out_for_delivery', label: 'OUT FOR DELIVERY' },
                    { value: 'delivered', label: 'DELIVERED' }
                  ]}
                  searchable={true}
                />

                <span className="text-[11px] font-mono font-medium text-slate-500 whitespace-nowrap px-1">
                  {filteredShipments.length} {filteredShipments.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
            </div>

            {/* Redesigned Consignments Table with Proportional Widths and Zero Cutoff */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-[11px] border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[150px]">Tracking Number</th>
                    <th className="py-2.5 px-3 w-[170px]">Customer &amp; Destination</th>
                    <th className="py-2.5 px-3 w-[150px]">Route &amp; Mode</th>
                    <th className="py-2.5 px-3 w-[135px]">Cargo Details</th>
                    <th className="py-2.5 px-3 w-[170px]">Current Location</th>
                    <th className="py-2.5 px-3 w-[160px]">Status</th>
                    <th className="py-2.5 px-3 w-[95px] text-right pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredShipments.map((s, idx) => {
                    const linkedCust = allCustomerOptions.find((c) => {
                      const matchId = c.id && s.customerId && c.id.toLowerCase() === s.customerId.toLowerCase();
                      const matchName = c.fullName && s.customerName && c.fullName.toLowerCase() === s.customerName.toLowerCase();
                      const matchComp = c.companyName && s.customerName && c.companyName.toLowerCase() === s.customerName.toLowerCase();
                      const matchEmail = c.email && s.customerEmail && c.email.toLowerCase() === s.customerEmail.toLowerCase();
                      return matchId || matchName || matchComp || matchEmail;
                    });
                    const customerCompany = linkedCust?.companyName;
                    const customerEmail = s.customerEmail || linkedCust?.email;
                    const customerPhone = s.customerPhone || linkedCust?.phone;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Tracking & Waybill */}
                        <td className="py-2.5 px-3 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-900 text-xs tracking-tight">
                              {s.trackingNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(s.trackingNumber);
                                setCopiedTracking(s.trackingNumber);
                                setTimeout(() => setCopiedTracking(null), 2000);
                              }}
                              title="Copy tracking number"
                              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-none cursor-pointer"
                            >
                              {copiedTracking === s.trackingNumber ? (
                                <span className="text-[9px] text-emerald-600 font-bold font-sans">Copied!</span>
                              ) : (
                                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <a
                              href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-semibold font-sans text-[#EA1D2C] bg-red-50 hover:bg-red-100 border border-red-200 transition-none"
                            >
                              <span>Track</span>
                              <span>↗</span>
                            </a>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                              {s.lastUpdatedBst?.split(',')[0] || 'Recent'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Client & Destination */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[165px]">
                            {s.customerName}
                          </div>
                          {customerCompany && (
                            <div className="text-[11px] font-medium text-slate-700 truncate max-w-[165px]">
                              {customerCompany}
                            </div>
                          )}
                          {(customerEmail || customerPhone) && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[165px] font-mono">
                              {customerPhone || customerEmail}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 truncate max-w-[165px] mt-0.5">
                            {s.recipientAddress}
                          </div>
                        </td>

                      {/* 3. Corridor & Mode */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                          <span>{s.originCity}</span>
                          <span className="text-slate-400 font-normal">→</span>
                          <span>{s.destCity}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                            s.mode === 'air'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : s.mode === 'sea'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {s.mode === 'air' ? 'BY AIR' : s.mode === 'sea' ? 'BY SHIP' : s.mode === 'hand_carry' ? 'HAND CARRY' : s.mode.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px]">
                            {s.voyageOrFlightNumber}
                          </span>
                        </div>
                      </td>

                      {/* 4. Cargo Specifications */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold font-mono text-slate-900 text-xs">
                          {s.totalWeightKg.toLocaleString()} KG
                          <span className="text-slate-400 font-normal"> · </span>
                          <span className="text-slate-600 font-mono">{s.totalCbm}m³</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {s.totalPieces || s.items.length} units ({s.items[0]?.packagingType?.replace('_', ' ') || 'carton'})
                        </div>
                      </td>

                      {/* 5. Current Waypoint & Progress */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 text-[11px] truncate max-w-[160px]">
                          {s.currentLocation}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-none"
                              style={{ width: `${s.physicalProgress?.percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {s.physicalProgress?.percentage || 0}%
                          </span>
                        </div>
                      </td>

                      {/* 6. Operational Status (Sleek Interactive Dropdown) */}
                      <td className="py-2.5 px-3">
                        <StatusQuickDropdown
                          shipmentId={s.id}
                          currentStatus={s.status}
                          onUpdate={handleQuickStatusUpdate}
                          openUpward={idx >= Math.max(0, filteredShipments.length - 3)}
                        />
                      </td>

                      {/* 7. Actions Desk */}
                      <td className="py-2.5 px-3 text-right pr-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-xs font-semibold text-slate-700 bg-white hover:text-[#EA1D2C] hover:bg-red-50/50 border border-slate-200 hover:border-red-200 shadow-2xs hover:shadow-xs transition-colors cursor-pointer group shrink-0"
                            title="Open Live Multi-Modal Tracker"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#EA1D2C] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.2" />
                            </svg>
                            <span className="hidden sm:inline">Track</span>
                            <svg className="w-3 h-3 text-slate-400 group-hover:text-[#EA1D2C] -ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M7 17l9.2-9.2M17 17V8H8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleOpenGenerateInvoice(s)}
                            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition-colors cursor-pointer"
                            title="Generate invoice & select arrived products for payment collection"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            <span>Invoice</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShipment(s.id, s.trackingNumber)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                            title="Delete Order"
                            aria-label="Delete Order"
                          >
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filteredShipments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-600 text-sm">No orders found</div>
                          <div className="text-xs text-slate-400">Try adjusting your search query or mode/status filters.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: RATE QUOTATIONS DESK                                  */}
        {/* ========================================================= */}
        {(activeTab === 'quotes' || activeTab === 'quote') && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Price Quotes
                </h2>
                <p className="text-xs text-slate-500">
                  Review customer quote requests and update shipping pricing
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <input
                  type="text"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search quote #, customer, route..."
                  className="h-8 pl-3 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 w-52 sm:w-64"
                />

                <div className="w-48">
                  <ReferenceSelect
                    value={quoteStatusFilter}
                    onChange={(val) => setQuoteStatusFilter(val)}
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'submitted', label: 'Submitted', badge: 'New' },
                      { value: 'under_review', label: 'Under Review', badge: 'Review' },
                      { value: 'priced', label: 'Priced', badge: 'Priced' },
                      { value: 'accepted', label: 'Accepted', badge: 'OK' },
                      { value: 'converted', label: 'Converted to Shipment', badge: 'Booked' }
                    ]}
                    placeholder="Status"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Quote Number</th>
                    <th className="py-3 px-4">Customer Contact</th>
                    <th className="py-3 px-4">Origin → Destination</th>
                    <th className="py-3 px-4">Cargo & Weight</th>
                    <th className="py-3 px-4">Pricing Status</th>
                    <th className="py-3 px-4">Quoted Total</th>
                    <th className="py-3 px-4 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {q.quoteNumber}
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5 uppercase">{q.mode} Cargo</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{q.guestName}</div>
                        <div className="text-[11px] text-slate-500">{q.guestEmail} · {q.guestPhone}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {q.originCity} → {q.destCity}
                        </div>
                        <div className="text-[10px] text-slate-400">{q.serviceType ? q.serviceType.replace(/_/g, ' ') : 'Standard Freight'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {q.totalWeightKg} KG ({q.totalCbm} CBM)
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{q.cargoDescription}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${getQuoteBadge(q.status)}`}>
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {q.revisions && q.revisions.length > 0 ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              ${q.revisions[0].totalAmount.toLocaleString()} {q.revisions[0].currency}
                            </span>
                            <div className="text-[10px] text-slate-400">By {q.revisions[0].staffName || 'Staff'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unpriced</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuoteForPricing(q);
                              setShowPricingModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-[#EA1D2C] text-white hover:bg-[#D41523] text-[11px] font-semibold transition-colors"
                          >
                            {q.revisions.length > 0 ? 'Revise Price' : 'Price Quote'}
                          </button>

                          {q.status === 'converted_to_shipment' || q.status === 'converted' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Converted</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenConvertQuote(q)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-black text-white text-[11px] font-semibold transition-none shadow-2xs cursor-pointer"
                              title="Negotiate final budget & convert quote to active shipment"
                            >
                              <span>Convert to Shipment</span>
                              <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredQuotes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No rate quotes matching filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: COMMERCIAL INVOICES & BILLING DESK                   */}
        {/* ========================================================= */}
        {(activeTab === 'invoices' || activeTab === 'invoice') && (() => {
          // Compute invoices from shipments
          const derivedInvoices = (shipments.length > 0 ? shipments : [
            {
              id: 'ship-mock-1',
              trackingNumber: 'GOSH-2026-9812',
              clientName: 'Apex Textiles Ltd',
              originCity: 'Guangzhou',
              originCountry: 'China',
              destinationCity: 'Dhaka',
              serviceType: 'air',
              weightKg: 850.5,
              currentStatus: 'awaiting_customs',
              createdAt: '2026-10-24T10:00:00Z',
            },
            {
              id: 'ship-mock-2',
              trackingNumber: 'GOSH-2026-4411',
              clientName: 'Standard Composite Mills Ltd',
              originCity: 'Shenzhen',
              originCountry: 'China',
              destinationCity: 'Chittagong',
              serviceType: 'sea',
              weightKg: 18450,
              currentStatus: 'dispatched_from_china',
              createdAt: '2026-10-22T08:30:00Z',
            },
            {
              id: 'ship-mock-3',
              trackingNumber: 'GOSH-2026-7733',
              clientName: 'Dhaka Green Energy Solutions',
              originCity: 'Yiwu',
              originCountry: 'China',
              destinationCity: 'Dhaka',
              serviceType: 'road',
              weightKg: 4050,
              currentStatus: 'out_for_delivery',
              createdAt: '2026-10-20T14:15:00Z',
            }
          ] as any[]).map((s, idx) => {
            const invoiceNum = `INV-2026-${(1080 + idx).toString()}`;
            const weight = Number(s.weightKg) || 50;
            const isAir = s.serviceType === 'air';
            const isSea = s.serviceType === 'sea';
            const isHandCarry = s.serviceType === 'hand_carry';
            
            // Tariff calculation
            const freightRate = isAir ? 750 : isSea ? 240 : isHandCarry ? 1450 : 500;
            const baseFreight = Math.round(weight * freightRate);
            const customsDuty = Math.round(baseFreight * 0.05);
            const terminalHandling = isSea ? 8500 : 2500;
            const fuelSurcharge = isAir ? 2200 : 1500;
            const subtotal = baseFreight + customsDuty + terminalHandling + fuelSurcharge;
            const vatTax = Math.round(subtotal * 0.15);
            const totalBDT = subtotal + vatTax;
            const totalUSD = Math.round(totalBDT / 118);

            const isDeliveredOrPaid = s.currentStatus === 'delivered' || s.currentStatus === 'payment_received';
            const hasOverride = invoicePaidOverrides[invoiceNum] !== undefined;
            const isPaid = hasOverride ? invoicePaidOverrides[invoiceNum] : isDeliveredOrPaid;

            return {
              invoiceNumber: invoiceNum,
              shipmentId: s.id,
              trackingNumber: s.trackingNumber,
              customerName: s.clientName || 'Commercial Importer',
              recipient: s.recipientName || `${s.destinationCity || 'Dhaka'} Consignee`,
              destination: `${s.originCity || 'China'} → ${s.destinationCity || 'Dhaka, Bangladesh'}`,
              mode: s.serviceType || 'air',
              weightKg: weight,
              baseFreight,
              customsDuty,
              terminalHandling,
              fuelSurcharge,
              subtotal,
              vatTax,
              totalBDT,
              totalUSD,
              status: isPaid ? 'paid' : (idx === 1 ? 'pending' : 'pending'),
              issueDate: new Date(Date.now() - (idx + 1) * 86400000 * 2).toLocaleDateString('en-GB'),
              dueDate: new Date(Date.now() + (7 - idx) * 86400000).toLocaleDateString('en-GB'),
              paymentMethod: idx % 2 === 0 ? 'Bank Wire (EFT / RTGS)' : 'bKash Merchant Pay',
            };
          });

          // Merge server-generated invoices if any exist
          const mergedInvoices = (() => {
            if (serverInvoices && serverInvoices.length > 0) {
              const serverList = serverInvoices.map((inv: any) => {
                const hasOverride = invoicePaidOverrides[inv.invoiceNumber] !== undefined;
                const isPaid = hasOverride ? invoicePaidOverrides[inv.invoiceNumber] : inv.status === 'paid';
                return {
                  ...inv,
                  weightKg: inv.totalWeightKg || inv.weightKg || 50,
                  status: isPaid ? 'paid' : 'pending'
                };
              });
              const serverInvoiceNums = new Set(serverList.map((i: any) => i.invoiceNumber));
              const nonDuplicateDerived = derivedInvoices.filter((d) => !serverInvoiceNums.has(d.invoiceNumber));
              return [...serverList, ...nonDuplicateDerived];
            }
            return derivedInvoices;
          })();

          // Metrics
          const totalInvoicedBDT = mergedInvoices.reduce((acc, inv) => acc + inv.totalBDT, 0);
          const totalPaidBDT = mergedInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.totalBDT, 0);
          const totalPendingBDT = totalInvoicedBDT - totalPaidBDT;
          const paidPercentage = totalInvoicedBDT > 0 ? Math.round((totalPaidBDT / totalInvoicedBDT) * 100) : 0;

          // Filter invoices: Real-time search by invoice #, customer name, company, email, phone & tracking #
          const filteredInvoices = mergedInvoices.filter(inv => {
            const q = invoiceSearch.trim().toLowerCase();
            const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;

            if (!q) {
              return matchesStatus;
            }

            const linkedCust = allCustomerOptions.find(
              (c) =>
                (c.fullName && inv.customerName && c.fullName.toLowerCase() === inv.customerName.toLowerCase()) ||
                (c.companyName && inv.customerName && c.companyName.toLowerCase() === inv.customerName.toLowerCase())
            );

            const qDigits = q.replace(/\D/g, '');
            const linkedCustPhoneDigits = (linkedCust?.phone || '').replace(/\D/g, '');
            const phoneMatches = qDigits.length >= 3 && linkedCustPhoneDigits.includes(qDigits);

            const matchesSearch =
              inv.invoiceNumber.toLowerCase().includes(q) ||
              inv.customerName.toLowerCase().includes(q) ||
              inv.trackingNumber.toLowerCase().includes(q) ||
              inv.destination.toLowerCase().includes(q) ||
              (linkedCust?.companyName && linkedCust.companyName.toLowerCase().includes(q)) ||
              (linkedCust?.fullName && linkedCust.fullName.toLowerCase().includes(q)) ||
              (linkedCust?.email && linkedCust.email.toLowerCase().includes(q)) ||
              phoneMatches;
            
            return matchesSearch && matchesStatus;
          });

          // IF IN GENERATE INVOICE STUDIO VIEW (IN-PAGE, NO POPUP, NO RELOAD)
          if (invoiceSubView === 'generate') {
            const activeShipment = selectedShipmentForInvoice || shipments[0];
            if (!activeShipment) {
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                  <p className="text-slate-500 text-sm">No shipments currently available to invoice.</p>
                  <button
                    type="button"
                    onClick={() => setInvoiceSubView('list')}
                    className="px-4 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold cursor-pointer"
                  >
                    Back to Invoices
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-5 font-['Inter',sans-serif]">
                {/* 1. Header Navigation Strip */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setInvoiceSubView('list')}
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        <span>Back to Invoices</span>
                      </button>

                      <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                            Generate Commercial Invoice
                          </h2>
                          <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-[#EA1D2C] font-semibold border border-red-200">
                            {activeShipment.trackingNumber}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Select arrived items, review freight charges, and issue invoice directly to client
                        </p>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoiceSubView('list')}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingInvoice || computedSelectedCount === 0}
                        onClick={handleCreateShipmentInvoice}
                        className="px-4 py-1.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                      >
                        {isSubmittingInvoice ? (
                          <span>Generating...</span>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span>Issue Invoice ({computedSelectedCount} Products)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Target Shipment Selector & Consignment Details */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Target Shipment Consignment
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        Client &amp; Transit Details
                      </h3>
                    </div>

                    {/* Dropdown to switch shipment dynamically */}
                    <div className="w-full sm:w-96">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Switch Shipment Order:
                      </label>
                      <select
                        value={activeShipment.id}
                        onChange={(e) => handleSelectShipmentForInvoice(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-slate-50/50 hover:bg-white text-xs font-medium text-slate-800 outline-none focus:border-[#EA1D2C] cursor-pointer"
                      >
                        {shipments.map((shp) => (
                          <option key={shp.id} value={shp.id}>
                            {shp.trackingNumber} — {shp.customerName} ({shp.originCity} → {shp.destCity}, {shp.mode.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dynamic shipment metadata badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">Customer / Importer</span>
                      <strong className="text-slate-900 block truncate font-semibold mt-0.5">
                        {activeShipment.customerName}
                      </strong>
                      <span className="text-[11px] text-slate-500 font-mono block truncate">
                        {activeShipment.customerEmail || activeShipment.customerPhone || 'Verified Account'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">Corridor &amp; Route</span>
                      <div className="flex items-center gap-1 font-semibold text-slate-900 mt-0.5">
                        <span>{activeShipment.originCity}</span>
                        <span className="text-slate-400">→</span>
                        <span>{activeShipment.destCity}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                          activeShipment.mode === 'air'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : activeShipment.mode === 'sea'
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {activeShipment.mode.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 truncate">
                          {activeShipment.voyageOrFlightNumber || 'Direct Freight'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">Declared Consignment</span>
                      <strong className="text-slate-900 font-mono font-semibold block mt-0.5">
                        {activeShipment.totalWeightKg} KG · {activeShipment.totalCbm} m³
                      </strong>
                      <span className="text-[11px] text-slate-500 block truncate">
                        {activeShipment.totalPieces || effectiveInvoiceItems.length} Total Units
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">Destination Consignee</span>
                      <strong className="text-slate-900 block truncate font-semibold mt-0.5">
                        {activeShipment.recipientName || activeShipment.customerName}
                      </strong>
                      <span className="text-[11px] text-slate-500 block truncate">
                        {activeShipment.recipientAddress || 'Dhaka Warehouse'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Arrived Products & Selective Invoicing Table */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          Select Arrived Products to Invoice
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {effectiveInvoiceItems.length} Total Products
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {computedSelectedCount} Selected for Billing
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Check each product that physically arrived at the hub. Unarrived items can be left unchecked for a future invoice.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          effectiveInvoiceItems.forEach(it => { next[it.id] = true; });
                          setInvoiceSelectedItems(next);
                        }}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceSelectedItems({})}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Informational guidance note (No emojis, clean SVG icon) */}
                  <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900">
                    <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <div className="text-[11px] leading-relaxed">
                      <strong>Split Shipment Billing:</strong> You can uncheck items or decrease the arrived quantity/weight if a partial consignment arrived. The customer will only be billed for the selected arrived cargo.
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-semibold text-slate-600 uppercase border-b border-slate-200 tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">Arrived?</th>
                          <th className="py-2.5 px-3 min-w-[220px]">Product Description &amp; Item Code</th>
                          <th className="py-2.5 px-3 w-28 text-center">Declared Qty</th>
                          <th className="py-2.5 px-3 w-32">Arrived Qty</th>
                          <th className="py-2.5 px-3 w-36">Arrived Weight (KG)</th>
                          <th className="py-2.5 px-3 w-32 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {effectiveInvoiceItems.map((it) => {
                          const isChecked = !!invoiceSelectedItems[it.id];
                          const arrivedQty = invoiceItemArrivedQtys[it.id] !== undefined ? invoiceItemArrivedQtys[it.id] : it.quantity;
                          const arrivedWeight = invoiceItemArrivedWeights[it.id] !== undefined ? invoiceItemArrivedWeights[it.id] : it.weightKg;

                          return (
                            <tr key={it.id} className={`hover:bg-slate-50/70 transition-colors ${isChecked ? 'bg-emerald-50/20' : ''}`}>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setInvoiceSelectedItems(prev => ({
                                      ...prev,
                                      [it.id]: e.target.checked
                                    }));
                                  }}
                                  className="w-4 h-4 text-[#EA1D2C] rounded border-slate-300 focus:ring-[#EA1D2C] cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{it.description}</div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                  <span className="font-semibold text-slate-700">{it.itemCode}</span>
                                  <span>·</span>
                                  <span className="capitalize">{it.packagingType?.replace('_', ' ')}</span>
                                  <span>·</span>
                                  <span className="text-slate-600">{it.categoryTag}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                {it.quantity} units
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min="1"
                                  max={it.quantity}
                                  disabled={!isChecked}
                                  value={arrivedQty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setInvoiceItemArrivedQtys(prev => ({ ...prev, [it.id]: val }));
                                  }}
                                  className="w-20 h-7 px-2 font-mono text-xs rounded border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    disabled={!isChecked}
                                    value={arrivedWeight}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setInvoiceItemArrivedWeights(prev => ({ ...prev, [it.id]: val }));
                                    }}
                                    className="w-24 h-7 px-2 font-mono text-xs rounded border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                  <span className="text-slate-500 text-[11px] font-mono">KG</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isChecked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Arrived &amp; Bill</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                    <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span>Pending Arrival</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Tariff Calculation & Financial Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Tariff &amp; Collection Schedule
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        Billing &amp; Payment Calculation
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Billable Arrived Weight:</span>
                      <span className="font-mono text-sm font-bold text-slate-900 ml-1.5">{computedArrivedWeight} KG</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Freight Rate per KG (BDT)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={invoiceRatePerKg}
                          onChange={(e) => setInvoiceRatePerKg(Number(e.target.value))}
                          className="w-full h-8 pl-7 pr-2 font-mono font-bold rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:border-[#EA1D2C] outline-none"
                        />
                        <span className="absolute left-2.5 top-2 text-slate-400 font-mono">৳</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={invoiceCustomNumber}
                        onChange={(e) => setInvoiceCustomNumber(e.target.value)}
                        className="w-full h-8 px-2.5 font-mono font-semibold rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:border-[#EA1D2C] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payment Method</label>
                      <select
                        value={invoicePaymentMethod}
                        onChange={(e) => setInvoicePaymentMethod(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 text-xs focus:border-[#EA1D2C] outline-none cursor-pointer"
                      >
                        <option value="Bank Wire (EFT / RTGS)">Bank Wire (EFT / RTGS)</option>
                        <option value="bKash Merchant Pay">bKash Merchant Pay</option>
                        <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payment Due Date</label>
                      <input
                        type="text"
                        value={invoiceDueDate}
                        onChange={(e) => setInvoiceDueDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="w-full h-8 px-2.5 font-mono rounded-md border border-slate-300 bg-white text-slate-900 text-xs focus:border-[#EA1D2C] outline-none"
                      />
                    </div>
                  </div>

                  {/* Calculated Breakdown Card */}
                  <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Base Freight ({computedArrivedWeight} KG × ৳{invoiceRatePerKg}):</span>
                      <span className="font-semibold text-slate-900">৳{computedBaseFreight.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Terminal Handling Charges (THC):</span>
                      <span className="font-semibold text-slate-900">৳{computedTHC.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Customs Clearance (5%):</span>
                      <span className="font-semibold text-slate-900">৳{computedCustoms.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Fuel &amp; Security Surcharge:</span>
                      <span className="font-semibold text-slate-900">৳{computedFuel.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Statutory VAT (15%):</span>
                      <span className="font-semibold text-slate-900">৳{computedVAT.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline font-bold text-sm text-[#EA1D2C]">
                      <span className="font-sans">Total Amount to Collect:</span>
                      <span>
                        ৳{computedTotalBDT.toLocaleString()}
                        <span className="text-[11px] text-slate-500 font-normal ml-1.5">(~${Math.round(computedTotalBDT / 118).toLocaleString()} USD)</span>
                      </span>
                    </div>
                  </div>

                  {/* Initial Payment Status Toggle with ZERO emojis! */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">Payment Status:</span>
                      <button
                        type="button"
                        onClick={() => setInvoicePaymentStatus(invoicePaymentStatus === 'paid' ? 'pending' : 'paid')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-none inline-flex items-center gap-1.5 shadow-2xs ${
                          invoicePaymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {invoicePaymentStatus === 'paid' ? (
                          <>
                            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Marked as Paid &amp; Cleared</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>Pending Payment Collection</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 max-w-md">
                      <input
                        type="text"
                        placeholder="Optional billing note or terms..."
                        value={invoiceNotes}
                        onChange={(e) => setInvoiceNotes(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:border-[#EA1D2C] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Action Footer */}
                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setInvoiceSubView('list')}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel &amp; Return
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingInvoice || computedSelectedCount === 0}
                    onClick={handleCreateShipmentInvoice}
                    className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] disabled:opacity-50 text-white text-xs font-semibold transition-none shadow-sm cursor-pointer flex items-center gap-2"
                  >
                    {isSubmittingInvoice ? (
                      <span>Generating Commercial Invoice...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>Generate Commercial Invoice ({computedSelectedCount} Products · ৳{computedTotalBDT.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          }

          // Otherwise render Invoices List view
          return (
            <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs">
              {/* Header Strip */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Invoices &amp; Billing
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage customer invoices, payment status, and download tax receipts
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (shipments.length > 0) {
                        handleOpenGenerateInvoice(shipments[0]);
                      } else {
                        showToast('No active shipments available to invoice', 'error');
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold cursor-pointer transition-none shadow-2xs"
                    title="Select arrived products from a shipment and generate invoice"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>+ Generate Shipment Invoice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," + 
                        "Invoice,Customer,Tracking,Mode,WeightKG,TotalBDT,TotalUSD,Status\n" +
                        mergedInvoices.map(i => `${i.invoiceNumber},"${i.customerName}",${i.trackingNumber},${i.mode},${i.weightKg},${i.totalBDT},${i.totalUSD},${i.status}`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `GoShipping_Invoices_${new Date().toISOString().slice(0,10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-none shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Total Invoiced
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      ৳{totalInvoicedBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (~${Math.round(totalInvoicedBDT / 118).toLocaleString()})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {mergedInvoices.length} commercial invoices generated
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                    Paid &amp; Collected
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-emerald-700">
                      ৳{totalPaidBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-600 font-bold">
                      {paidPercentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 mt-1 block">
                    Settled via Bank / bKash
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
                    Outstanding Due
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-amber-700">
                      ৳{totalPendingBDT.toLocaleString()}
                    </span>
                    <span className="text-xs text-amber-600 font-bold">
                      {100 - paidPercentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-600 mt-1 block">
                    Pending customs release
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Average Tariff / KG
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      ৳685/KG
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      All-Inclusive
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Including 5% duty + 15% VAT
                  </span>
                </div>
              </div>

              {/* Search & Filter Strip */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search by Invoice #, customer, tracking code..."
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                  <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <label className="text-slate-500 font-medium">Status:</label>
                  <div className="w-48">
                    <ReferenceSelect
                      value={invoiceStatusFilter}
                      onChange={(val) => setInvoiceStatusFilter(val)}
                      options={[
                        { value: 'all', label: `All Invoices (${derivedInvoices.length})` },
                        { value: 'paid', label: `Paid (${derivedInvoices.filter(i => i.status === 'paid').length})`, badge: 'Paid' },
                        { value: 'pending', label: `Pending (${derivedInvoices.filter(i => i.status === 'pending').length})`, badge: 'Pending' }
                      ]}
                      placeholder="Status"
                    />
                  </div>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Customer &amp; Recipient</th>
                      <th className="py-3 px-4">Order Code</th>
                      <th className="py-3 px-4">Freight &amp; Route</th>
                      <th className="py-3 px-4">Amount (BDT / USD)</th>
                      <th className="py-3 px-4">Payment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.invoiceNumber} className="hover:bg-slate-50/70 transition-none">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Issued: {inv.issueDate}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {inv.customerName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {inv.recipient}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <a
                            href={`/tracking?code=${inv.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono font-bold text-[#EA1D2C] hover:underline"
                          >
                            <span>{inv.trackingNumber}</span>
                            <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-700 font-mono">
                              {inv.mode}
                            </span>
                            <span className="font-mono text-slate-600 font-medium">
                              {inv.weightKg} KG
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                            {inv.destination}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-slate-900 block text-sm">
                            ৳{inv.totalBDT.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ~${inv.totalUSD.toLocaleString()} USD
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              const newStatus = inv.status !== 'paid';
                              setInvoicePaidOverrides(prev => ({
                                ...prev,
                                [inv.invoiceNumber]: newStatus
                              }));
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-none ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                            title="Click to toggle Paid / Pending"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'paid' ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                            <span>{inv.status === 'paid' ? 'Paid / Cleared' : 'Pending Payment'}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (inv.destination && (inv.destination.toLowerCase().includes('malaysia') || inv.destination.toLowerCase().includes('kuala lumpur') || inv.destination.toLowerCase().includes('selangor'))) {
                                  setSelectedSettlementBankId('maybank-my');
                                } else {
                                  setSelectedSettlementBankId('scb-bd');
                                }
                                setIsEditingBank(false);
                                setPreviewInvoice(inv);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-none inline-flex items-center gap-1 shadow-2xs"
                            >
                              <span>View Tax Invoice</span>
                              <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No commercial invoices found matching "{invoiceSearch}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* TAB: HOMEPAGE HERO BANNERS & SLIDER                       */}
        {/* ========================================================= */}
        {activeTab === 'banners' && (
          <BannersManager showToast={showToast} />
        )}

        {/* ========================================================= */}
        {/* TAB: CLIENT REVIEWS & TESTIMONIALS                        */}
        {/* ========================================================= */}
        {(activeTab === 'testimonials' || activeTab === 'reviews') && (
          <TestimonialsManager showToast={showToast} />
        )}

        {/* ========================================================= */}
        {/* TAB: GLOBAL WAREHOUSE LOCATIONS & CFS HUBS               */}
        {/* ========================================================= */}
        {activeTab === 'warehouses' && (
          <div className="space-y-6">
            {/* Header & Primary Action */}
            <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Warehouse Locations &amp; CFS Hubs
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {warehouses.length} Active Hubs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Operational receiving points, sorting yards, and fulfillment centers across China, Bangladesh, and Malaysia.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={openAddWarehouseModal}
                    className="px-4 py-2 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-95 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-none"
                  >
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>+ Add Warehouse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab('new_order')}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-none cursor-pointer"
                  >
                    + Create Order
                  </button>
                </div>
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-100">
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Facilities</span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">{warehouses.length}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Active consolidation hubs</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">CN</span> China Origin Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'china').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sanyuanli Ave, Guangzhou</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">BD</span> Bangladesh Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'bangladesh').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">43/31 Sabujkanon, Dhaka</span>
                </div>
                <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                    <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">MY</span> Malaysia Hub
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-['Manrope',sans-serif]">
                    {warehouses.filter((w) => w.country.toLowerCase() === 'malaysia').length}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sungai Buloh, Selangor</span>
                </div>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'all', label: `All Facilities (${warehouses.length})` },
                  { id: 'China', label: `China (${warehouses.filter(w => w.country.toLowerCase() === 'china').length})` },
                  { id: 'Bangladesh', label: `Bangladesh (${warehouses.filter(w => w.country.toLowerCase() === 'bangladesh').length})` },
                  { id: 'Malaysia', label: `Malaysia (${warehouses.filter(w => w.country.toLowerCase() === 'malaysia').length})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWarehouseCountryFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-none ${
                      warehouseCountryFilter.toLowerCase() === tab.id.toLowerCase()
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search code, name, city, manager..."
                  value={warehouseSearch}
                  onChange={(e) => setWarehouseSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Warehouse Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWarehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:border-slate-300 flex flex-col justify-between space-y-4 transition-none"
                >
                  <div className="space-y-3">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {wh.code}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {wh.country === 'Bangladesh' ? 'BD' : wh.country === 'Malaysia' ? 'MY' : 'CN'}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        wh.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${wh.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {wh.isActive ? 'Active Station' : 'Inactive'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif] leading-snug">
                        {wh.name}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 break-words">{wh.address}</p>
                    </div>
                  </div>

                  {/* Floor Capacity & Occupancy Bar */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Floor Capacity: <b className="text-slate-800">{wh.capacitySqft.toLocaleString()} sqft</b></span>
                      <span className="font-mono font-bold text-slate-900">{wh.currentOccupancyPct}% Occupied</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          wh.currentOccupancyPct > 80
                            ? 'bg-amber-500'
                            : wh.currentOccupancyPct > 50
                            ? 'bg-emerald-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, wh.currentOccupancyPct))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Contact Person Details */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Station Lead:</span>
                      <span className="font-medium text-slate-800">{wh.contactPerson || 'Ops Lead'}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400 font-sans">Contact:</span>
                      <span className="text-slate-700">{wh.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono truncate">
                      <span className="text-slate-400 font-sans">Email:</span>
                      <span className="text-slate-700 truncate max-w-[170px]" title={wh.email}>{wh.email || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Action Buttons: Edit and Delete */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditWarehouseModal(wh)}
                      className="w-full py-1.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-none shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Edit Hub</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteWarehouseModal(wh)}
                      className="w-full py-1.5 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-none shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredWarehouses.length === 0 && (
              <div className="bg-white rounded-xl p-12 border border-slate-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                  <svg className="w-6 h-6 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect width="16" height="20" x="4" y="2" rx="2" />
                    <path d="M9 22v-4h6v4" />
                    <path d="M8 6h.01" />
                    <path d="M16 6h.01" />
                    <path d="M12 6h.01" />
                    <path d="M12 10h.01" />
                    <path d="M12 14h.01" />
                    <path d="M16 10h.01" />
                    <path d="M16 14h.01" />
                    <path d="M8 10h.01" />
                    <path d="M8 14h.01" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Warehouse Facilities Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {warehouseSearch
                    ? `No facilities matched your search query "${warehouseSearch}".`
                    : 'No warehouse facilities active under this country filter.'}
                </p>
                <button
                  type="button"
                  onClick={openAddWarehouseModal}
                  className="px-4 py-2 rounded-lg bg-[var(--color-brand-primary)] text-white text-xs font-bold hover:opacity-95 cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                >
                  + Add New Warehouse
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: USERS & IMPORTERS DIRECTORY                           */}
        {/* ========================================================= */}
        {(activeTab === 'users' || activeTab === 'customers') && (
          <div className="bg-white rounded-lg p-4 sm:p-5 border border-slate-200 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Users &amp; Staff
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold whitespace-nowrap">
                    {filteredUsers.length} Registered Users
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage user accounts, roles, and admin permissions
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetUserForm();
                  setShowAddUserModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold transition-none shadow-xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add New User</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search user by name, email, company, or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:border-[#EA1D2C] outline-none"
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <div className="w-44">
                <ReferenceSelect
                  value={userRoleFilter}
                  onChange={(val) => setUserRoleFilter(val)}
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'customer', label: 'Customers & Importers', badge: 'Client' },
                    { value: 'super_admin', label: 'Super Admins', badge: 'Admin' },
                    { value: 'ops_manager', label: 'Operations Managers', badge: 'Ops' },
                    { value: 'warehouse_staff', label: 'Warehouse Staff', badge: 'Hub' },
                    { value: 'sales_team', label: 'Sales Team', badge: 'Sales' },
                    { value: 'support_agent', label: 'Support Agents', badge: 'Help' }
                  ]}
                  placeholder="Role"
                />
              </div>

              <div className="w-36">
                <ReferenceSelect
                  value={userStatusFilter}
                  onChange={(val) => setUserStatusFilter(val)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'active', label: 'Active Only', badge: 'Active' },
                    { value: 'suspended', label: 'Suspended Only', badge: 'Hold' }
                  ]}
                  placeholder="Status"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setUserSearch('');
                  setUserRoleFilter('all');
                  setUserStatusFilter('all');
                }}
                className="h-8 px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[200px]">User Profile</th>
                    <th className="py-2.5 px-3 w-[140px] whitespace-nowrap">Role</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Company &amp; Phone</th>
                    <th className="py-2.5 px-3 w-[110px] whitespace-nowrap">Shipments</th>
                    <th className="py-2.5 px-3 w-[90px] whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 w-[60px] text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u, idx) => {
                    const isSuperAdmin = u.role === 'super_admin';
                    const isOps = u.role === 'ops_manager';
                    const isCustomer = u.role === 'customer';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                              {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <strong className="text-slate-900 block truncate font-medium text-xs">
                                {u.fullName}
                              </strong>
                              <span className="text-slate-500 font-mono text-[11px] block truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isSuperAdmin && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              Super Admin
                            </span>
                          )}
                          {isOps && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-white border border-slate-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              Ops Manager
                            </span>
                          )}
                          {u.role === 'warehouse_staff' && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              Warehouse
                            </span>
                          )}
                          {u.role === 'sales_team' && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              Sales Team
                            </span>
                          )}
                          {u.role === 'support_agent' && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                              Support Agent
                            </span>
                          )}
                          {isCustomer && (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Importer Client
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-800 block text-xs truncate">
                            {u.companyName || u.fullName}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px] block truncate">
                            {u.phone || 'No phone recorded'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-medium text-slate-900 text-xs">
                            {u.activeShipmentsCount ?? 0} active
                          </span>
                          <span className="text-slate-400 block text-[10px]">
                            {u.totalQuotesCount ?? 0} quotes
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {u.status === 'active' ? (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Active
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              Suspended
                            </span>
                          )}
                        </td>

                        {/* Admin Action Bar - 3-Dot Dropdown */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <UserRowActionMenu
                            user={u}
                            onImpersonate={handleImpersonateUser}
                            onEdit={openEditUserModal}
                            onToggleStatus={handleToggleUserStatus}
                            onDelete={handleDeleteUser}
                            openUpward={idx >= Math.max(0, filteredUsers.length - 2)}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No user accounts match the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: AUDIT & SECURITY TRAIL                                */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                  Activity &amp; Security Logs
                </h2>
                <p className="text-xs text-slate-500">
                  History of admin actions, logins, and order updates
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider font-sans">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Staff / User</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">
                        {log.userName || log.userId || 'System'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {log.entityType ? `${log.entityType}:${log.entityId || ''}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        No audit events recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: ADMIN PROFILE & ACCOUNT SETTINGS                     */}
        {/* ========================================================= */}
        {(activeTab === 'settings' || activeTab === 'profile') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Admin Profile Form */}
            <div className="bg-white rounded-lg p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6 font-['Inter',sans-serif]">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Admin Profile &amp; Operational Credentials
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#EA1D2C] border border-red-200 font-mono">
                    Administrator
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Update your administrative profile, official contact email, phone number, and security credentials.
                </p>
              </div>

              {adminProfileSuccessMsg && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{adminProfileSuccessMsg}</span>
                </div>
              )}

              {adminProfileError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-300 text-xs text-red-800 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{adminProfileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdminProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={adminProfileName}
                      onChange={(e) => setAdminProfileName(e.target.value)}
                      required
                      placeholder="Operations Director"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Email Address</label>
                    <input
                      type="email"
                      value={adminProfileEmail}
                      onChange={(e) => setAdminProfileEmail(e.target.value)}
                      required
                      placeholder="admin@goshipping.com"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Direct Contact Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={adminProfilePhone}
                      onChange={(e) => setAdminProfilePhone(e.target.value)}
                      placeholder="+880 1711 000000"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department / Organization</label>
                    <input
                      type="text"
                      value={adminProfileCompany}
                      onChange={(e) => setAdminProfileCompany(e.target.value)}
                      placeholder="GoShipping Headquarters"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Change Password <span className="font-normal text-slate-400">(leave blank to keep current)</span>
                  </label>
                  <input
                    type="password"
                    value={adminProfilePassword}
                    onChange={(e) => setAdminProfilePassword(e.target.value)}
                    placeholder="Enter new admin password"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Role permissions remain controlled by enterprise RBAC.
                  </span>
                  <button
                    type="submit"
                    disabled={savingAdminProfile}
                    className="px-5 py-2.5 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-none shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    {savingAdminProfile ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Profile Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Dynamic Shipping Routes, Modes & Fulfillment Rules Panel */}
            <div className="bg-white rounded-lg p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5 font-['Inter',sans-serif]">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Shipping Routes &amp; Fulfillment Rules
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live dynamic configuration for public &amp; customer booking portal.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  Live Sync
                </span>
              </div>

              {shippingConfigSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{shippingConfigSuccessMsg}</span>
                </div>
              )}

              {/* Transport Modes SLA Config */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1. Transport Modes &amp; SLAs
                </span>
                <div className="space-y-2">
                  {(adminShippingConfig?.modes || [
                    { id: 'air', label: 'By Air', badge: '7–14 Days', minDays: 7, maxDays: 14, active: true },
                    { id: 'sea', label: 'By Ship', badge: '30–45 Days', minDays: 30, maxDays: 45, active: true },
                    { id: 'hand_carry', label: 'Hand Carry', badge: '24–48 Hours', minDays: 1, maxDays: 2, active: true }
                  ]).map((m: any, idx: number) => (
                    <div key={m.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={m.active !== false}
                          onChange={(e) => {
                            const updated = { ...(adminShippingConfig || {}) };
                            if (!updated.modes) {
                              updated.modes = [
                                { id: 'air', label: 'By Air', badge: '7–14 Days', minDays: 7, maxDays: 14, active: true },
                                { id: 'sea', label: 'By Ship', badge: '30–45 Days', minDays: 30, maxDays: 45, active: true },
                                { id: 'hand_carry', label: 'Hand Carry', badge: '24–48 Hours', minDays: 1, maxDays: 2, active: true }
                              ];
                            }
                            updated.modes[idx].active = e.target.checked;
                            setAdminShippingConfig(updated);
                          }}
                          className="w-4 h-4 text-[#EA1D2C] accent-[#EA1D2C] rounded cursor-pointer"
                        />
                        <span className="font-bold text-slate-900">{m.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">SLA:</span>
                        <input
                          type="text"
                          value={m.badge}
                          onChange={(e) => {
                            const updated = { ...(adminShippingConfig || {}) };
                            if (!updated.modes) {
                              updated.modes = [
                                { id: 'air', label: 'By Air', badge: '7–14 Days', minDays: 7, maxDays: 14, active: true },
                                { id: 'sea', label: 'By Ship', badge: '30–45 Days', minDays: 30, maxDays: 45, active: true },
                                { id: 'hand_carry', label: 'Hand Carry', badge: '24–48 Hours', minDays: 1, maxDays: 2, active: true }
                              ];
                            }
                            updated.modes[idx].badge = e.target.value;
                            setAdminShippingConfig(updated);
                          }}
                          className="h-7 w-28 px-2 text-xs font-mono font-bold rounded border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination Fulfillment Rules */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  2. Destination Fulfillment Corridors
                </span>
                <div className="space-y-3">
                  {/* Bangladesh */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">BD</span> Bangladesh
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                        Active Corridor
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold block text-slate-800">1. Doorstep Delivery</span>
                        <span className="text-slate-500 text-[10px]">Dhaka &amp; Chittagong</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold block text-slate-800">2. Courier Delivery</span>
                        <span className="text-slate-500 text-[10px]">All over Bangladesh (64 Districts)</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold block text-slate-800">3. Pickup Options</span>
                        <span className="text-slate-500 text-[10px]">Dhaka Hub &amp; CTG Seaport CFS</span>
                      </div>
                    </div>
                  </div>

                  {/* Malaysia */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-700">MY</span> Malaysia
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                        Active Corridor
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold block text-slate-800">1. Courier Delivery</span>
                        <span className="text-slate-500 text-[10px]">All over Malaysia (Peninsular &amp; East MY)</span>
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <span className="font-bold block text-slate-800">2. Pickup Options</span>
                        <span className="text-slate-500 text-[10px]">Selangor Receiving Hub (Sungai Buloh)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveShippingConfig}
                  disabled={savingShippingConfig}
                  className="px-4 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-none shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {savingShippingConfig ? 'Saving...' : 'Save Shipping Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* ========================================================= */}
      {/* 01. MODAL: CONVERT QUOTE TO SHIPMENT (BUDGET & EDIT)      */}
      {/* ========================================================= */}
      {showConvertQuoteModal && selectedQuoteForConvert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                    Convert Quote to Active Shipment
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                    {selectedQuoteForConvert.quoteNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Client: <strong className="text-slate-800">{selectedQuoteForConvert.guestName}</strong> ({selectedQuoteForConvert.guestEmail || 'No email'} · {selectedQuoteForConvert.guestPhone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConvertQuoteModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer transition-none"
              >
                <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Section 1: Negotiated Final Budget & Pricing */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-700 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v12M16 10H9.5a2.5 2.5 0 0 0 0 5H15a2.5 2.5 0 0 1 0 5H8"/>
                  </svg>
                  Agreed Negotiated Budget &amp; Price
                </span>
                <span className="text-[11px] text-amber-700 font-medium">Negotiate before creating shipment</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Negotiated Total Price / Freight Charge</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={convertNegotiatedPrice || ''}
                      onChange={(e) => setConvertNegotiatedPrice(Number(e.target.value))}
                      placeholder="e.g. 329400"
                      className="w-full h-9 pl-8 pr-3 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                    />
                    <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-mono font-bold">
                      {convertCurrency === 'BDT' ? '৳' : '$'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">Currency</label>
                  <select
                    value={convertCurrency}
                    onChange={(e) => setConvertCurrency(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="BDT">BDT (৳ Taka)</option>
                    <option value="USD">USD ($ Dollar)</option>
                    <option value="RMB">RMB (¥ Yuan)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 block">Negotiation Notes &amp; Commercial Terms</label>
                <input
                  type="text"
                  value={convertPricingNotes}
                  onChange={(e) => setConvertPricingNotes(e.target.value)}
                  placeholder="e.g. Agreed 5% volume rebate on Guangzhou BAI export handling."
                  className="w-full h-8 px-3 text-xs rounded border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Route & Freight Mode */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Consignment Route &amp; Mode</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Mode</label>
                  <select
                    value={convertMode}
                    onChange={(e) => setConvertMode(e.target.value as any)}
                    className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-slate-800 font-bold"
                  >
                    <option value="air">BY AIR (Express)</option>
                    <option value="sea">BY SEA (Ocean)</option>
                    <option value="road">BY ROAD</option>
                    <option value="hand_carry">HAND CARRY</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Service Level</label>
                  <select
                    value={convertServiceLevel}
                    onChange={(e) => setConvertServiceLevel(e.target.value as any)}
                    className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-slate-800 font-medium"
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                    <option value="priority">Priority</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Origin City</label>
                  <input
                    type="text"
                    value={convertOriginCity}
                    onChange={(e) => setConvertOriginCity(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Destination City</label>
                  <input
                    type="text"
                    value={convertDestCity}
                    onChange={(e) => setConvertDestCity(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Cargo & Packaging Specifications */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Cargo Specifications</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Cargo Description</label>
                  <input
                    type="text"
                    value={convertCargoDescription}
                    onChange={(e) => setConvertCargoDescription(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Product Title</label>
                  <input
                    type="text"
                    value={convertProductName}
                    onChange={(e) => setConvertProductName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Total Weight (KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={convertTotalWeightKg || ''}
                    onChange={(e) => setConvertTotalWeightKg(Number(e.target.value))}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Volume (CBM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={convertTotalCbm || ''}
                    onChange={(e) => setConvertTotalCbm(Number(e.target.value))}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Total Pieces / Units</label>
                  <input
                    type="number"
                    value={convertQuantity || ''}
                    onChange={(e) => setConvertQuantity(Number(e.target.value))}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Packaging</label>
                  <select
                    value={convertPackagingType}
                    onChange={(e) => setConvertPackagingType(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="carton">Export Carton</option>
                    <option value="pallet">Wooden Pallet</option>
                    <option value="air_uld">Air Freight ULD</option>
                    <option value="40ft_hq">40ft HQ Container</option>
                    <option value="20ft_container">20ft Container</option>
                    <option value="drum">Steel Drum / Barrel</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Product Items Breakdown (Supports multiple products in 1 shipment) */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Product Items in Consignment ({convertItems.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConvertItems((prev) => [
                      ...prev,
                      {
                        description: '',
                        itemCode: `#ITM-${1000 + prev.length + 1}`,
                        quantity: 1,
                        weightKg: 10,
                        cbm: 0.05,
                        packagingType: 'carton',
                        categoryTag: 'Commercial'
                      }
                    ]);
                  }}
                  className="text-[11px] font-semibold text-[#EA1D2C] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Add Another Product</span>
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {convertItems.map((it, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConvertItems((prev) => prev.map((item, i) => i === idx ? { ...item, description: val } : item));
                        }}
                        placeholder="Product description..."
                        className="w-full h-7 px-2 rounded border border-slate-200 bg-white text-slate-800 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        value={it.quantity || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConvertItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                        }}
                        placeholder="Qty"
                        className="w-full h-7 px-2 rounded border border-slate-200 bg-white text-slate-800 font-mono text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.1"
                        value={it.weightKg || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConvertItems((prev) => prev.map((item, i) => i === idx ? { ...item, weightKg: val } : item));
                        }}
                        placeholder="KG"
                        className="w-full h-7 px-2 rounded border border-slate-200 bg-white text-slate-800 font-mono text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={it.packagingType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConvertItems((prev) => prev.map((item, i) => i === idx ? { ...item, packagingType: val } : item));
                        }}
                        className="w-full h-7 px-1.5 rounded border border-slate-200 bg-white text-slate-800 text-[11px]"
                      >
                        <option value="carton">Carton</option>
                        <option value="pallet">Pallet</option>
                        <option value="air_uld">ULD</option>
                        <option value="40ft_hq">40HQ</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1 text-right">
                      {convertItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setConvertItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Remove item"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 5: Delivery & Recipient */}
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Recipient &amp; Delivery in Bangladesh</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={convertRecipientName}
                    onChange={(e) => setConvertRecipientName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={convertRecipientPhone}
                    onChange={(e) => setConvertRecipientPhone(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={convertRecipientAddress}
                    onChange={(e) => setConvertRecipientAddress(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowConvertQuoteModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isConvertingQuote}
                  onClick={() => handleSaveConvertQuote(false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-none cursor-pointer"
                  title="Convert immediately using current quote info"
                >
                  Instant Convert (Default)
                </button>
                <button
                  type="button"
                  disabled={isConvertingQuote}
                  onClick={() => handleSaveConvertQuote(true)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-semibold transition-none shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isConvertingQuote ? (
                    <span>Converting...</span>
                  ) : (
                    <>
                      <span>Save &amp; Convert to Shipment</span>
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 03. MODAL: CELEBRATION / TRACKING ORDER CREATED SUCCESS    */}
      {/* ========================================================= */}
      {createdShipmentResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 text-center font-['Inter',sans-serif]">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <svg className="w-7 h-7 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
                Tracking Order Created Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                New order registered and live on GoShipping tracking.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-left text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Tracking Number:</span>
                <span className="font-mono font-extrabold text-sm text-[#EA1D2C] bg-red-50 px-2 py-0.5 rounded border border-red-200 select-all">
                  {createdShipmentResult.trackingNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{createdShipmentResult.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Route &amp; Mode:</span>
                <span className="font-semibold text-slate-800">{createdShipmentResult.route} ({createdShipmentResult.mode})</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <a
                href={`/tracking?code=${encodeURIComponent(createdShipmentResult.trackingNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-none"
              >
                <span>Open in Public Live Tracker ↗</span>
              </a>



              <button
                type="button"
                onClick={() => setCreatedShipmentResult(null)}
                className="w-full py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-none"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 03. MODAL: RATE PRICING QUOTE                              */}
      {/* ========================================================= */}
      {showPricingModal && selectedQuoteForPricing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Price Quote: {selectedQuoteForPricing.quoteNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedQuoteForPricing.guestName} · {selectedQuoteForPricing.originCity} → {selectedQuoteForPricing.destCity} ({selectedQuoteForPricing.totalWeightKg} KG)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPricingModal(false);
                  setSelectedQuoteForPricing(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handlePriceQuote} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Freight Charge (BDT)</label>
                  <input
                    type="number"
                    value={baseFreight}
                    onChange={(e) => setBaseFreight(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fuel Surcharge (BDT)</label>
                  <input
                    type="number"
                    value={fuelSurcharge}
                    onChange={(e) => setFuelSurcharge(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customs Clearance (BDT)</label>
                  <input
                    type="number"
                    value={customsClearanceFee}
                    onChange={(e) => setCustomsClearanceFee(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warehouse Handling (BDT)</label>
                  <input
                    type="number"
                    value={handlingFee}
                    onChange={(e) => setHandlingFee(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center font-bold">
                <span className="text-slate-700 text-xs">Calculated Total Payable:</span>
                <span className="text-sm font-mono text-[#EA1D2C]">
                  ৳{(
                    (parseFloat(baseFreight) || 0) +
                    (parseFloat(fuelSurcharge) || 0) +
                    (parseFloat(customsClearanceFee) || 0) +
                    (parseFloat(handlingFee) || 0)
                  ).toLocaleString()} BDT
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pricing Notes & Terms</label>
                <textarea
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowPricingModal(false);
                    setSelectedQuoteForPricing(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPricing}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold"
                >
                  {submittingPricing ? 'Saving...' : 'Issue Formal Price →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 04. MODAL: ADD NEW USER PROFILE                            */}
      {/* ========================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  + Register New User Profile
                </h3>
                <p className="text-xs text-slate-500">
                  Create a new importer client, staff officer, or operations manager account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg aria-hidden="true" className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tariqul Islam"
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="tariqul@company.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                  <ReferenceSelect
                    value={userRole}
                    onChange={(val) => setUserRole(val)}
                    options={[
                      { value: 'customer', label: 'Customer / Importer', badge: 'Client' },
                      { value: 'ops_manager', label: 'Operations Manager', badge: 'Ops' },
                      { value: 'warehouse_staff', label: 'Warehouse Officer', badge: 'Hub' },
                      { value: 'sales_team', label: 'Sales Team', badge: 'Sales' },
                      { value: 'support_agent', label: 'Support Agent', badge: 'Help' },
                      { value: 'super_admin', label: 'Super Administrator', badge: 'Admin' }
                    ]}
                    placeholder="Account Role"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Password</label>
                  <input
                    type="password"
                    placeholder="Initial password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Textiles Ltd"
                    value={userCompanyName}
                    onChange={(e) => setUserCompanyName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="+880 1711 000000"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery / Warehouse Address</label>
                <input
                  type="text"
                  placeholder="Street, EPZ, District, Postal Code"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BIN / Trade License #</label>
                  <input
                    type="text"
                    placeholder="002918291-0102"
                    value={userBin}
                    onChange={(e) => setUserBin(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                  <ReferenceSelect
                    value={userStatus}
                    onChange={(val) => setUserStatus(val)}
                    options={[
                      { value: 'active', label: 'Active', badge: 'Active' },
                      { value: 'suspended', label: 'Suspended', badge: 'Hold' }
                    ]}
                    placeholder="Status"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold transition-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-bold transition-none shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Registering...' : 'Create User Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 05. MODAL: EDIT USER PROFILE                               */}
      {/* ========================================================= */}
      {showEditUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Edit User Profile &amp; Role
                </h3>
                <p className="text-xs text-slate-500">
                  Update corporate credentials, role privileges, and contact details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <svg aria-hidden="true" className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Role</label>
                  <ReferenceSelect
                    value={userRole}
                    onChange={(val) => setUserRole(val)}
                    options={[
                      { value: 'customer', label: 'Customer / Importer', badge: 'Client' },
                      { value: 'ops_manager', label: 'Operations Manager', badge: 'Ops' },
                      { value: 'warehouse_staff', label: 'Warehouse Officer', badge: 'Hub' },
                      { value: 'sales_team', label: 'Sales Team', badge: 'Sales' },
                      { value: 'support_agent', label: 'Support Agent', badge: 'Help' },
                      { value: 'super_admin', label: 'Super Administrator', badge: 'Admin' }
                    ]}
                    placeholder="Account Role"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <ReferenceSelect
                    value={userStatus}
                    onChange={(val) => setUserStatus(val)}
                    options={[
                      { value: 'active', label: 'Active', badge: 'Active' },
                      { value: 'suspended', label: 'Suspended', badge: 'Hold' }
                    ]}
                    placeholder="Status"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={userCompanyName}
                    onChange={(e) => setUserCompanyName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery / Warehouse Address</label>
                <input
                  type="text"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">BIN / Trade License #</label>
                <input
                  type="text"
                  value={userBin}
                  onChange={(e) => setUserBin(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold transition-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-bold transition-none shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: OFFICIAL COMMERCIAL TAX INVOICE PREVIEW            */}
      {/* ========================================================= */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img src="/brand/logo-light.svg" alt="GoShipping" className="h-7 w-auto object-contain" />
                <div className="border-l border-slate-300 pl-3">
                  <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                    Commercial Freight &amp; Customs Tax Invoice
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{previewInvoice.invoiceNumber}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer transition-none"
              >
                <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bill To & Metadata */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Billed To (Importer):</span>
                <p className="font-bold text-slate-900 text-sm">{previewInvoice.customerName}</p>
                <p className="text-slate-600 mt-0.5">{previewInvoice.destination}</p>
                <p className="text-slate-500 font-mono mt-1">Consignee: {previewInvoice.recipient}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Invoice Details:</span>
                <p className="font-mono text-slate-800">Date: {previewInvoice.issueDate}</p>
                <p className="font-mono text-slate-800">Due Date: {previewInvoice.dueDate}</p>
                <p className="font-mono font-bold text-[#EA1D2C] mt-1">Shipment: {previewInvoice.trackingNumber}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <span>{previewInvoice.status === 'paid' ? 'PAID &amp; CLEARED' : 'PAYMENT PENDING'}</span>
                </div>
              </div>
            </div>

            {/* Arrived Items Breakdown if available */}
            {previewInvoice.items && previewInvoice.items.length > 0 && (
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wide">
                    Arrived Products Billed ({previewInvoice.items.length}):
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Warehouse Arrived &amp; Verified
                  </span>
                </div>
                <div className="divide-y divide-slate-200/60 font-sans">
                  {previewInvoice.items.map((it: any, idx: number) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-900">{it.description}</span>
                        <span className="text-[10px] font-mono text-slate-500 ml-2">({it.itemCode || `#ITM-${idx + 1}`})</span>
                      </div>
                      <div className="font-mono text-slate-700 text-right text-xs">
                        <span>{it.arrivedQuantity || it.quantity || 1} units</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="font-bold">{it.weightKg} KG</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-[#EA1D2C] font-bold">৳{(it.amountBDT || Math.round((it.weightKg || 1) * (it.ratePerKg || 750))).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Description &amp; Customs Tariff Item</th>
                    <th className="py-2.5 px-3 text-right">Basis</th>
                    <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">International Freight Forwarding Charge</span>
                      <span className="text-[11px] text-slate-500">{previewInvoice.mode.toUpperCase()} Express Door-to-Door</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">{previewInvoice.weightKg} KG</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">৳{previewInvoice.baseFreight.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Port Terminal Handling Charges (THC)</span>
                      <span className="text-[11px] text-slate-500">Dhaka HSIA / Chittagong Port berth and unloading</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">Fixed</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.terminalHandling.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Customs Clearance Levy &amp; Regulatory Pre-Assessment</span>
                      <span className="text-[11px] text-slate-500">National Board of Revenue (NBR) ASYCUDA World documentation</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">5.0%</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.customsDuty.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Fuel &amp; Security Surcharge</span>
                      <span className="text-[11px] text-slate-500">Carrier bunker adjustment factor (BAF)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">Standard</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.fuelSurcharge.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-bold text-slate-900 block">Statutory Value Added Tax (VAT)</span>
                      <span className="text-[11px] text-slate-500">Bangladesh VAT Act 2012</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">15.0%</td>
                    <td className="py-2.5 px-3 text-right">৳{previewInvoice.vatTax.toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-mono">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 text-right font-bold text-slate-900 font-sans text-xs">Total Amount Due:</td>
                    <td className="py-3 px-3 text-right font-bold text-base text-[#EA1D2C]">
                      ৳{previewInvoice.totalBDT.toLocaleString()}
                      <span className="text-[10px] text-slate-500 block font-normal">(~${previewInvoice.totalUSD.toLocaleString()} USD)</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Dynamic Settlement Bank & Wire Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs">Settlement Bank Account</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#EA1D2C]/10 text-[#EA1D2C]">
                      Dynamic Remittance
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Remittance bank for wire / EFT transfer, tax receipt and commercial clearance
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-64">
                    <ReferenceSelect
                      value={selectedSettlementBankId}
                      onChange={(val) => {
                        setSelectedSettlementBankId(val);
                        if (val === 'custom') {
                          setIsEditingBank(true);
                        }
                      }}
                      options={[
                        { value: 'scb-bd', label: 'Standard Chartered Bank BD (Gulshan)', badge: 'BD' },
                        { value: 'city-bd', label: 'The City Bank PLC (Corporate Branch)', badge: 'BD' },
                        { value: 'brac-bd', label: 'BRAC Bank PLC (Corporate Branch)', badge: 'BD' },
                        { value: 'dbbl-bd', label: 'Dutch-Bangla Bank PLC (Motijheel)', badge: 'BD' },
                        { value: 'maybank-my', label: 'Maybank Malaysia (Menara Maybank)', badge: 'MY' },
                        { value: 'cimb-my', label: 'CIMB Bank Berhad (KL Sentral)', badge: 'MY' },
                        { value: 'custom', label: 'Custom Bank Account...', badge: 'Custom' }
                      ]}
                      placeholder="Select Bank"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingBank(!isEditingBank)}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-white bg-slate-100 text-slate-700 transition-none cursor-pointer inline-flex items-center gap-1"
                    title="Customize bank name, account number or routing"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>{isEditingBank ? 'Done' : 'Edit Bank'}</span>
                  </button>
                </div>
              </div>

              {!isEditingBank ? (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block text-xs">
                      {currentSettlementBank.bankName}
                    </span>
                    <p className="text-[11px] text-slate-600">
                      Beneficiary: <span className="font-semibold text-slate-800">{currentSettlementBank.accountName}</span>
                    </p>
                    <p className="font-mono text-[11px] text-slate-700">
                      A/C: <span className="font-bold text-slate-900">{currentSettlementBank.accountNumber}</span> · Routing: {currentSettlementBank.routingNumber} · Swift: {currentSettlementBank.swiftCode}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Branch: {currentSettlementBank.branch}
                    </p>
                  </div>
                  <div className="text-left sm:text-right space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/80 w-full sm:w-auto">
                    <span className="font-bold text-slate-900 block text-xs">
                      BIN: {currentSettlementBank.binNumber}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block">
                      {currentSettlementBank.taxNote}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Currency: {currentSettlementBank.currency}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.bankName : currentSettlementBank.bankName}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, bankName: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="e.g. Standard Chartered / City Bank"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Account Name / Beneficiary</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.accountName : currentSettlementBank.accountName}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, accountName: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="GoShipping Logistics Ltd"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Account Number</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.accountNumber : currentSettlementBank.accountNumber}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, accountNumber: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 font-mono text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="A/C Number"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Branch Name &amp; Location</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.branch : currentSettlementBank.branch}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, branch: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="Branch name & location"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Routing Number</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.routingNumber : currentSettlementBank.routingNumber}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, routingNumber: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 font-mono text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="Routing number"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">SWIFT / BIC Code</label>
                    <input
                      type="text"
                      value={selectedSettlementBankId === 'custom' ? customBankDetails.swiftCode : currentSettlementBank.swiftCode}
                      onChange={(e) => {
                        setSelectedSettlementBankId('custom');
                        setCustomBankDetails({ ...customBankDetails, swiftCode: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 font-mono text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#EA1D2C]"
                      placeholder="e.g. SCBLBDDX"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
                Direct vector PDF generation · Mushak 6.3 compliant
              </span>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs transition-none cursor-pointer hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadInvoicePDF(previewInvoice, currentSettlementBank);
                    showToast(`Invoice ${previewInvoice.invoiceNumber} PDF downloaded successfully!`, 'success');
                  }}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold text-xs transition-none shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download PDF Invoice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL: ADD NEW WAREHOUSE FACILITY                         */}
      {/* ========================================================= */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  + Add Warehouse Facility
                </h3>
                <p className="text-xs text-slate-500">
                  Register a new receiving, bonded CFS, or fulfillment hub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hub Code <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHA-01, KUL-02"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <ReferenceSelect
                    value={whCountry}
                    onChange={(val) => {
                      setWhCountry(val);
                      if (val === 'China') setWhPhone('+86 20 8888 0000');
                      else if (val === 'Malaysia') setWhPhone('+60 11-1234 5678');
                      else setWhPhone('+880 1711 000000');
                    }}
                    options={[
                      { value: 'China', label: 'China', badge: 'CN' },
                      { value: 'Bangladesh', label: 'Bangladesh', badge: 'BD' },
                      { value: 'Malaysia', label: 'Malaysia', badge: 'MY' }
                    ]}
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Facility Name <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guangzhou Baiyun Gateway"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    City <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Guangzhou, Selangor, Dhaka"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Street &amp; Building Address <span className="text-[#EA1D2C]">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, building name, industrial zone, postal code"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Lead</label>
                  <input
                    type="text"
                    placeholder="Manager name"
                    value={whContactPerson}
                    onChange={(e) => setWhContactPerson(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+880 / +86 / +60"
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="hub@goshipping.com.bd"
                    value={whEmail}
                    onChange={(e) => setWhEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacity (Sqft)</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={whCapacitySqft}
                    onChange={(e) => setWhCapacitySqft(Number(e.target.value) || 20000)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupancy (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={whCurrentOccupancyPct}
                    onChange={(e) => setWhCurrentOccupancyPct(Number(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Status</label>
                  <ReferenceSelect
                    value={whIsActive ? 'active' : 'inactive'}
                    onChange={(val) => setWhIsActive(val === 'active')}
                    options={[
                      { value: 'active', label: 'Active Station', badge: 'Active' },
                      { value: 'inactive', label: 'Inactive / Offline', badge: 'Offline' }
                    ]}
                    placeholder="Status"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddWarehouseModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50 transition-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWarehouse}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingWarehouse ? 'Registering...' : '+ Create Warehouse Hub'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT WAREHOUSE FACILITY                            */}
      {/* ========================================================= */}
      {showEditWarehouseModal && selectedWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Edit Warehouse: {selectedWarehouse.code}
                </h3>
                <p className="text-xs text-slate-500">
                  Update facility address, storage capacity, and station leadership.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditWarehouseModal(false);
                  setSelectedWarehouse(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateWarehouse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hub Code <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <ReferenceSelect
                    value={whCountry}
                    onChange={(val) => setWhCountry(val)}
                    options={[
                      { value: 'China', label: 'China', badge: 'CN' },
                      { value: 'Bangladesh', label: 'Bangladesh', badge: 'BD' },
                      { value: 'Malaysia', label: 'Malaysia', badge: 'MY' }
                    ]}
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Facility Name <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    City <span className="text-[#EA1D2C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={whCity}
                    onChange={(e) => setWhCity(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Street &amp; Building Address <span className="text-[#EA1D2C]">*</span>
                </label>
                <textarea
                  rows={2}
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Lead</label>
                  <input
                    type="text"
                    value={whContactPerson}
                    onChange={(e) => setWhContactPerson(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={whPhone}
                    onChange={(e) => setWhPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={whEmail}
                    onChange={(e) => setWhEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Capacity (Sqft)</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={whCapacitySqft}
                    onChange={(e) => setWhCapacitySqft(Number(e.target.value) || 20000)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupancy (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={whCurrentOccupancyPct}
                    onChange={(e) => setWhCurrentOccupancyPct(Number(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Station Status</label>
                  <ReferenceSelect
                    value={whIsActive ? 'active' : 'inactive'}
                    onChange={(val) => setWhIsActive(val === 'active')}
                    options={[
                      { value: 'active', label: 'Active Station', badge: 'Active' },
                      { value: 'inactive', label: 'Inactive / Offline', badge: 'Offline' }
                    ]}
                    placeholder="Status"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditWarehouseModal(false);
                    setSelectedWarehouse(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer hover:bg-slate-50 transition-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWarehouse}
                  className="px-5 py-2 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-95 text-white font-bold transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submittingWarehouse ? 'Updating...' : 'Save Hub Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE WAREHOUSE FACILITY CONFIRMATION             */}
      {/* ========================================================= */}
      {showDeleteWarehouseModal && selectedWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 font-['Inter',sans-serif]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                  Delete Warehouse Facility?
                </h3>
                <p className="text-xs text-slate-500">
                  This action will permanently delete this facility from the network.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Hub Code:</span>
                <span className="font-mono font-bold text-slate-900">{selectedWarehouse.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facility:</span>
                <span className="font-semibold text-slate-900">{selectedWarehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700">{selectedWarehouse.city}, {selectedWarehouse.country}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Note: This warehouse will immediately be removed from all active order origin and destination selector dropdowns.
            </p>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteWarehouseModal(false);
                  setSelectedWarehouse(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50 transition-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingWarehouse}
                onClick={handleDeleteWarehouse}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-none shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deletingWarehouse ? 'Deleting...' : 'Confirm Delete Facility'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold bg-slate-900 text-white animate-in fade-in slide-in-from-bottom-2 duration-150 border border-slate-700/80">
          {toastNotification.type === 'success' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
          )}
          {toastNotification.type === 'error' && (
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
          )}
          {toastNotification.type === 'info' && (
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}
    </div>
  );
}
