import React, { useState, useEffect, useMemo } from 'react';
import QuoteFaqSection from './QuoteFaqSection';
import ReferenceSelect from '../common/ReferenceSelect';
import {
  ORIGIN_COUNTRIES,
  CHINA_ORIGIN_HUB,
  BANGLADESH_PICKUP_HUB,
  MALAYSIA_PICKUP_HUB,
  DEST_COUNTRIES,
  DEFAULT_SHIPPING_MODES,
  DYNAMIC_FULFILLMENT_BY_COUNTRY,
  type ShippingModeOption,
  type DynamicFulfillmentOption
} from './shippingLocations';

interface Props {
  defaultGuestName?: string;
  defaultGuestEmail?: string;
  defaultGuestPhone?: string;
  initialMode?: 'air' | 'sea' | 'hand_carry';
  showFaq?: boolean;
  onQuoteCreated?: (newQuote: any) => void;
  onViewQuotes?: () => void;
}

export default function QuoteCalculatorIsland({
  defaultGuestName = '',
  defaultGuestEmail = '',
  defaultGuestPhone = '',
  initialMode = 'air',
  showFaq = true,
  onQuoteCreated,
  onViewQuotes
}: Props = {}) {
  const [shippingModes, setShippingModes] = useState<ShippingModeOption[]>(DEFAULT_SHIPPING_MODES);
  const [mode, setMode] = useState<'air' | 'sea' | 'hand_carry'>(initialMode);
  const [originCountry, setOriginCountry] = useState('China');
  const [originCity, setOriginCity] = useState('Guangzhou');
  const [destCountry, setDestCountry] = useState('Bangladesh');
  const [fulfillmentType, setFulfillmentType] = useState<'doorstep' | 'courier' | 'pickup'>('doorstep');
  const [destCity, setDestCity] = useState('Dhaka');
  const [destAddress, setDestAddress] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Fetch dynamic shipping config and warehouses from backend
  useEffect(() => {
    fetch('/api/shipping-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config?.modes) {
          setShippingModes(data.config.modes.filter((m: any) => m.active));
        }
      })
      .catch(() => {});

    fetch('/api/warehouses')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.warehouses)) {
          setWarehouses(data.warehouses.filter((w: any) => w.isActive));
        }
      })
      .catch(() => {});
  }, []);

  const chinaWarehouses = useMemo(() => {
    const list = warehouses.filter((w) => w.country.toLowerCase() === 'china');
    if (list.length > 0) return list;
    return [
      { id: 'wh-can-01', code: 'CAN', city: 'Guangzhou', name: 'Guangzhou Central Intake Hub', address: CHINA_ORIGIN_HUB.address },
      { id: 'wh-yiw-01', code: 'YIW', city: 'Yiwu', name: 'Yiwu International Trade City Warehouse', address: 'Chouzhou North Road, Zone 4, Yiwu' },
      { id: 'wh-szx-01', code: 'SZX', city: 'Shenzhen', name: 'Shenzhen Airport Logistics Hub', address: 'Baoan Airport Logistics Park, Shenzhen' }
    ];
  }, [warehouses]);

  const availableFulfillments = useMemo<DynamicFulfillmentOption[]>(() => {
    const countryData = DYNAMIC_FULFILLMENT_BY_COUNTRY[destCountry] || DYNAMIC_FULFILLMENT_BY_COUNTRY['Bangladesh'];
    return countryData.options;
  }, [destCountry]);

  const availableCities = useMemo<string[]>(() => {
    const matchedFulfillment = availableFulfillments.find((f) => f.id === fulfillmentType);
    if (matchedFulfillment && matchedFulfillment.cities.length > 0) {
      return matchedFulfillment.cities;
    }
    return availableFulfillments[0]?.cities || ['Dhaka'];
  }, [availableFulfillments, fulfillmentType]);

  const handleDestCountryChange = (country: string) => {
    setDestCountry(country);
    if (country === 'Malaysia') {
      // Malaysia only supports courier and pickup
      setFulfillmentType('courier');
      setDestCity('Selangor');
    } else {
      setFulfillmentType('doorstep');
      setDestCity('Dhaka');
    }
  };

  const handleFulfillmentChange = (type: 'doorstep' | 'courier' | 'pickup') => {
    setFulfillmentType(type);
    const countryData = DYNAMIC_FULFILLMENT_BY_COUNTRY[destCountry] || DYNAMIC_FULFILLMENT_BY_COUNTRY['Bangladesh'];
    const matched = countryData.options.find((opt) => opt.id === type);
    if (matched && matched.cities.length > 0) {
      setDestCity(matched.cities[0]);
    }
  };

  const fulfillmentLabel = useMemo(() => {
    if (fulfillmentType === 'doorstep') return 'Doorstep Delivery';
    if (fulfillmentType === 'courier') return 'Courier Delivery';
    return 'Hub Self-Pickup';
  }, [fulfillmentType]);

  const [weightKg, setWeightKg] = useState('');
  const [cbm, setCbm] = useState('');
  const [quantity, setQuantity] = useState('');
  const [packagingType, setPackagingType] = useState('carton');
  const [cargoDescription, setCargoDescription] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Garments, Apparel & Fashion Wear');
  const [productUrl, setProductUrl] = useState('');
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string; size: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(defaultGuestName);
  const [guestEmail, setGuestEmail] = useState(defaultGuestEmail);
  const [guestPhone, setGuestPhone] = useState(defaultGuestPhone);

  const [submitting, setSubmitting] = useState(false);
  const [submittedQuote, setSubmittedQuote] = useState<{ quoteNumber: string; route: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Live Calendar Arrival Estimator
  const calculateArrivalDates = (daysMin: number, daysMax: number) => {
    const now = new Date();
    const minD = new Date(now.getTime() + daysMin * 24 * 60 * 60 * 1000);
    const maxD = new Date(now.getTime() + daysMax * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(minD)} – ${fmt(maxD)}`;
  };

  const activeModeConfig = shippingModes.find((m) => m.id === mode) || shippingModes[0] || {
    id: 'air',
    label: 'By Air',
    badge: '7–14 Days',
    minDays: 7,
    maxDays: 14
  };

  const currentArrivalRange = calculateArrivalDates(activeModeConfig.minDays, activeModeConfig.maxDays);
  const currentSla = activeModeConfig.badge;

  const numWeight = parseFloat(weightKg) || 0;
  const numCbm = parseFloat(cbm) || 0;
  const airVolumetricKg = numCbm * 167;
  const airChargeableKg = Math.max(numWeight, airVolumetricKg);

  const estimatedAirCost = Math.round(airChargeableKg * 750 + 2500);
  const estimatedSeaCost = Math.round(Math.max(numCbm, 0.5) * 18500 + 4500);

  const PRODUCT_CATEGORIES = [
    'Garments, Apparel & Fashion Wear',
    'Fabrics, Textiles, Yarn & Accessories',
    'Electronics, Smart Gadgets & Mobile Accessories',
    'Machinery, Industrial Equipment & Spare Parts',
    'Footwear, Bags & Leather Goods',
    'Beauty, Cosmetics & Personal Care',
    'Home, Kitchenware & Plastic Items',
    'Toys, Baby Care & Stationery',
    'Automotive & Motorcycle Spare Parts',
    'Hardware, Electrical Tools & Lighting',
    'General Commercial Cargo / Other'
  ];

  const handleImageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError(null);

    const maxFiles = 5;
    if (productImages.length + files.length > maxFiles) {
      setImageError(`You can attach up to ${maxFiles} product photos.`);
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setImageError('Please select valid image files (JPG, PNG, WEBP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError(`Image "${file.name}" exceeds 5MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setProductImages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              url: result,
              size: `${(file.size / 1024).toFixed(0)} KB`
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeProductImage = (id: string) => {
    setProductImages((prev) => prev.filter((img) => img.id !== id));
  };

  const currentEstimate = mode === 'air' ? estimatedAirCost : estimatedSeaCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestEmail || !guestPhone) {
      setError('Please provide your name, business email and contact phone number.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const serviceType = fulfillmentType === 'pickup' ? 'port_to_port' : 'door_to_door';
      const cargoDescParts = [
        productName.trim() ? `Product: ${productName.trim()}` : '',
        productCategory ? `Category: ${productCategory}` : '',
        productUrl.trim() ? `URL: ${productUrl.trim()}` : '',
        cargoDescription.trim(),
        destAddress.trim()
          ? `[Fulfillment: ${fulfillmentLabel}, Area/City: ${destCity}, Delivery Address: ${destAddress.trim()}]`
          : `[Fulfillment: ${fulfillmentLabel}, Area/City: ${destCity}]`
      ].filter(Boolean).join(' | ');

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          originCountry,
          originCity,
          destCountry,
          destCity,
          mode,
          serviceType,
          productName: productName.trim() || undefined,
          productCategory,
          productUrl: productUrl.trim() || undefined,
          productImages: productImages.map((img) => img.url),
          cargoDescription: cargoDescParts,
          packagingType,
          quantity: parseInt(quantity) || 1,
          totalWeightKg: numWeight,
          totalCbm: numCbm
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quote request');
      }

      setSubmittedQuote({
        quoteNumber: data.quote.quoteNumber,
        route: `${originCity} → ${destCity} (${fulfillmentLabel})`
      });

      if (onQuoteCreated) {
        onQuoteCreated(data.quote);
      }

      if (typeof window !== 'undefined' && (window as any).goShippingTrack) {
        (window as any).goShippingTrack('Lead', {
          quote_number: data.quote.quoteNumber,
          mode,
          origin: `${originCity}, China`,
          destination: `${destCity}, ${destCountry} (${fulfillmentLabel})`,
          weight_kg: numWeight,
          volume_cbm: numCbm,
          cargo_type: cargoDescription,
          value: currentEstimate,
          currency: 'BDT'
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error creating quotation request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="quote-calculator" className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* 01. Brand Header */}
      <div className="bg-gradient-to-r from-red-50/90 via-rose-50/50 to-white text-slate-900 px-5 sm:px-6 py-4 border-b border-red-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
            Go
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-['Manrope',sans-serif]">
                Ship for Me: Book Your Shipping Order
              </h3>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                <span>China</span>
                <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span>Bangladesh</span>
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Guangzhou &amp; Yiwu China warehouse intake, full customs clearance &amp; Bangladesh door delivery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-red-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Accepting New Orders</span>
          </span>
        </div>
      </div>

      {submittedQuote ? (
        <div className="p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <svg aria-hidden="true" className="w-8 h-8 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white">
            Your Shipping Request Has Been Received
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Your booking reference is{' '}
            <strong className="text-slate-900 dark:text-white font-mono text-sm px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
              {submittedQuote.quoteNumber}
            </strong>
            . Our operations concierge will assign your unique China warehouse shipping mark and notify your supplier within 2 business hours.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmittedQuote(null);
                setGuestName(defaultGuestName);
                setOriginCountry('China');
                setOriginCity('Guangzhou');
                setDestCountry('Bangladesh');
                setFulfillmentType('doorstep');
                setDestCity('Dhaka');
                setDestAddress('');
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-none cursor-pointer"
            >
              Book Another Shipment
            </button>
            {onViewQuotes ? (
              <button
                type="button"
                onClick={onViewQuotes}
                className="px-5 py-2.5 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold text-xs transition-none cursor-pointer shadow-xs whitespace-nowrap"
              >
                View in My Quotations
              </button>
            ) : (
              <a
                href="/login"
                className="px-5 py-2.5 rounded-lg bg-[var(--color-brand-primary)] hover:opacity-90 text-white font-semibold text-xs transition-none cursor-pointer shadow-xs inline-flex items-center whitespace-nowrap"
              >
                Login to Track Shipment
              </a>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 lg:p-6 bg-slate-50/60 dark:bg-slate-950/40">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Master 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-8 space-y-4">
              {/* Procedure Micro-Bar */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40 shrink-0">
                    How it works
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    Order from 1688, Taobao, or Chinese factory. We assign your unique <strong>Shipping Mark</strong> and deliver to Bangladesh.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:inline-flex">
                  <svg className="w-3 h-3 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Door Delivery Included</span>
                </span>
              </div>

              {/* STEP 1: TRANSPORT MODE SELECTOR (Compact Radio Buttons) */}
              <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <span className="text-sm">Ship by</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#EA1D2C] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/60 font-mono">
                    <span>Est. Arrival: {currentArrivalRange}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                  {shippingModes.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-none ${
                        mode === m.id
                          ? 'border-[#EA1D2C] bg-red-50/70 dark:bg-red-950/30 text-slate-900 dark:text-white ring-1 ring-[#EA1D2C]'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMode"
                        value={m.id}
                        checked={mode === m.id}
                        onChange={() => setMode(m.id as any)}
                        className="w-3.5 h-3.5 text-[#EA1D2C] accent-[#EA1D2C] cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                        {m.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* STEP 2: SHIPPING ROUTE & FULFILLMENT (Clean Compact Selectors) */}
              <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2 font-['Manrope',sans-serif]">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <span className="text-sm">Shipping Route &amp; Warehouses</span>
                  </span>
                  <div className="inline-flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono">
                    <span>{originCountry} ({originCity})</span>
                    <svg className="w-3 h-3 text-[#EA1D2C] stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span>{destCountry} ({destCity.split('(')[0].trim()})</span>
                  </div>
                </div>

                {/* 2 Selectors: Origin Warehouse & Destination Country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Selector 1: Origin Warehouse */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Origin Hub (China)
                    </label>
                    <ReferenceSelect
                      value={originCity}
                      onChange={(val) => setOriginCity(val)}
                      options={chinaWarehouses.map((wh) => ({
                        value: wh.city,
                        label: `${wh.city} Warehouse`
                      }))}
                      placeholder="Select Origin Warehouse"
                    />
                  </div>

                  {/* Selector 2: Destination Country */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destination Country
                    </label>
                    <ReferenceSelect
                      value={destCountry}
                      onChange={(val) => handleDestCountryChange(val)}
                      options={[
                        { value: 'Bangladesh', label: 'Bangladesh' },
                        { value: 'Malaysia', label: 'Malaysia' }
                      ]}
                      placeholder="Select Destination Country"
                    />
                  </div>
                </div>
              </div>

              {/* STEP 3: PRODUCT DETAILS & CARGO WEIGHT */}
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-red-100 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="flex items-center gap-2 font-['Manrope',sans-serif] font-bold text-sm">
                    <span className="w-5 h-5 rounded-full bg-[#EA1D2C] text-white flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Product Details &amp; Cargo Weight</span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Volumetric Eq: {airVolumetricKg.toFixed(1)} KG ({numCbm} CBM × 167)
                  </span>
                </div>

                {/* Sub-Section 1: Product Identification */}
                <div className="p-3.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#EA1D2C] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                    </svg>
                    <span>Product Info &amp; Category</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Product Name / Item Title <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cotton T-Shirts, Smart Watch, LED Flood Light..."
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C] outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Product Category <span className="text-[#EA1D2C]">*</span>
                      </label>
                      <ReferenceSelect
                        value={productCategory}
                        onChange={(val) => {
                          setProductCategory(val);
                          if (!cargoDescription || cargoDescription.includes('(1688 / Factory)')) {
                            setCargoDescription(`${val} (1688 / Factory)`);
                          }
                        }}
                        options={PRODUCT_CATEGORIES.map((cat) => ({
                          value: cat,
                          label: cat
                        }))}
                        placeholder="Select Product Category"
                        searchable={true}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Product / Supplier Link (1688 / Taobao / Alibaba URL) <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://detail.1688.com/... or Taobao / factory link"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#EA1D2C] focus:ring-1 focus:ring-[#EA1D2C] outline-none"
                      />
                    </div>
                  </div>

                  {/* Product Picture Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Product Pictures &amp; Photos <span className="text-slate-400 font-normal">(Upload samples, carton labels or catalog pictures)</span>
                      </label>
                      <span className="text-[10px] font-mono font-medium text-slate-500">
                        {productImages.length}/5 Attached
                      </span>
                    </div>

                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#EA1D2C] dark:hover:border-[#EA1D2C] rounded-xl p-3 bg-white dark:bg-slate-900 cursor-pointer transition-none group">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageFiles(e.target.files)}
                      />
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 group-hover:text-[#EA1D2C]">
                        <svg className="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="text-xs font-semibold">
                          Click to upload or drag &amp; drop product photos
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        PNG, JPG, WEBP up to 5MB each (Max 5 photos)
                      </span>
                    </label>

                    {imageError && (
                      <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-red-600 shrink-0 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{imageError}</span>
                      </p>
                    )}

                    {productImages.length > 0 && (
                      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {productImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 aspect-square flex items-center justify-center"
                          >
                            <img
                              src={img.url}
                              alt={`Product preview ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeProductImage(img.id)}
                              aria-label="Remove image"
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-700 cursor-pointer transition-none"
                            >
                              ×
                            </button>
                            <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/60 text-white px-1 py-0.2 rounded backdrop-blur-xs">
                              {img.size}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Section 2: Weight & Volume Details (Optional) */}
                <div className="space-y-3 pt-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 stroke-[2] text-[#EA1D2C]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                        <path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
                      </svg>
                      <span>Weight &amp; Volume Details</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Optional</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Gross Weight <span className="text-slate-400 font-normal">(Opt)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                        />
                        <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                          KG
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Volume <span className="text-slate-400 font-normal">(Opt)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={cbm}
                          onChange={(e) => setCbm(e.target.value)}
                          placeholder="e.g. 0.4"
                          className="w-full h-9 pl-3 pr-11 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                        />
                        <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                          CBM
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Pieces Qty
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="10"
                          className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                        />
                        <span className="absolute right-2.5 top-2.5 text-[10px] font-medium text-slate-400 select-none">
                          Pcs
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Packaging
                      </label>
                      <ReferenceSelect
                        value={packagingType}
                        onChange={(val) => setPackagingType(val)}
                        options={[
                          { value: 'carton', label: 'Cartons' },
                          { value: 'pallet', label: 'Pallets' },
                          { value: 'crate', label: 'Wooden Crates' },
                          { value: 'drum', label: 'Steel Drums' },
                          { value: 'bag', label: 'Woven Bags / Sacks' }
                        ]}
                        placeholder="Select Packaging"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Additional Notes / Instructions
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        {['Garments', 'Fabrics', 'Electronics', 'Machinery'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCargoDescription(`${cat} & Commercial Goods (1688 / Factory)`)}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-none cursor-pointer"
                          >
                            +{cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={cargoDescription}
                      onChange={(e) => setCargoDescription(e.target.value)}
                      placeholder="Special handling instructions, carton markings, or specifications..."
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Official Recipient Details */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                  <span className="font-['Manrope',sans-serif] font-bold text-sm">Contact Information</span>
                  <span className="text-[10px] font-semibold text-[#EA1D2C] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    Direct Quote Notification
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company or Person <span className="text-[#EA1D2C]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Textiles Ltd"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Email <span className="text-[#EA1D2C]">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone / WhatsApp <span className="text-[#EA1D2C]">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+880 1711 000000"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      required
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 font-medium focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 transition-none outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Ledger & Consignment Review */}
            <div className="lg:col-span-4">
              <div className="sticky top-4 bg-gradient-to-b from-[#FFF5F5] via-rose-50/40 to-white rounded-xl border border-red-200/90 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-red-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EA1D2C]"></span>
                    <span className="text-xs font-bold text-slate-900 font-['Manrope',sans-serif]">
                      Order Summary
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-[#EA1D2C] font-bold border border-red-200">
                    Customs Verified
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-red-100/90 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Estimated Shipping Cost
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Pre-Assessed
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-['Manrope',sans-serif]">
                    Customs &amp; Taxes Included
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Final shipping charges and customs will be verified upon package arrival at our China warehouse based on actual weight and volume.
                  </p>
                </div>

                {/* Itemized Specifications */}
                <div className="space-y-2.5 py-3 border-y border-red-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Service Mode:</span>
                    <span className="font-semibold text-slate-900">
                      {mode === 'air' ? 'By Air' : mode === 'sea' ? 'By Ship' : 'Hand Carry'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Transit SLA:</span>
                    <span className="font-semibold text-[#EA1D2C]">
                      {currentSla}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50/80 dark:bg-red-950/40 border border-red-200/90 dark:border-red-900/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Estimated Arrival Date
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Real-Time Calendar
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#EA1D2C] font-mono">
                      {currentArrivalRange}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Calculated from real-time dispatch date upon intake at Guangzhou hub.
                    </p>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Route Corridor:</span>
                    <span className="font-semibold text-slate-900">{originCity} → {destCountry}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Product Item:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {productName.trim() || 'General Cargo'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Category:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                      {productCategory}
                    </span>
                  </div>
                  {productImages.length > 0 && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-slate-500 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                            <circle cx="12" cy="13" r="3" />
                          </svg>
                          <span>Product Photos:</span>
                        </span>
                        <span className="text-[#EA1D2C] font-mono font-bold">{productImages.length} Attached</span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {productImages.map((img) => (
                          <img
                            key={img.id}
                            src={img.url}
                            alt="preview"
                            className="w-9 h-9 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Chargeable Metric:</span>
                    <span className="font-semibold font-mono text-slate-900 tabular-nums">
                      {mode === 'sea'
                        ? (numCbm > 0 ? `${numCbm.toFixed(2)} CBM` : 'Based on actual volume')
                        : (numWeight > 0 || numCbm > 0 ? `${airChargeableKg.toFixed(1)} KG` : 'Based on intake weight')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Packages:</span>
                    <span className="font-semibold text-slate-900">
                      {quantity || '1'} {packagingType || 'Cartons'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Customs Brokerage:</span>
                    <span className="font-semibold text-emerald-700">Full Brokerage Included</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Option:</span>
                    <span className="font-semibold text-slate-900 text-right">
                      Doorstep Delivery ({destCountry})
                    </span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] active:bg-[#B91C1C] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-none cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <svg aria-hidden="true" className="w-4 h-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                      </svg>
                      <span>Submitting Your Request…</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span>Submit Shipping Request</span>
                      <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                </button>

                {/* Guarantees Matrix */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1 border-t border-red-100">
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>China Warehouse Address</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>No Hidden Costs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Live Tracking</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Clear Invoicing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible/Interactive FAQ Section Below Form */}
          {showFaq && <QuoteFaqSection />}
        </form>
      )}
    </div>
  );
}
