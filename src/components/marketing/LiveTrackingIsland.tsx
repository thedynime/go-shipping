import React, { useState, useEffect, useRef } from 'react';
import type { PublicTrackingResponse, MatchingShipmentSummary } from '../../server/services/tracking.service';
import type { ShipmentItem } from '../../server/services/shipment.service';
import {
  TRACKING_STATUSES,
  PHYSICAL_STAGES,
  TrackingStatusCode,
  calculatePhysicalProgress
} from '../../server/services/tracking-status';
import { formatBstDateTime } from '../../server/utils/date';

interface Props {
  initialTrackingNumber?: string;
  pollIntervalMs?: number;
}

// Live status icon helper without background box, with hover tooltip
function LiveStatusIcon({ status, className = 'w-5 h-5' }: { status: string; className?: string }) {
  const normalized = (status || '').toLowerCase().trim();
  let label = status.replace(/_/g, ' ').toUpperCase();
  let iconColor = 'text-slate-500';
  let icon = (
    <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  switch (normalized) {
    case 'purchased':
    case 'order_created':
      label = 'PURCHASED';
      iconColor = 'text-slate-600 dark:text-slate-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
      break;

    case 'cn_warehouse_received':
    case 'warehouse_received':
      label = 'CN WAREHOUSE RECEIVED';
      iconColor = 'text-blue-600 dark:text-blue-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
      break;

    case 'dispatched_from_china':
    case 'in_transit':
      label = 'DISPATCHED FROM CHINA';
      iconColor = 'text-indigo-600 dark:text-indigo-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
        </svg>
      );
      break;

    case 'arrived_dhaka_airport':
      label = 'ARRIVED DHAKA AIRPORT';
      iconColor = 'text-purple-600 dark:text-purple-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M2 22h20" />
          <path d="M19 16l-7-3-4 1-2-2 1.5-1.5L11 12l7-2 3 3z" />
        </svg>
      );
      break;

    case 'awaiting_customs':
    case 'customs_clearance':
      label = 'AWAITING CUSTOMS CLEARANCE';
      iconColor = 'text-amber-500 dark:text-amber-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
      break;

    case 'bd_warehouse_received':
      label = 'BD WAREHOUSE RECEIVED';
      iconColor = 'text-sky-600 dark:text-sky-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
      iconColor = 'text-emerald-600 dark:text-emerald-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
      break;

    case 'out_for_delivery':
      label = 'OUT FOR DELIVERY';
      iconColor = 'text-orange-500 dark:text-orange-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="16" height="13" x="1" y="6" rx="2" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
          <path d="M17 10h4l3 3v3h-3" />
        </svg>
      );
      break;

    case 'delivered':
      label = 'DELIVERED';
      iconColor = 'text-green-600 dark:text-green-400';
      icon = (
        <svg className={`${className} stroke-[2]`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
      break;
  }

  return (
    <div className="relative group inline-flex items-center cursor-pointer">
      <div className={`flex items-center justify-center transition-colors ${iconColor}`} title={label} aria-label={label}>
        {icon}
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 flex flex-col items-center">
        <div className="px-2.5 py-1 text-[10px] font-mono font-bold text-white bg-slate-900 dark:bg-slate-800 rounded shadow-lg whitespace-nowrap border border-slate-700">
          {label}
        </div>
        <div className="w-1.5 h-1.5 bg-slate-900 dark:bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
      </div>
    </div>
  );
}

