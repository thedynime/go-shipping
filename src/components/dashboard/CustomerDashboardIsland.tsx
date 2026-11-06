import React, { useState, useEffect } from 'react';
import LiveTrackingIsland from '../marketing/LiveTrackingIsland';
import QuoteCalculatorIsland from '../marketing/QuoteCalculatorIsland';
import ReferenceSelect from '../common/ReferenceSelect';
import {
  StatCardSkeleton,
  TableTabSkeleton,
  InvoicesTabSkeleton
} from '../common/DashboardSkeleton';
import type { ShipmentRecord } from '../../server/services/shipment.service';
import type { QuoteRecord } from '../../server/services/quote.service';

interface UserProps {
  id: string;
  email: string;
  fullName: string;
  role?: string;
  status?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  binNumber?: string;
}

interface Props {
  initialTab?: string;
  user?: UserProps;
  userEmail?: string;
}

function StatusIconBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase().trim();

  let label = status.replace(/_/g, ' ').toUpperCase();
  let iconColor = 'text-slate-500 hover:text-slate-800';
  let icon = (
    <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  switch (normalized) {
    case 'purchased':
    case 'order_created':
      label = 'PURCHASED';
      iconColor = 'text-slate-600 hover:text-slate-900';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
      break;

    case 'cn_warehouse_received':
    case 'warehouse_received':
      label = 'CN WAREHOUSE RECEIVED';
      iconColor = 'text-blue-600 hover:text-blue-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
      break;

    case 'dispatched_from_china':
    case 'in_transit':
      label = 'DISPATCHED FROM CHINA';
      iconColor = 'text-indigo-600 hover:text-indigo-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
        </svg>
      );
      break;

    case 'arrived_dhaka_airport':
      label = 'ARRIVED DHAKA AIRPORT';
      iconColor = 'text-purple-600 hover:text-purple-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M2 22h20" />
          <path d="M19 16l-7-3-4 1-2-2 1.5-1.5L11 12l7-2 3 3z" />
        </svg>
      );
      break;

    case 'awaiting_customs':
    case 'customs_clearance':
      label = 'AWAITING CUSTOMS CLEARANCE';
      iconColor = 'text-amber-500 hover:text-amber-700';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
      break;

    case 'bd_warehouse_received':
      label = 'BD WAREHOUSE RECEIVED';
      iconColor = 'text-sky-600 hover:text-sky-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
          <path d="M9 9v.01" />
          <path d="M9 13v.01" />
        </svg>
      );
      break;

    case 'payment_received':
      label = 'PAYMENT RECEIVED';
      iconColor = 'text-emerald-600 hover:text-emerald-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
      break;

    case 'out_for_delivery':
      label = 'OUT FOR DELIVERY';
      iconColor = 'text-orange-500 hover:text-orange-700';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="16" height="13" x="1" y="6" rx="2" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
          <path d="M17 10h4l3 3v3h-3" />
        </svg>
      );
      break;

    case 'delivered':
      label = 'DELIVERED';
      iconColor = 'text-green-600 hover:text-green-800';
      icon = (
        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
      break;
  }

  return (
    <div className="relative group inline-flex items-center cursor-pointer">
      <div
        className={`flex items-center justify-center transition-colors ${iconColor}`}
        title={label}
        aria-label={label}
      >
        {icon}
      </div>

      {/* Floating Hover Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex flex-col items-center">
        <div className="bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded shadow-lg whitespace-nowrap tracking-wide border border-slate-700">
          {label}
        </div>
        <div className="w-2 h-1 bg-slate-900 [clip-path:polygon(0_0,100%_0,50%_100%)]"></div>
      </div>
    </div>
  );
}

export default function CustomerDashboardIsland({ initialTab = 'overview', user, userEmail = '' }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);
  const [selectedTrackingCode, setSelectedTrackingCode] = useState<string>('');
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<ShipmentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter for My Shipments
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentModeFilter, setShipmentModeFilter] = useState('all');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');

  // Search & Filter for My Quotes
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('all');

  // Document Modal Preview State
  const [previewDoc, setPreviewDoc] = useState<{
    type: 'mawb' | 'invoice';
    shipment?: ShipmentRecord;
    title: string;
    docNumber: string;
    amount?: number;
    date: string;
  } | null>(null);

  // Profile Form State
  const [profileName, setProfileName] = useState(user?.fullName || 'Apex Textiles Ltd');
  const [profileCompany, setProfileCompany] = useState(user?.companyName || user?.fullName || 'Apex Textiles Ltd');
  const [profileEmail, setProfileEmail] = useState(user?.email || userEmail || 'client@apextextiles.com');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '+880 1711 000000');
  const [profileAddress, setProfileAddress] = useState(user?.address || 'Export Processing Zone, Savar, Dhaka 1349, Bangladesh');
  const [profileBin, setProfileBin] = useState(user?.binNumber || '002918291-0102');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Sync tab with URL and custom event
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      let urlTab = params.get('tab') || 'overview';
      if (urlTab === 'invoices' || urlTab === 'invoice') urlTab = 'documents';
      if (urlTab === 'profile') urlTab = 'settings';
      if (urlTab === 'get-quote' || urlTab === 'quote') urlTab = 'request-quote';
      if (urlTab !== tab) {
        setTab(urlTab);
      }
      const urlCode = params.get('code');
      if (urlCode && urlCode !== selectedTrackingCode) {
        setSelectedTrackingCode(urlCode);
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);

    const handleCustomSwitch = (e: any) => {
      if (e.detail && e.detail !== tab) {
        setTab(e.detail);
      }
    };
    window.addEventListener('switch-dashboard-tab', handleCustomSwitch);

    const handleSelectTracking = (e: any) => {
      if (e.detail?.code) {
        setSelectedTrackingCode(e.detail.code);
        setTab('tracking');
      }
    };
    window.addEventListener('select-tracking-code', handleSelectTracking);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('switch-dashboard-tab', handleCustomSwitch);
      window.removeEventListener('select-tracking-code', handleSelectTracking);
    };
  }, [tab, selectedTrackingCode]);

  const switchTab = (newTab: string) => {
    setTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new CustomEvent('dashboard-tab-changed', { detail: newTab }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resShipments, resQuotes] = await Promise.all([
        fetch('/api/shipments').then((r) => r.json()).catch(() => ({ success: false, shipments: [] })),
        fetch('/api/quotes').then((r) => r.json()).catch(() => ({ success: false, quotes: [] }))
      ]);

      if (resShipments.success && resShipments.shipments) {
        setShipments(resShipments.shipments);
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code');
        if (urlCode) {
          setSelectedTrackingCode(urlCode);
        }
      }
      if (resQuotes.success && resQuotes.quotes) {
        setQuotes(resQuotes.quotes);
      }
    } catch (err) {
      console.error('Error fetching dashboard records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter shipments
  const filteredShipments = shipments.filter((s) => {
    const q = shipmentSearch.toLowerCase().trim();
    const matchesQ =
      !q ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.originCity.toLowerCase().includes(q) ||
      s.destCity.toLowerCase().includes(q) ||
      (s.carrierName && s.carrierName.toLowerCase().includes(q)) ||
      (s.voyageOrFlightNumber && s.voyageOrFlightNumber.toLowerCase().includes(q));

    const matchesMode = shipmentModeFilter === 'all' || s.mode === shipmentModeFilter;
    const matchesStatus = shipmentStatusFilter === 'all' || s.status === shipmentStatusFilter;

    return matchesQ && matchesMode && matchesStatus;
  });

  // Filter quotes
  const filteredQuotes = quotes.filter((q) => {
    const query = quoteSearch.toLowerCase().trim();
    const matchesQ =
      !query ||
      q.quoteNumber.toLowerCase().includes(query) ||
      q.originCity.toLowerCase().includes(query) ||
      q.destCity.toLowerCase().includes(query) ||
      q.cargoDescription.toLowerCase().includes(query);

    const matchesStatus = quoteStatusFilter === 'all' || q.status === quoteStatusFilter;
    return matchesQ && matchesStatus;
  });

  // KPI metrics
  const activeShipments = shipments.filter((s) => s.status !== 'delivered');
  const pendingQuotes = quotes.filter((q) => q.status === 'submitted' || q.status === 'under_review');
  const pricedQuotes = quotes.filter((q) => q.status === 'priced');
  const totalWeightKg = shipments.reduce((sum, s) => sum + (s.totalWeightKg || 0), 0);

  // Status badge styling helper
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

  // Handle quote conversion (accept & book)
  const handleAcceptQuote = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to convert quote');

      alert(`Quotation accepted! Master shipment created with tracking: ${data.shipmentId}`);
      setSelectedQuote(null);
      await loadData();
      if (data.shipmentId) {
        setSelectedTrackingCode(data.shipmentId);
      }
      switchTab('shipments');
    } catch (err: any) {
      alert(err.message || 'Error converting quote');
    }
  };

  // Handle profile update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccessMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profileName,
          email: profileEmail,
          companyName: profileCompany,
          phone: profilePhone,
          address: profileAddress,
          binNumber: profileBin,
          ...(profilePassword ? { password: profilePassword } : {})
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setProfileSuccessMsg('Profile information updated and saved successfully!');
      setProfilePassword('');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const getHeaderInfo = (currentTab: string) => {
    switch (currentTab) {
      case 'overview':
        return {
          title: 'Overview',
          subtitle: 'Your shipments, tracking, and billing summary'
        };
      case 'shipments':
        return {
          title: 'My Shipments',
          subtitle: `All your current and past shipments (${shipments.length})`
        };
      case 'tracking':
        return {
          title: 'Live Tracking',
          subtitle: 'Real-time location and delivery progress'
        };
      case 'quotes':
        return {
          title: 'My Quotes',
          subtitle: `Price estimates and shipping quotes (${quotes.length})`
        };
      case 'request-quote':
      case 'calculator':
        return {
          title: 'Get a Shipping Quote',
          subtitle: 'Enter package details to get an instant price quote'
        };
      case 'documents':
        return {
          title: 'Invoices & Documents',
          subtitle: 'Download invoices and shipping documents'
        };
      case 'settings':
        return {
          title: 'Account Settings',
          subtitle: 'Manage your profile and delivery address'
        };
      default:
        return {
          title: 'Overview',
          subtitle: 'Your shipments, tracking, and billing summary'
        };
    }
  };

  const headerInfo = getHeaderInfo(tab);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-['Inter',sans-serif]">
      {/* Top Application Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            id="customer-mobile-menu-btn"
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
            {headerInfo.title}
          </h1>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-none shadow-2xs cursor-pointer"
            title="Refresh portal records"
          >
            <svg className={`w-3.5 h-3.5 stroke-[2] text-slate-500 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => switchTab('request-quote')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-none shadow-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Get a Quote</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace with standard generous padding & independent scrolling */}
      <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {loading ? (
          <div className="space-y-6 animate-in fade-in duration-150">
            {tab !== 'request-quote' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
            )}
            {tab === 'documents' ? (
              <InvoicesTabSkeleton />
            ) : tab === 'request-quote' ? (
              <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-6 shadow-xs animate-pulse">
                <div className="h-6 w-48 bg-slate-200 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-100 rounded" />
                </div>
              </div>
            ) : (
              <TableTabSkeleton columns={6} rows={5} />
            )}
          </div>
        ) : (
          <>
      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD                                 */}
      {/* ========================================================= */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500">Active shipments</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {activeShipments.length}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">In-transit & customs nodes</span>
            </div>

            <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500">Priced quotations</span>
              <p className="text-3xl font-extrabold text-[#EA1D2C] tabular-nums">
                {pricedQuotes.length}
              </p>
              <span className="text-[11px] text-slate-500 font-medium">Ready for your confirmation</span>
            </div>

            <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500">Pending review</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {pendingQuotes.length}
              </p>
              <span className="text-[11px] text-amber-600 font-medium">Operations calculating tariff</span>
            </div>

            <div className="p-5 bg-white rounded-lg border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-slate-500">Total cargo volume</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {totalWeightKg.toLocaleString()} <span className="text-sm font-normal text-slate-500">KG</span>
              </p>
              <span className="text-[11px] text-slate-500 font-medium">Across all trade consignments</span>
            </div>
          </div>

          {/* Active Shipments Quick Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-sm">
                  Active in-flight & sea consignments
                </h2>
                <p className="text-xs text-slate-500">Real-time status of cargo in motion across China ⇄ Bangladesh</p>
              </div>
              <button
                onClick={() => switchTab('shipments')}
                className="text-xs font-semibold text-[#EA1D2C] hover:underline"
              >
                View all ({shipments.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-3 px-4">Tracking code</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Gross weight</th>
                    <th className="py-3 px-4">Current waypoint</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipments.slice(0, 5).map((s) => (
                    <tr
                      key={s.id}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (!target.closest('button') && !target.closest('a')) {
                          setSelectedOrderInfo(s);
                        }
                      }}
                      className="hover:bg-slate-50/70 transition-none cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderInfo(s)}
                          className="text-left font-bold text-slate-900 hover:text-[#EA1D2C] cursor-pointer transition-colors block text-xs"
                          title="Click to view order info"
                        >
                          {s.trackingNumber}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={s.productName || (s as any).cargoDescription || 'Commercial Goods'}>
                          {s.productName || (s as any).cargoDescription || 'Commercial Goods'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {s.originCity} → {s.destCity}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-xs">{s.mode === 'air' ? 'By Air' : s.mode === 'sea' ? 'By Ship' : s.mode === 'hand_carry' ? 'Hand Carry' : s.mode.toUpperCase()}</td>
                      <td className="py-3.5 px-4 tabular-nums font-medium">{s.totalWeightKg} KG</td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate font-medium text-slate-700">
                        {s.currentLocation}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusIconBadge status={s.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedTrackingCode(s.trackingNumber);
                            switchTab('tracking');
                          }}
                          className="px-2.5 py-1 rounded bg-[#F8E9EB] text-[#EA1D2C] font-semibold hover:bg-[#EA1D2C] hover:text-white transition-none"
                        >
                          Track
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shipments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No active consignments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MY SHIPMENTS / CONSIGNMENT REGISTRY                */}
      {/* ========================================================= */}
      {tab === 'shipments' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header & New Booking Button */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">All Shipments</h3>
              <p className="text-xs text-slate-500">Complete record of your shipments and delivery history</p>
            </div>
            <button
              onClick={() => switchTab('request-quote')}
              className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors shadow-xs"
            >
              + Get a Quote
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                value={shipmentSearch}
                onChange={(e) => setShipmentSearch(e.target.value)}
                placeholder="Search tracking #, city, flight or vessel..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-36">
                <ReferenceSelect
                  value={shipmentModeFilter}
                  onChange={(val) => setShipmentModeFilter(val)}
                  options={[
                    { value: 'all', label: 'All Modes' },
                    { value: 'air', label: 'By Air', badge: 'Air' },
                    { value: 'sea', label: 'By Ship', badge: 'Sea' },
                    { value: 'hand_carry', label: 'Hand Carry', badge: 'Express' }
                  ]}
                  placeholder="Mode"
                />
              </div>

              <div className="w-44">
                <ReferenceSelect
                  value={shipmentStatusFilter}
                  onChange={(val) => setShipmentStatusFilter(val)}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'in_transit', label: 'In Transit', badge: 'Transit' },
                    { value: 'customs_clearance', label: 'Customs Clearance', badge: 'Customs' },
                    { value: 'out_for_delivery', label: 'Out for Delivery', badge: 'Final' },
                    { value: 'delivered', label: 'Delivered', badge: 'Done' }
                  ]}
                  placeholder="Status"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tracking Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Mode &amp; Service</th>
                  <th className="py-3 px-4">Weight &amp; Volume</th>
                  <th className="py-3 px-4">Current Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipments.map((s) => (
                  <tr
                    key={s.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (!target.closest('button') && !target.closest('a')) {
                        setSelectedOrderInfo(s);
                      }
                    }}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderInfo(s)}
                        className="text-left font-bold text-slate-900 hover:text-[#EA1D2C] cursor-pointer transition-colors block text-xs"
                        title="Click to view full order info"
                      >
                        {s.trackingNumber}
                      </button>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderInfo(s)}
                          className="text-[10px] text-slate-500 hover:text-[#EA1D2C] font-sans font-medium hover:underline cursor-pointer"
                        >
                          Order Info
                        </button>
                        <span className="text-slate-300">·</span>
                        <a
                          href={`/tracking?code=${encodeURIComponent(s.trackingNumber)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#EA1D2C] hover:underline font-sans font-medium flex items-center gap-0.5"
                        >
                          <span>Public</span>
                          <span>↗</span>
                        </a>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[220px]" title={s.productName || (s as any).cargoDescription || 'Commercial Goods'}>
                        {s.productName || (s as any).cargoDescription || 'Commercial Goods'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {s.originCity} → {s.destCity}
                      </div>
                    </td>
                    <td className="py-4 px-4 uppercase font-mono">
                      {s.mode} · <span className="text-slate-500 font-sans font-medium">{s.serviceLevel}</span>
                    </td>
                    <td className="py-4 px-4 font-mono tabular-nums">
                      {s.totalWeightKg} KG <span className="text-slate-400">/ {s.totalCbm} CBM</span>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-700 max-w-[220px] truncate">
                      {s.currentLocation}
                      <div className="text-[10px] text-slate-400 font-normal">{s.events.length} verified events</div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusIconBadge status={s.status} />
                    </td>
                    <td className="py-4 px-4 text-right pr-5">
                      <button
                        onClick={() => {
                          setSelectedTrackingCode(s.trackingNumber);
                          switchTab('tracking');
                        }}
                        className="px-2.5 py-1 rounded bg-[#F8E9EB] text-[#EA1D2C] font-semibold hover:bg-[#EA1D2C] hover:text-white transition-none"
                      >
                        Track
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredShipments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No consignments matching your criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LIVE CARGO TRACKER                                 */}
      {/* ========================================================= */}
      {tab === 'tracking' && (
        <div className="space-y-4">
          {/* Quick Consignment Picker */}
          {shipments.length > 1 && (
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">Select Shipment to Track:</span>
              <div className="w-full sm:w-96">
                <ReferenceSelect
                  value={selectedTrackingCode}
                  onChange={(val) => setSelectedTrackingCode(val)}
                  options={shipments.map((s) => ({
                    value: s.trackingNumber,
                    label: `${s.trackingNumber} (${s.originCity} → ${s.destCity})`,
                    badge: s.status.replace(/_/g, ' ').toUpperCase()
                  }))}
                  placeholder="Select Consignment to Track"
                  searchable={true}
                />
              </div>
            </div>
          )}

          <LiveTrackingIsland initialTrackingNumber={selectedTrackingCode} pollIntervalMs={12000} />
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MY QUOTATIONS                                       */}
      {/* ========================================================= */}
      {tab === 'quotes' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                Your Shipping Quotes
              </h3>
              <p className="text-xs text-slate-500">Review and accept price estimates for your shipments</p>
            </div>
            <button
              onClick={() => switchTab('request-quote')}
              className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] transition-colors shadow-xs"
            >
              + Get a New Quote
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                placeholder="Search quote number, route, cargo..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="w-56">
              <ReferenceSelect
                value={quoteStatusFilter}
                onChange={(val) => setQuoteStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All Quotation Status' },
                  { value: 'submitted', label: 'Submitted', badge: 'New' },
                  { value: 'under_review', label: 'Under Review', badge: 'Review' },
                  { value: 'priced', label: 'Priced (Ready to Book)', badge: 'Ready' },
                  { value: 'converted', label: 'Confirmed Bookings', badge: 'Booked' }
                ]}
                placeholder="Status"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Quote No</th>
                  <th className="py-3 px-4">Route & Mode</th>
                  <th className="py-3 px-4">Cargo Description</th>
                  <th className="py-3 px-4">Weight & Volume</th>
                  <th className="py-3 px-4">Priced Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((q) => {
                  const latestRev = q.revisions?.[0];
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">{q.quoteNumber}</td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">
                          {q.originCity} → {q.destCity}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{q.mode} Cargo</div>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-600">{q.cargoDescription}</td>
                      <td className="py-4 px-4 font-mono tabular-nums">
                        {q.totalWeightKg} KG <span className="text-slate-400">/ {q.totalCbm} CBM</span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">
                        {latestRev ? `৳${latestRev.totalAmount.toLocaleString()} BDT` : <span className="text-slate-400 font-sans italic font-normal">Pending</span>}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(q.status)}`}>
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right pr-5">
                        {latestRev && q.status !== 'converted' ? (
                          <button
                            onClick={() => setSelectedQuote(q)}
                            className="px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold hover:bg-emerald-600 hover:text-white transition-colors inline-flex items-center gap-1"
                          >
                            <span>View Rate &amp; Accept</span>
                            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : q.status === 'converted' ? (
                          <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                            <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Confirmed</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">In Review</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No quotation records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: QUOTE RATE BREAKDOWN & ACCEPT BOOKING              */}
      {/* ========================================================= */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Itemized Tariff Quotation
                </span>
                <h4 className="text-xl font-mono font-bold text-slate-900">{selectedQuote.quoteNumber}</h4>
                <p className="text-xs text-slate-500">
                  {selectedQuote.originCity} → {selectedQuote.destCity} ({selectedQuote.mode.toUpperCase()})
                </p>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

              {selectedQuote.revisions?.[0] && (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Base Freight Charge:</span>
                    <span className="font-mono font-semibold">৳{selectedQuote.revisions[0].baseFreightCharge.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Bunker / Fuel Surcharge:</span>
                    <span className="font-mono font-semibold">৳{selectedQuote.revisions[0].fuelSurcharge.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Customs Clearance & Documentation:</span>
                    <span className="font-mono font-semibold">৳{selectedQuote.revisions[0].customsClearanceFee.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Terminal Handling & CFS:</span>
                    <span className="font-mono font-semibold">৳{selectedQuote.revisions[0].handlingFee.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Cargo Transit Insurance:</span>
                    <span className="font-mono font-semibold">৳{selectedQuote.revisions[0].insuranceFee.toLocaleString()} BDT</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                    <span>Total All-Inclusive Quotation:</span>
                    <span className="font-mono text-base text-[#EA1D2C]">
                      ৳{selectedQuote.revisions[0].totalAmount.toLocaleString()} BDT
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded border border-slate-200">
                    Notes: {selectedQuote.revisions[0].notes || 'Subject to airline/vessel space availability at departure CFS.'}
                  </p>
                </div>
              )}

              <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5 my-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Operations-Dispatched Freight Policy</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  To maintain strict customs clearance and flight/vessel space allocations, bookings are processed and assigned directly by GoShipping Operations. Contact your account manager to initiate immediate warehouse receipt.
                </p>
              </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <a
                href={`https://wa.me/8801700000000?text=${encodeURIComponent(`Hello GoShipping Ops, I would like to confirm consignment booking for Quotation ${selectedQuote.quoteNumber} (${selectedQuote.originCity} to ${selectedQuote.destCity}).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold transition-none shadow-xs inline-flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                <span>Confirm with Ops Team</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: REQUEST QUOTE WIZARD / RATE CALCULATOR             */}
      {/* ========================================================= */}
      {(tab === 'request-quote' || tab === 'calculator') && (
        <div>
          <QuoteCalculatorIsland
            defaultGuestName={profileName || user?.fullName || 'Apex Textiles Ltd'}
            defaultGuestEmail={profileEmail || user?.email || 'client@apextextiles.com'}
            defaultGuestPhone={profilePhone || '+880 1711 000000'}
            onQuoteCreated={() => loadData()}
            onViewQuotes={() => switchTab('quotes')}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: DOCUMENTS & INVOICES VAULT                         */}
      {/* ========================================================= */}
      {tab === 'documents' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
              Encrypted Freight Documentation & Invoices
            </h3>
            <p className="text-xs text-slate-500">
              Official Master Airway Bills (MAWB), Bills of Lading (BOL), and commercial VAT tax invoices
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {shipments.map((s, idx) => (
              <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {s.mode === 'air' ? 'Airway Bill (MAWB)' : 'Ocean Bill of Lading (BOL)'}: {s.trackingNumber}.pdf
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-slate-100 text-slate-700">
                      Official Doc
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Shipment: {s.trackingNumber} · Carrier: {s.carrierName || 'Cathay Cargo / GoShipping Air'} · {s.originCity} → {s.destCity} ({s.totalWeightKg} KG)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPreviewDoc({
                        type: 'mawb',
                        shipment: s,
                        title: s.mode === 'air' ? 'Master Airway Bill (MAWB)' : 'Ocean Bill of Lading (BOL)',
                        docNumber: s.trackingNumber,
                        date: new Date().toLocaleDateString()
                      })
                    }
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 font-bold text-slate-800 transition-colors"
                  >
                    View & Print Document ↗
                  </button>
                  <button
                    onClick={() =>
                      setPreviewDoc({
                        type: 'invoice',
                        shipment: s,
                        title: 'Commercial Freight & Customs Invoice',
                        docNumber: `INV-2026-${(1080 + idx).toString()}`,
                        amount: s.mode === 'air' ? Math.round(s.totalWeightKg * 750 + 2500) : Math.round(s.totalCbm * 18500 + 4500),
                        date: new Date().toLocaleDateString()
                      })
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold transition-colors shadow-xs"
                  >
                    View Tax Invoice
                  </button>
                </div>
              </div>
            ))}
            {shipments.length === 0 && (
              <p className="py-8 text-center text-slate-400">No documents available yet</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOCUMENT & INVOICE VIEWER / PRINT                  */}
      {/* ========================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img src="/brand/logo-light.svg" alt="GoShipping" className="h-7 w-auto object-contain" />
                <div className="border-l border-slate-300 pl-3">
                  <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
                    {previewDoc.title}
                  </h3>
                  <span className="font-mono text-xs text-slate-500 font-semibold">{previewDoc.docNumber}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Document Content */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Shipper / Origin</span>
                  <div className="font-bold text-slate-900">GoShipping Logistics International Ltd</div>
                  <div className="text-slate-600">Baiyun International Hub, Guangzhou / Yiwu, China</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Consignee / Importer</span>
                  <div className="font-bold text-slate-900">{profileCompany || 'Apex Textiles Ltd'}</div>
                  <div className="text-slate-600">{profileAddress}</div>
                  <div className="font-mono text-[11px] text-slate-500">BIN: {profileBin}</div>
                </div>
              </div>

              {previewDoc.shipment && (
                <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Routing</span>
                      <span className="font-bold text-slate-800">
                        {previewDoc.shipment.originCity} → {previewDoc.shipment.destCity}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Carrier & Flight</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {previewDoc.shipment.carrierName} ({previewDoc.shipment.voyageOrFlightNumber})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Declared Weight</span>
                      <span className="font-mono font-bold text-slate-900">
                        {previewDoc.shipment.totalWeightKg} KG / {previewDoc.shipment.totalCbm} CBM
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {previewDoc.type === 'invoice' && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-emerald-950 block">Commercial Invoice Total:</span>
                    <span className="text-[11px] text-emerald-800">Fully cleared freight, VAT & terminal handling</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-mono font-extrabold text-emerald-700">
                      ৳{previewDoc.amount?.toLocaleString()} BDT
                    </span>
                    <span className="block text-[10px] text-emerald-600 font-bold uppercase">Paid / Account Net-30</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-between items-center border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-mono">Digitally signed & encrypted by GoShipping Cloud</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors"
                >
                  Print / Save as PDF ⎙
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: PROFILE & SETTINGS                                  */}
      {/* ========================================================= */}
      {tab === 'settings' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 max-w-2xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base font-['Manrope',sans-serif]">
              Company & Importer Profile Settings
            </h3>
            <p className="text-xs text-slate-500">
              Update your corporate credentials, billing address, and emergency operations contact
            </p>
          </div>

          {profileSuccessMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-bold flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Registered Name</label>
                <input
                  type="text"
                  value={profileCompany}
                  onChange={(e) => setProfileCompany(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Representative</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone (Mobile / WhatsApp)</label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tax ID / BIN (Business Identification Number)</label>
                <input
                  type="text"
                  value={profileBin}
                  onChange={(e) => setProfileBin(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Update Password (optional)</label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered Factory / Delivery Address (Bangladesh)</label>
              <textarea
                rows={2}
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold text-xs transition-none shadow-xs"
              >
                {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>

          {/* Account Security & Session Management Card */}
          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Account Session & Security</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Signed in as <span className="font-mono font-medium text-slate-800">{profileEmail}</span>
                </p>
              </div>
              <a
                href="/logout"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-none shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out of Account</span>
              </a>
            </div>
          </div>
        </div>
      )}
          </>
        )}

      {/* ========================================================= */}
      {/* ORDER INFO MODAL DIALOG                                   */}
      {/* ========================================================= */}
      {selectedOrderInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0 duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA1D2C]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Order Info
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                      {selectedOrderInfo.mode.toUpperCase()} · {selectedOrderInfo.serviceLevel.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-extrabold font-mono text-slate-900 text-lg flex items-center gap-1.5">
                    <span>{selectedOrderInfo.trackingNumber}</span>
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderInfo(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-lg font-bold transition-none cursor-pointer"
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Product Header with 48x48 Image */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                    {selectedOrderInfo.productImage ? (
                      <img
                        src={selectedOrderInfo.productImage}
                        alt={selectedOrderInfo.productName}
                        className="w-12 h-12 object-cover rounded-lg"
                        width={48}
                        height={48}
                      />
                    ) : (
                      <svg className="w-6 h-6 text-slate-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Product Name</div>
                    <div className="font-bold text-slate-900 text-sm truncate max-w-sm">
                      {selectedOrderInfo.productName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {selectedOrderInfo.totalWeightKg.toLocaleString()} KG · {selectedOrderInfo.totalCbm} CBM · {selectedOrderInfo.totalPieces || selectedOrderInfo.items.length} units
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="flex items-center justify-end gap-1.5">
                    <StatusIconBadge status={selectedOrderInfo.status} />
                    <span className="font-bold text-xs text-slate-800">
                      {selectedOrderInfo.statusLabel || selectedOrderInfo.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border ${
                      selectedOrderInfo.paymentStatus === 'payment_received'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {selectedOrderInfo.paymentStatus === 'payment_received' ? 'PAID' : 'PAYMENT PENDING'}
                  </span>
                </div>
              </div>

              {/* Transit Corridor & Waypoints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Origin Warehouse / Intake
                  </span>
                  <div className="font-bold text-slate-900 text-xs">
                    {selectedOrderInfo.originCity}, {selectedOrderInfo.originCountry}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {selectedOrderInfo.originAddress}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Destination & Delivery
                  </span>
                  <div className="font-bold text-slate-900 text-xs">
                    {selectedOrderInfo.destCity}, {selectedOrderInfo.destCountry}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {selectedOrderInfo.recipientAddress || selectedOrderInfo.destAddress}
                  </p>
                </div>
              </div>

              {/* Shipping Logistics Specs */}
              <div className="p-4 rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Carrier</span>
                    <span className="font-semibold text-slate-900 text-xs">{selectedOrderInfo.carrierName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Flight / Voyage</span>
                    <span className="font-mono text-slate-900 text-xs">{selectedOrderInfo.voyageOrFlightNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Waybill / BOL</span>
                    <span className="font-mono text-slate-900 text-xs">{selectedOrderInfo.billOfLadingNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Est. Delivery</span>
                    <span className="font-mono text-slate-900 text-xs">
                      {selectedOrderInfo.estimatedDelivery ? new Date(selectedOrderInfo.estimatedDelivery).toLocaleDateString('en-GB') : 'In Transit'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cargo Package Items */}
              {selectedOrderInfo.items && selectedOrderInfo.items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Package Contents &amp; Declarations ({selectedOrderInfo.items.length})</span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {selectedOrderInfo.totalWeightKg} KG · {selectedOrderInfo.totalCbm} CBM
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3">Packaging</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Weight</th>
                          <th className="py-2 px-3 text-right">Declared Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrderInfo.items.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-md border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                                  {it.imageUrl || selectedOrderInfo.productImage ? (
                                    <img
                                      src={it.imageUrl || selectedOrderInfo.productImage}
                                      alt={it.description}
                                      className="w-full h-full object-cover"
                                      width={36}
                                      height={36}
                                    />
                                  ) : (
                                    <svg className="w-4 h-4 text-slate-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{it.description}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{it.itemCode} · {it.categoryTag}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 uppercase font-mono text-[11px] text-slate-600">
                              {it.packagingType.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">{it.weightKg} KG</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {it.declaredValue ? `৳${it.declaredValue.toLocaleString()} BDT` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <a
                href={`/tracking?code=${encodeURIComponent(selectedOrderInfo.trackingNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition-none shadow-2xs"
              >
                <span>Public Tracking Page</span>
                <span>↗</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderInfo(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition-none"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const code = selectedOrderInfo.trackingNumber;
                    setSelectedOrderInfo(null);
                    setSelectedTrackingCode(code);
                    switchTab('tracking');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold transition-none shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span>Open Live Tracker</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