export default function LiveTrackingIsland({
  initialTrackingNumber = '',
  pollIntervalMs = 12000
}: Props) {
  const [query, setQuery] = useState(initialTrackingNumber);
  const [trackingData, setTrackingData] = useState<PublicTrackingResponse | null>(null);
  const [matchingShipments, setMatchingShipments] = useState<MatchingShipmentSummary[]>([]);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [searchType, setSearchType] = useState<'tracking_code' | 'email' | 'phone'>('tracking_code');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);
  const [realtimeProvider, setRealtimeProvider] = useState<'pusher' | 'ably' | 'polling'>('polling');

  // Active view tab: 'timeline' | 'items' | 'carrier' | 'recipient' | 'map'
  const [activeTab, setActiveTab] = useState<'timeline' | 'items'>('timeline');

  // Copy tracking number feedback
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Bill of lading preview modal
  const [showDocModal, setShowDocModal] = useState(false);

  // Non-intrusive Kumo toast for live updates
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastDetails, setToastDetails] = useState<{ statusLabel?: string; trackingNumber?: string } | null>(null);
  const [recentlyUpdatedEventId, setRecentlyUpdatedEventId] = useState<string | null>(null);

  const lastHashRef = useRef<string | null>(null);
  const lastVersionRef = useRef<number>(1);
  const prevTrackingRef = useRef<PublicTrackingResponse | null>(null);

  const [expandedShipmentNumber, setExpandedShipmentNumber] = useState<string | null>(null);
  const liveTrackerSectionRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Realtime Client Configuration
  useEffect(() => {
    fetch('/api/realtime/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.config?.provider) {
          setRealtimeProvider(data.config.provider);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Fetch tracking data with 304 conditional check
  const fetchTracking = async (code: string, isSilentPoll = false, keepHistory = false) => {
    if (!code) return;
    if (!isSilentPoll) setLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/tracking/${encodeURIComponent(code)}`, window.location.origin);
      if (isSilentPoll && lastHashRef.current) {
        url.searchParams.set('lastHash', lastHashRef.current);
      }

      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: isSilentPoll && lastHashRef.current ? { 'If-None-Match': `"${lastHashRef.current}"` } : {}
      });

      if (res.status === 304) {
        setLastRefreshed(new Date());
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'No shipment found matching tracking code, email, or phone number');
      }

      const data = await res.json();
      if (data.tracking) {
        const newTracking: PublicTrackingResponse = data.tracking;

        if (!keepHistory) {
          if (data.matchingShipments && Array.isArray(data.matchingShipments) && data.matchingShipments.length > 0) {
            setMatchingShipments(data.matchingShipments);
          } else {
            setMatchingShipments([]);
          }

          if (data.searchType) {
            setSearchType(data.searchType);
          }
          setLastSearchedQuery(code);
        }

        // Detect if this is an automated live status update
        const prev = prevTrackingRef.current;
        if (
          prev &&
          prev.trackingNumber === newTracking.trackingNumber &&
          (prev.status !== newTracking.status ||
            prev.paymentStatus !== newTracking.paymentStatus ||
            prev.eventVersion !== newTracking.eventVersion ||
            prev.events.length !== newTracking.events.length)
        ) {
          // Trigger non-intrusive Kumo Toast
          const latest = newTracking.events[0];
          setToastMessage('Shipment status updated');
          setToastDetails({
            statusLabel: newTracking.statusLabel || latest?.statusLabel,
            trackingNumber: newTracking.trackingNumber
          });
          if (latest?.id) {
            setRecentlyUpdatedEventId(latest.id);
            setTimeout(() => setRecentlyUpdatedEventId(null), 8000);
          }
          // Auto dismiss toast after 4.5s
          setTimeout(() => {
            setToastMessage(null);
            setToastDetails(null);
          }, 4500);
        }

        prevTrackingRef.current = newTracking;
        lastHashRef.current = newTracking.lastHash;
        lastVersionRef.current = newTracking.eventVersion;
        setTrackingData(newTracking);
        setLastRefreshed(new Date());

        // Dispatch Search conversion across analytics
        if (!isSilentPoll && typeof window !== 'undefined' && (window as any).goShippingTrack) {
          (window as any).goShippingTrack('Search', {
            search_string: code,
            search_type: 'consignment_tracking',
            status: newTracking.status,
            origin: newTracking.originCity,
            destination: newTracking.destCity
          });
        }
      }
    } catch (err: any) {
      if (!isSilentPoll) {
        setError(err.message || 'No shipment found matching tracking code, email, or phone number');
        setTrackingData(null);
        setMatchingShipments([]);
      }
    } finally {
      if (!isSilentPoll) setLoading(false);
    }
  };

  // 3. Initial load & tracking code change (Only if explicitly provided)
  useEffect(() => {
    if (initialTrackingNumber && initialTrackingNumber.trim()) {
      setQuery(initialTrackingNumber.trim());
      fetchTracking(initialTrackingNumber.trim());
    } else {
      setTrackingData(null);
    }
  }, [initialTrackingNumber]);

  // 4. Tab visibility detection to pause polling when backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = !document.hidden;
      setIsTabActive(active);
      // Immediately refetch authoritative state when returning to tab
      if (active && trackingData?.trackingNumber) {
        fetchTracking(trackingData.trackingNumber, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleOnline = () => {
      if (trackingData?.trackingNumber) {
        fetchTracking(trackingData.trackingNumber, true);
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [trackingData?.trackingNumber]);

  // 5. Manual refresh or initial query load (Auto-polling disabled to prevent unwanted auto-loading)
  // Tracking refreshes on demand when query/status changes

  // 6. Listen for custom window event 'select-tracking-code'
  useEffect(() => {
    const handleSelectTracking = (e: any) => {
      if (e.detail?.code && e.detail.code !== trackingData?.trackingNumber) {
        setQuery(e.detail.code);
        fetchTracking(e.detail.code);
      }
    };
    window.addEventListener('select-tracking-code', handleSelectTracking);
    return () => window.removeEventListener('select-tracking-code', handleSelectTracking);
  }, [trackingData?.trackingNumber]);

  // 7. Instant 0ms Cross-Tab and In-Window Live Sync (BroadcastChannel + CustomEvent + Storage)
  useEffect(() => {
    if (!trackingData?.trackingNumber) return;
    const targetCode = trackingData.trackingNumber;

    // A. BroadcastChannel cross-tab listener (instant 0ms)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('goshipping_tracking_sync');
      bc.onmessage = (evt) => {
        if (evt.data?.trackingNumber === targetCode) {
          fetchTracking(targetCode, true);
        }
      };
    }

    // B. CustomEvent in-window listener
    const handleWindowStatusUpdate = (evt: any) => {
      if (evt.detail?.trackingNumber === targetCode) {
        fetchTracking(targetCode, true);
      }
    };
    window.addEventListener('goshipping-status-updated', handleWindowStatusUpdate);

    // C. Cross-tab storage fallback
    const handleStorage = (evt: StorageEvent) => {
      if (evt.key === 'goshipping_live_sync' && evt.newValue) {
        try {
          const parsed = JSON.parse(evt.newValue);
          if (parsed.code === targetCode) {
            fetchTracking(targetCode, true);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('goshipping-status-updated', handleWindowStatusUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [trackingData?.trackingNumber]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchTracking(query.trim());
    }
  };

  const handleCopyTrackingNumber = () => {
    if (!trackingData) return;
    navigator.clipboard.writeText(trackingData.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyTrackingLink = () => {
    if (!trackingData) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://goshipping.com.bd';
    const link = `${origin}/tracking?code=${encodeURIComponent(trackingData.trackingNumber)}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Status badge style helper
  const getStatusBadgeStyle = (status: TrackingStatusCode | string) => {
    const def = TRACKING_STATUSES[status as TrackingStatusCode];
    if (def) {
      return `${def.badgeBg} ${def.badgeText} ${def.badgeBorder}`;
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  // Calculate progress
  const progress = trackingData
    ? calculatePhysicalProgress(trackingData.status, trackingData.events)
    : { completedStagesCount: 0, totalStagesCount: 8, percentage: 0, currentPhysicalStageIndex: 0, isComplete: false };

  return (
    <div className="w-full space-y-6 font-['Inter',sans-serif] text-slate-800 dark:text-slate-100">
      {/* ========================================================================= */}
      {/* NON-INTRUSIVE KUMO TOAST (Live Status Update Notification)                */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl p-4 flex items-start gap-3 transition-none motion-reduce:transition-none"
        >
          <div className="w-8 h-8 rounded-full bg-[#EA1D2C]/10 text-[#EA1D2C] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                {toastMessage}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Just now</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
              {toastDetails?.trackingNumber}: <span className="font-bold text-[#EA1D2C]">{toastDetails?.statusLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            aria-label="Dismiss toast"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 01. SEARCH & CONSIGNMENT SWITCHER BAR (Centered & Compact per client)      */}
      {/* ========================================================================= */}
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Unified Top Header Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA1D2C] animate-pulse"></span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
              Cargo & Consignment Tracker
            </span>
          </div>
        </div>

        {/* Unified Search Input Form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <svg
              className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 stroke-[2]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Tracking Code, AWB, B/L, Account Email, or Phone Number..."
              className="w-full h-11 pl-10 pr-4 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#EA1D2C] focus:ring-2 focus:ring-[#EA1D2C]/20 transition-none outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center justify-center gap-2 transition-none cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
              <span>Track</span>
            </button>

            {trackingData && (
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                title="Copy shareable direct tracking link"
                className="h-11 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-none cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2] text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="hidden sm:inline">{linkCopied ? 'Copied!' : 'Link'}</span>
              </button>
            )}
          </div>
        </form>

        {/* Security & Multi-Method Guidance Strip */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600 text-[11px]">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Live telemetry, customs clearance, and consignment history.</span>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            No login or password required for public tracking.
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 01.B CUSTOMER CONSIGNMENT HISTORY & MULTI-TRACKING (No Login Required)    */}
      {/* ========================================================================= */}
      {matchingShipments && matchingShipments.length > 0 && (searchType === 'email' || searchType === 'phone' || matchingShipments.length > 1) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          {/* History Header & KPI Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 ${
                  searchType === 'email'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                    : searchType === 'phone'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-red-50 text-[#EA1D2C] border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
                }`}>
                  {searchType === 'email' ? (
                    <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  ) : searchType === 'phone' ? (
                    <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  )}
                  <span>{searchType === 'email' ? 'EMAIL CONSIGNMENT HISTORY' : searchType === 'phone' ? 'MOBILE CONSIGNMENT HISTORY' : 'CONSIGNMENT MATCHES'}</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Query: <strong className="text-slate-800 dark:text-slate-200">{lastSearchedQuery || query}</strong>
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                Customer Consignment History ({matchingShipments.length} Found)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guest access without login. Click any consignment card to expand full cargo specifications inline, or click <strong>"Track Live"</strong> to view its 8-stage progress bar and GPS waypoints below.
              </p>
            </div>

            {/* Quick KPI Strip */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Total</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">{matchingShipments.length}</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center">
                <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono uppercase">In Transit</div>
                <div className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 font-mono">
                  {matchingShipments.filter((s) => s.status !== 'delivered').length}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-center">
                <div className="text-[10px] text-green-600 dark:text-green-400 font-mono uppercase">Delivered</div>
                <div className="text-sm font-extrabold text-green-700 dark:text-green-300 font-mono">
                  {matchingShipments.filter((s) => s.status === 'delivered').length}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Gross Cargo</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {matchingShipments.reduce((sum, s) => sum + (s.totalWeightKg || 0), 0).toFixed(0)} <span className="text-[10px] font-sans font-medium">KG</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consignment Items Accordion Cards */}
          <div className="space-y-3 pt-1">
            {matchingShipments.map((s) => {
              const isSelected = trackingData?.trackingNumber === s.trackingNumber;
              const isExpanded = expandedShipmentNumber === s.trackingNumber;

              return (
                <div
                  key={s.trackingNumber}
                  className={`rounded-xl border transition-none overflow-hidden ${
                    isSelected
                      ? 'border-[#EA1D2C] ring-2 ring-[#EA1D2C]/20 bg-red-50/20 dark:bg-red-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Card Main Row: Entire card row is clickable to expand/collapse */}
                  <div
                    onClick={() => {
                      setExpandedShipmentNumber(isExpanded ? null : s.trackingNumber);
                      if (trackingData?.trackingNumber !== s.trackingNumber) {
                        fetchTracking(s.trackingNumber, false, true);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedShipmentNumber(isExpanded ? null : s.trackingNumber);
                        if (trackingData?.trackingNumber !== s.trackingNumber) {
                          fetchTracking(s.trackingNumber, false, true);
                        }
                      }
                    }}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-none"
                  >
                    {/* Left: 48x48 Product Image + Identifiers */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <img
                        src={s.productImage || '/assets/products/cotton-fabrics.svg'}
                        alt={s.productName}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0 shadow-2xs"
                        onError={(e) => {
                          (e.target as any).src = '/assets/products/cotton-fabrics.svg';
                        }}
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#EA1D2C]">
                            {s.trackingNumber}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                            {s.mode.toUpperCase()} · {s.serviceLevel || 'Standard'}
                          </span>

                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EA1D2C] text-white flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                              Active in Live Tracker
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {s.productName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {s.originCity} → {s.destCity}
                          </span>
                          <span>·</span>
                          <span className="font-mono">
                            {s.totalWeightKg} KG · {s.totalPieces} Pcs {s.totalCbm ? `· ${s.totalCbm} CBM` : ''}
                          </span>
                          {s.billOfLadingNumber && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-[11px] text-slate-500">
                                B/L: {s.billOfLadingNumber}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Icon + Actions + Visual Indicator */}
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      {/* Live Status Icon & Label */}
                      <div className="flex items-center gap-2.5 pr-2">
                        <LiveStatusIcon status={s.status} className="w-6 h-6" />
                        <div className="text-left">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {s.statusLabel}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {s.lastUpdatedBst ? `BST: ${s.lastUpdatedBst.replace(/\d{4},\s*/, '')}` : 'Live'}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons & Expand Indicator */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchTracking(s.trackingNumber, false, true);
                            if (typeof window !== 'undefined') {
                              const url = new URL(window.location.href);
                              url.searchParams.set('code', s.trackingNumber);
                              window.history.replaceState({}, '', url.toString());
                            }
                            if (liveTrackerSectionRef.current) {
                              liveTrackerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="h-9 px-4 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-1.5 transition-none cursor-pointer shadow-xs"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          <span>Track Live</span>
                        </button>

                        <div
                          className={`w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 ${
                            isExpanded ? 'text-[#EA1D2C] border-[#EA1D2C]/40 bg-red-50/50 dark:bg-red-950/30' : ''
                          }`}
                          title={isExpanded ? 'Click to collapse' : 'Click to expand cargo specifications'}
                        >
                          <svg
                            className={`w-3.5 h-3.5 stroke-[2.5] transition-transform ${isExpanded ? 'rotate-180 text-[#EA1D2C]' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inline Expanded Drawer (Full specs & recent milestones) */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Specs Box */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                            <span>Consignment Specifications</span>
                            <span className="font-mono text-[#EA1D2C]">{s.mode.toUpperCase()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Gross Weight</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{s.totalWeightKg} KG</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Quantity / Boxes</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{s.totalPieces} Pcs</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">CBM Volume</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{s.totalCbm || 'Standard'} CBM</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Waybill / BOL</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {s.billOfLadingNumber || s.carrierWaybillNumber || 'Direct'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Route & Schedule Box */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                            <span>Transit Route & Schedule</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                          </div>
                          <div className="space-y-1.5 text-[11.5px]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Current Waypoint</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {s.currentLocation || `${s.originCity} to ${s.destCity}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Estimated Delivery</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {s.estimatedDeliveryBst || 'Estimated on schedule'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Origin Port → Destination</span>
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                {s.originCity}, {s.originCountry || 'China'} → {s.destCity}, {s.destCountry || 'Bangladesh'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Verified Milestones Preview */}
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                            <span>Verified Milestone Checkpoints</span>
                            <span className="text-[10px] text-slate-400 font-mono">{s.eventsCount || 0} events</span>
                          </div>

                          {s.recentMilestones && s.recentMilestones.length > 0 ? (
                            <div className="space-y-2 pt-0.5">
                              {s.recentMilestones.map((evt, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-[11px]">
                                  <div className="mt-0.5 shrink-0">
                                    <LiveStatusIcon status={evt.statusCode} className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {evt.title}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
                                      <span className="truncate">{evt.locationName}</span>
                                      <span className="font-mono shrink-0">{evt.occurredAtBst ? evt.occurredAtBst.replace(/\d{4},\s*/, '') : ''}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 text-[11px] italic">
                              Cargo in transit with GoShipping logistics network.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Consignment booked on {new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            fetchTracking(s.trackingNumber, false, true);
                            if (typeof window !== 'undefined') {
                              const url = new URL(window.location.href);
                              url.searchParams.set('code', s.trackingNumber);
                              window.history.replaceState({}, '', url.toString());
                            }
                            if (liveTrackerSectionRef.current) {
                              liveTrackerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="font-bold text-[#EA1D2C] hover:text-[#D41523] flex items-center gap-1 cursor-pointer hover:underline text-[11.5px]"
                        >
                          <span>Scroll Down to 8-Stage Progress Stepper &amp; Live Waypoints ↓</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ERROR STATE                                                               */}
      {/* ========================================================================= */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900/60 p-5 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-[#EA1D2C] mx-auto flex items-center justify-center mb-2">
            <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="font-bold text-sm text-red-900 dark:text-red-200 font-['Manrope',sans-serif]">
            Shipment Not Found
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1 max-w-md mx-auto">{error}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 02. EMPTY STATE (WAITING FOR USER'S TRACKING CODE)                        */}
      {/* ========================================================================= */}
      {!trackingData && !loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-[#EA1D2C] mx-auto flex items-center justify-center ring-8 ring-red-50/60">
            <svg className="w-7 h-7 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
              Track Your Shipment
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your Tracking Code, account Email, or Phone Number in the search box above to view real-time cargo status and location updates.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]"></span>
              <span className="font-semibold text-slate-800">Tracking Code / AWB / B/L</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="font-semibold text-slate-800">Account Email (Consignment History)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-800">Phone Number (Consignee Deliveries)</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 03. REDESIGNED TRACKING HEADER (Section 5.A)                              */}
      {/* ========================================================================= */}
      {trackingData && (
        <div ref={liveTrackerSectionRef} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Top Brand & Metadata Bar */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EA1D2C]" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                GO SHIPPING | ORDER TRACKING
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDocModal(true)}
                className="text-[11px] font-semibold text-[#EA1D2C] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Waybill / BOL ({trackingData.billOfLadingNumber})</span>
              </button>
            </div>
          </div>

          {/* Main Header Body */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Code, Product & Route */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                    {trackingData.trackingNumber}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopyTrackingNumber}
                    title="Copy tracking number"
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-none cursor-pointer"
                  >
                    {copied ? (
                      <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>
                    ) : (
                      <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTrackingLink}
                    title="Copy shareable direct tracking link"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-none cursor-pointer"
                  >
                    <svg className="w-3 h-3 text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>{linkCopied ? 'Link Copied!' : 'Direct Link'}</span>
                  </button>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-tight border ${
                      trackingData.mode === 'air'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                        : trackingData.mode === 'sea'
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {trackingData.mode.toUpperCase()} FREIGHT · {trackingData.serviceLevel.toUpperCase()}
                  </span>
                </div>

                {/* Product Name & 48x48 Product Image */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                    {trackingData.productImage ? (
                      <img
                        src={trackingData.productImage}
                        alt={trackingData.productName}
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

                  <div className="space-y-0.5 min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 font-normal text-xs uppercase tracking-wider">Product:</span>
                      <span className="text-slate-900 dark:text-slate-100">{trackingData.productName}</span>
                    </div>

                    {/* Origin to Destination Route */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {trackingData.originCity}, {trackingData.originCountry}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {trackingData.destCity}, {trackingData.destCountry}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono tabular-nums">{trackingData.totalPieces} Pcs</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono tabular-nums">{trackingData.totalWeightKg.toLocaleString()} KG</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Stage Update Badge and Last Updated */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Current Shipment Status / Stage Update Badge */}
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide border shadow-2xs ${getStatusBadgeStyle(
                      trackingData.status
                    )}`}
                  >
                    {trackingData.statusLabel || trackingData.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Last Updated Timestamp in BST format: 25 Oct 2026, 11:30 AM BST */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>Last Updated: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {trackingData.lastUpdatedBst || formatBstDateTime(trackingData.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 03. SHIPMENT PROGRESS INDICATOR (Section 5.B)                             */}
            {/* ========================================================================= */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-slate-500 dark:text-slate-400">Shipping Progress:</span>
                  <span className="font-bold text-[#EA1D2C] font-mono">
                    {progress.percentage}% Completed
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 lg:hidden flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    <span>Swipe stages</span> <span>→</span>
                  </span>
                  <div className="text-[11px] text-slate-400 hidden sm:block">
                    Current Location: <span className="font-medium text-slate-700 dark:text-slate-300">{trackingData.currentLocation}</span>
                  </div>
                </div>
              </div>

              {/* Responsive Stepper Container */}
              <div className="overflow-x-auto pb-3 pt-1 scrollbar-none">
                <div className="min-w-[760px] relative pt-2 pb-2">
                  {/* Background Track: Exactly between center of first node (42.5px) and last node (42.5px) */}
                  <div className="absolute top-[58px] left-[42.5px] right-[42.5px] h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
                  {/* Active Progress Fill */}
                  <div
                    className="absolute top-[58px] left-[42.5px] h-0.5 bg-emerald-500 z-0 transition-none motion-reduce:transition-none"
                    style={{
                      width: `calc((100% - 85px) * ${Math.min(
                        1,
                        Math.max(0, (progress.completedStagesCount - 1) / (progress.totalStagesCount - 1))
                      )})`
                    }}
                  />

                  {/* Stepper Nodes (8 Physical Stages with Same Size Icons) */}
                  <div className="relative z-10 flex items-start justify-between">
                    {PHYSICAL_STAGES.map((stageKey, idx) => {
                      const stageDef = TRACKING_STATUSES[stageKey];
                      const isCompleted = idx < progress.completedStagesCount - 1;
                      const isCurrent = idx === progress.completedStagesCount - 1;
                      const isFuture = idx >= progress.completedStagesCount;

                      return (
                        <div key={stageKey} className="flex flex-col items-center group w-[85px] text-center shrink-0">
                          {/* Step-wise Logistics Icon Badge (Same Exact Size: 40x40px with 20x20px SVG) */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-2 border transition-none motion-reduce:transition-none ${
                              isCurrent
                                ? 'bg-red-50 dark:bg-red-950/50 text-[#EA1D2C] border-2 border-[#EA1D2C] shadow-xs ring-2 ring-red-200 dark:ring-red-900/60'
                                : isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {stageKey === 'purchased' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="8" cy="21" r="1" />
                                <circle cx="19" cy="21" r="1" />
                                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                              </svg>
                            )}
                            {stageKey === 'cn_warehouse_received' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                              </svg>
                            )}
                            {stageKey === 'dispatched_from_china' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                              </svg>
                            )}
                            {stageKey === 'arrived_dhaka_airport' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M2 22h20" />
                                <path d="M19 16l-7-3-4 1-2-2 1.5-1.5L11 12l7-2 3 3z" />
                              </svg>
                            )}
                            {stageKey === 'awaiting_customs' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="m9 12 2 2 4-4" />
                              </svg>
                            )}
                            {stageKey === 'bd_warehouse_received' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 21h18" />
                                <path d="M5 21V7l8-4v18" />
                                <path d="M19 21V11l-6-4" />
                                <path d="M9 9v.01" />
                                <path d="M9 13v.01" />
                              </svg>
                            )}
                            {stageKey === 'out_for_delivery' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect width="16" height="13" x="1" y="6" rx="2" />
                                <circle cx="5.5" cy="18.5" r="2.5" />
                                <circle cx="18.5" cy="18.5" r="2.5" />
                                <path d="M17 10h4l3 3v3h-3" />
                              </svg>
                            )}
                            {stageKey === 'delivered' && (
                              <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            )}
                          </div>

                          {/* Stepper Node Circle */}
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-none motion-reduce:transition-none z-10 ${
                              isCurrent
                                ? 'bg-[#EA1D2C] border-white text-white ring-4 ring-red-100 dark:ring-red-950 shadow-xs'
                                : isCompleted
                                ? 'bg-emerald-500 border-white text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                            }`}
                          >
                            {isCompleted ? (
                              <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : isCurrent ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                            )}
                          </div>

                          {/* Stage Label */}
                          <span
                            className={`mt-1.5 text-[10px] leading-tight font-semibold tracking-tight ${
                              isCurrent
                                ? 'font-bold text-[#EA1D2C]'
                                : isCompleted
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {stageDef.shortLabel}
                          </span>

                          {/* Stage Status Pill */}
                          <span className={`text-[9px] mt-0.5 font-mono ${
                            isCurrent ? 'text-[#EA1D2C] font-bold' : isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'
                          }`}>
                            {isCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 04. TABS & DETAILED TRACKING SECTIONS                                     */}
      {/* ========================================================================= */}
      {trackingData && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Navigation Tab Header */}
          <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 text-xs font-semibold scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50 dark:bg-slate-800/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Tracking History ({trackingData.events.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-4 sm:px-5 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-none cursor-pointer ${
                activeTab === 'items'
                  ? 'border-[#EA1D2C] text-[#EA1D2C] bg-slate-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <span>Package Details ({trackingData.items.length})</span>
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {/* ========================================================================= */}
            {/* TAB CONTENT 1: VERTICAL TRACKING TIMELINE (Section 5.C)                   */}
            {/* ========================================================================= */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    Shipment History & Updates
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    All times in Bangladesh Standard Time (BST)
                  </span>
                </div>

                <div className="relative space-y-8">
                  {/* Continuous Vertical Connecting Line (Dead-Center at 16px) */}
                  <div className="absolute left-4 top-3 bottom-3 w-0.5 -translate-x-1/2 bg-slate-200 dark:bg-slate-700 pointer-events-none" />

                  {trackingData.events
                    .filter((evt) => evt.statusCode !== 'payment_received' && evt.status !== 'payment_received')
                    .map((evt, idx) => {
                      const isLatest = idx === 0;
                      const isHighlighted = evt.id === recentlyUpdatedEventId;

                      return (
                        <div
                          key={evt.id}
                          className={`relative flex items-start gap-3 sm:gap-4 group transition-none motion-reduce:transition-none ${
                            isHighlighted ? 'p-3 rounded-lg bg-red-50/70 dark:bg-red-950/30 ring-1 ring-[#EA1D2C]/40' : ''
                          }`}
                        >
                          {/* Dedicated 32px (w-8) Icon Column: Flex Center ensures the 24px (w-6) circle icon is at exactly 16px center */}
                          <div className="relative z-10 shrink-0 w-8 flex items-center justify-center pt-0.5">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-none ${
                                isLatest
                                  ? 'bg-[#EA1D2C] border-white text-white ring-4 ring-[#EA1D2C]/20 shadow-xs'
                                  : 'bg-emerald-500 border-white text-white ring-1 ring-emerald-200'
                              }`}
                            >
                              {isLatest ? (
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                              ) : (
                                <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h4
                                  className={`text-sm font-bold tracking-tight ${
                                    isLatest ? 'text-[#EA1D2C]' : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {evt.statusLabel || evt.title}
                                </h4>
                                {isLatest && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-red-100 text-[#EA1D2C] dark:bg-red-950 dark:text-red-300 uppercase">
                                    Current Status
                                  </span>
                                )}
                              </div>

                            {/* Actual Timestamp in Bangladesh Time: 25 Oct 2026, 08:15 PM BST */}
                            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                              {evt.occurredAtBst || formatBstDateTime(evt.eventTime)}
                            </span>
                          </div>

                          {/* Location */}
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{evt.locationName}</span>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                            {evt.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB CONTENT 2: CARGO PACKAGES & ITEMS                                     */}
            {/* ========================================================================= */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    Package Details & Contents
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Total: {trackingData.totalWeightKg} KG · {trackingData.totalCbm} CBM
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Item Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Packaging</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Weight (KG)</th>
                        <th className="py-2.5 px-3 text-right">Volume (CBM)</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Declared Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {trackingData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {item.itemCode}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.description}
                                    className="w-12 h-12 object-cover rounded-lg"
                                    width={48}
                                    height={48}
                                  />
                                ) : (
                                  <svg className="w-5 h-5 text-slate-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                  </svg>
                                )}
                              </div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-snug">
                                {item.description}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 uppercase">
                            {item.packagingType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.weightKg}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">{item.cbm}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.categoryTag}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {item.declaredValue ? `৳${item.declaredValue.toLocaleString()} BDT` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 05. BILL OF LADING / WAYBILL PREVIEW MODAL                                */}
      {/* ========================================================================= */}
      {showDocModal && trackingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                  Electronic Airway Bill / Bill of Lading
                </h3>
                <span className="text-xs font-mono text-slate-500">{trackingData.billOfLadingNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-slate-50 dark:bg-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Tracking Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{trackingData.trackingNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Service Mode</span>
                  <span className="font-semibold text-slate-900 dark:text-white uppercase">{trackingData.mode} Freight ({trackingData.serviceLevel})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Shipper Origin</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{trackingData.originCity}, {trackingData.originCountry}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Consignee Destination</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{trackingData.destCity}, {trackingData.destCountry}</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded p-3 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Weight:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalWeightKg} KG</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volume:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalCbm} CBM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Package Units:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{trackingData.totalPieces} Pcs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Clearance:</span>
                  <span className="font-bold text-emerald-600 uppercase">{trackingData.paymentStatus.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-none"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#EA1D2C] text-white font-semibold text-xs hover:bg-[#D41523] transition-none"
              >
                Print Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
