import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { PosLedgerRecord } from '../../server/services/posLedger.service';
import { downloadPosReceiptPDF } from '../../lib/posReceiptPdf';

interface PosStats {
  totalOrders: number;
  totalPurchaseRmb: number;
  totalPurchaseBdt: number;
  totalFreightBdt: number;
  totalBilledBdt: number;
  totalCollectedBdt: number;
  totalDueBdt: number;
  totalProfitBdt: number;
  totalWeightKg: number;
}

export default function PosLedgerTerminal({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [records, setRecords] = useState<PosLedgerRecord[]>([]);
  const [stats, setStats] = useState<PosStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Modals & Panels
  const [showPosDrawer, setShowPosDrawer] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PosLedgerRecord | null>(null);
  const [thermalReceiptRecord, setThermalReceiptRecord] = useState<PosLedgerRecord | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  // Quick POS Form State
  const [formData, setFormData] = useState({
    orderId: '',
    orderDate: new Date().toISOString().split('T')[0],
    cnDate: new Date().toISOString().split('T')[0],
    bdDate: '',
    customerName: '',
    mobileNo: '',
    importerClient: '',
    shippingMark: '',
    websiteOrderNo: '',
    itemDetails: '',
    chinaCourierTracking: '',
    currentStatus: 'Processing',
    supplierName: 'Taobao',
    quantity: 1,
    unitPriceRmb: 0,
    rmbRateBdt: 19.5,
    purchaseCostPaidBdt: 0,
    serviceType: 'Sourcing & Shipping',
    cnWeightKg: 0,
    bdWeightKg: 0,
    shippingRatePerKgBdt: 850,
    bdCourierName: 'Steadfast',
    bdTrackingNo: '',
    remark: ''
  });

  // Live Auto Computed Values for the POS form
  const computedForm = useMemo(() => {
    const qty = Number(formData.quantity) || 0;
    const unitRmb = Number(formData.unitPriceRmb) || 0;
    const totalRmb = Math.round(qty * unitRmb * 100) / 100;

    const rmbRate = Number(formData.rmbRateBdt) || 19.5;
    const purchaseCostBdt = Math.round(totalRmb * rmbRate * 100) / 100;

    const paidBdt = Number(formData.purchaseCostPaidBdt) || 0;
    const purchaseDueBdt = Math.max(0, Math.round((purchaseCostBdt - paidBdt) * 100) / 100);

    const weight = Number(formData.bdWeightKg) || Number(formData.cnWeightKg) || 0;
    const rate = Number(formData.shippingRatePerKgBdt) || 0;
    const intlFreightBdt = Math.round(weight * rate * 100) / 100;

    const totalBillBdt = Math.round((purchaseCostBdt + intlFreightBdt) * 100) / 100;

    let paymentStatus: 'Due' | 'Paid' | 'Partial' = 'Due';
    if (paidBdt >= totalBillBdt && totalBillBdt > 0) {
      paymentStatus = 'Paid';
    } else if (paidBdt > 0) {
      paymentStatus = 'Partial';
    }

    const profitEstimateBdt = Math.round(((intlFreightBdt * 0.15) + (purchaseCostBdt * 0.05)) * 100) / 100;

    return {
      totalRmb,
      purchaseCostBdt,
      purchaseDueBdt,
      intlFreightBdt,
      totalBillBdt,
      paymentStatus,
      profitEstimateBdt
    };
  }, [formData]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (serviceFilter !== 'all') params.set('serviceType', serviceFilter);
      if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
      if (supplierFilter !== 'all') params.set('supplier', supplierFilter);

      const res = await fetch(`/api/admin/pos-ledger?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setStats(data.stats || null);
      }
    } catch {
      showToast('Failed to load POS operations ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedger();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, serviceFilter, paymentFilter, supplierFilter]);

  const resetForm = () => {
    setFormData({
      orderId: '',
      orderDate: new Date().toISOString().split('T')[0],
      cnDate: new Date().toISOString().split('T')[0],
      bdDate: '',
      customerName: '',
      mobileNo: '',
      importerClient: '',
      shippingMark: '',
      websiteOrderNo: '',
      itemDetails: '',
      chinaCourierTracking: '',
      currentStatus: 'Processing',
      supplierName: 'Taobao',
      quantity: 1,
      unitPriceRmb: 0,
      rmbRateBdt: 19.5,
      purchaseCostPaidBdt: 0,
      serviceType: 'Sourcing & Shipping',
      cnWeightKg: 0,
      bdWeightKg: 0,
      shippingRatePerKgBdt: 850,
      bdCourierName: 'Steadfast',
      bdTrackingNo: '',
      remark: ''
    });
    setEditingRecord(null);
  };

  const openNewOrderDrawer = () => {
    resetForm();
    setShowPosDrawer(true);
  };

  const openEditDrawer = (rec: PosLedgerRecord) => {
    setEditingRecord(rec);
    setFormData({
      orderId: rec.orderId,
      orderDate: rec.orderDate,
      cnDate: rec.cnDate,
      bdDate: rec.bdDate || '',
      customerName: rec.customerName,
      mobileNo: rec.mobileNo || '',
      importerClient: rec.importerClient || '',
      shippingMark: rec.shippingMark || '',
      websiteOrderNo: rec.websiteOrderNo || '',
      itemDetails: rec.itemDetails,
      chinaCourierTracking: rec.chinaCourierTracking || '',
      currentStatus: rec.currentStatus,
      supplierName: rec.supplierName || 'Taobao',
      quantity: rec.quantity,
      unitPriceRmb: rec.unitPriceRmb,
      rmbRateBdt: rec.rmbRateBdt,
      purchaseCostPaidBdt: rec.purchaseCostPaidBdt,
      serviceType: rec.serviceType,
      cnWeightKg: rec.cnWeightKg,
      bdWeightKg: rec.bdWeightKg,
      shippingRatePerKgBdt: rec.shippingRatePerKgBdt,
      bdCourierName: rec.bdCourierName || 'Steadfast',
      bdTrackingNo: rec.bdTrackingNo || '',
      remark: rec.remark || ''
    });
    setShowPosDrawer(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      showToast('Customer Name is required', 'error');
      return;
    }
    setSavingRecord(true);
    try {
      if (editingRecord) {
        // Update
        const res = await fetch(`/api/admin/pos-ledger/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update order');
        showToast(`Order ${data.record.orderId} updated successfully!`, 'success');
      } else {
        // Create
        const res = await fetch('/api/admin/pos-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create order');
        showToast(`Order ${data.record.orderId} created in POS Ledger!`, 'success');
      }
      setShowPosDrawer(false);
      resetForm();
      loadLedger();
    } catch (err: any) {
      showToast(err.message || 'Error saving POS order', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDelete = async (id: string, orderId: string) => {
    if (!confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/pos-ledger/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Order ${orderId} deleted successfully`, 'success');
        loadLedger();
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      showToast('Error deleting record', 'error');
    }
  };

  const handleQuickPaymentToggle = async (rec: PosLedgerRecord) => {
    const isPaid = rec.paymentStatus === 'Paid';
    const newPaidAmount = isPaid ? 0 : rec.totalBillBdt;
    try {
      const res = await fetch(`/api/admin/pos-ledger/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseCostPaidBdt: newPaidAmount })
      });
      if (res.ok) {
        showToast(`Payment marked as ${isPaid ? 'Due' : 'Fully Paid'} for ${rec.orderId}`, 'info');
        loadLedger();
      }
    } catch {
      showToast('Failed to update payment status', 'error');
    }
  };

  const handleImportCsv = async () => {
    if (!importCsvText.trim()) {
      showToast('Please paste valid CSV content', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/pos-ledger/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: importCsvText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Imported ${data.imported} orders successfully!`, 'success');
        setShowImportModal(false);
        setImportCsvText('');
        loadLedger();
      } else {
        throw new Error(data.error || 'Failed to import CSV');
      }
    } catch (err: any) {
      showToast(err.message || 'Import error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadPdf = (rec: PosLedgerRecord) => {
    try {
      downloadPosReceiptPDF(rec);
      showToast(`Downloaded official PDF receipt for ${rec.orderId}`, 'success');
    } catch {
      showToast('Failed to generate PDF receipt', 'error');
    }
  };

  return (
    <div className="space-y-6 font-['Inter',sans-serif]">
      {/* 1. POS SUMMARY & KPI CARDS (Real-time Financial Overview) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Total Orders</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-['Manrope']">{stats?.totalOrders || 0}</div>
          <span className="text-[10px] text-slate-500 font-medium">{stats?.totalWeightKg || 0} KG Cargo</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">China Purchase (RMB)</span>
          <div className="text-xl font-extrabold text-amber-600 mt-1 font-mono">¥{(stats?.totalPurchaseRmb || 0).toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 font-medium">৳{(stats?.totalPurchaseBdt || 0).toLocaleString()} BDT</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Int'l Freight</span>
          <div className="text-xl font-extrabold text-sky-600 mt-1 font-mono">৳{(stats?.totalFreightBdt || 0).toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 font-medium">Air &amp; Sea Cargo</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Total Billing</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">৳{(stats?.totalBilledBdt || 0).toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 font-medium">Grand Billed Revenue</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Collected / Due</span>
          <div className="text-xl font-extrabold text-emerald-600 mt-1 font-mono">৳{(stats?.totalCollectedBdt || 0).toLocaleString()}</div>
          <span className="text-[10px] font-bold text-red-600 font-mono">Due: ৳{(stats?.totalDueBdt || 0).toLocaleString()}</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Est. Net Profit</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">৳{(stats?.totalProfitBdt || 0).toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Margin ~15%</span>
        </div>
      </div>

      {/* 2. POS CONTROL BAR (Search, Filters, Quick Entry, Import, Export) */}
      <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Customer, Order ID, Phone, SF/ZTO Tracking..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
            />
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 font-medium"
          >
            <option value="all">All Services</option>
            <option value="Sourcing & Shipping">Sourcing &amp; Shipping</option>
            <option value="Sourcing Only">Sourcing Only</option>
            <option value="Air Cargo">Air Cargo</option>
            <option value="Sea Cargo">Sea Cargo</option>
            <option value="Door-to-Door">Door-to-Door</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 font-medium"
          >
            <option value="all">All Payment Status</option>
            <option value="Due">Due</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs text-slate-700 font-medium"
          >
            <option value="all">All Suppliers</option>
            <option value="Taobao">Taobao</option>
            <option value="1688">1688</option>
            <option value="Alibaba">Alibaba</option>
            <option value="Factory">Factory Direct</option>
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-none shadow-2xs"
            title="Import from Google Sheets CSV"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Import CSV</span>
          </button>

          <a
            href="/api/admin/pos-ledger/export"
            download
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-none shadow-2xs"
            title="Export 1:1 to Google Sheets / Excel CSV"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Export CSV</span>
          </a>

          <button
            type="button"
            onClick={openNewOrderDrawer}
            className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-none"
          >
            <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Quick POS Order</span>
          </button>
        </div>
      </div>

      {/* 3. INTERACTIVE SPREADSHEET-STYLE OPERATIONS LEDGER TABLE (1:1 with Google Sheet) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* Grouped Table Header */}
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[10px] uppercase font-mono tracking-wider font-bold">
                <th className="py-2.5 px-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">Order ID</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Customer &amp; Mark</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Product &amp; Supplier</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Status</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">RMB Cost</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Rate / BDT</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Freight (BDT)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-900">Total Bill</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">Payment</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Courier &amp; Tracking</th>
                <th className="py-2.5 px-3 text-right sticky right-0 bg-slate-100 z-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-500">
                    Loading operations ledger...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-500">
                    No orders found matching criteria. Click "+ Quick POS Order" to add.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order ID & Dates */}
                    <td className="py-2.5 px-3 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200 font-mono font-bold text-slate-900">
                      <div>{r.orderId}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{r.orderDate}</div>
                    </td>

                    {/* Customer & Mark */}
                    <td className="py-2.5 px-3 border-r border-slate-200">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{r.customerName}</span>
                        {r.importerClient && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600 font-bold">
                            {r.importerClient}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>{r.mobileNo}</span>
                        {r.shippingMark && <span className="text-[#EA1D2C]">Mark: {r.shippingMark}</span>}
                      </div>
                    </td>

                    {/* Product & Supplier */}
                    <td className="py-2.5 px-3 border-r border-slate-200 max-w-[220px]">
                      <div className="font-medium text-slate-900 truncate" title={r.itemDetails}>
                        {r.itemDetails}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 rounded text-[10px]">{r.supplierName}</span>
                        <span>· {r.quantity} pcs</span>
                        {r.chinaCourierTracking && (
                          <span className="font-mono text-[10px] text-slate-400 truncate">SF: {r.chinaCourierTracking}</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 border-r border-slate-200">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                        {r.currentStatus}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{r.serviceType}</div>
                    </td>

                    {/* RMB Cost */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
                      <div className="font-bold text-amber-700">¥{Number(r.totalPurchaseRmb).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">¥{Number(r.unitPriceRmb).toFixed(2)} × {r.quantity}</div>
                    </td>

                    {/* Rate & Purchase BDT */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
                      <div className="font-bold text-slate-900">৳{Number(r.purchaseCostBdt).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">@{Number(r.rmbRateBdt).toFixed(2)} BDT</div>
                    </td>

                    {/* Freight BDT */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
                      <div className="font-bold text-sky-700">৳{Number(r.internationalFreightBdt).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{r.bdWeightKg || r.cnWeightKg} KG @ ৳{r.shippingRatePerKgBdt}</div>
                    </td>

                    {/* Total Bill */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
                      <div className="font-extrabold text-slate-900 text-sm">৳{Number(r.totalBillBdt).toLocaleString()}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Margin: +৳{Number(r.profitEstimateBdt).toLocaleString()}</div>
                    </td>

                    {/* Payment Status */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                      <button
                        type="button"
                        onClick={() => handleQuickPaymentToggle(r)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-none ${
                          r.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : r.paymentStatus === 'Partial'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                        }`}
                        title="Click to toggle Paid/Due"
                      >
                        {r.paymentStatus}
                      </button>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Due: ৳{Number(r.purchaseCostDueBdt).toLocaleString()}
                      </div>
                    </td>

                    {/* Courier & Tracking */}
                    <td className="py-2.5 px-3 border-r border-slate-200">
                      {r.bdCourierName && (
                        <div className="font-semibold text-slate-800 text-[11px]">{r.bdCourierName}</div>
                      )}
                      {r.bdTrackingNo ? (
                        <div className="font-mono text-[10px] text-blue-600 font-bold">{r.bdTrackingNo}</div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No tracking yet</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right sticky right-0 bg-white hover:bg-slate-50 z-10 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Direct PDF Download */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(r)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-[#EA1D2C] text-xs cursor-pointer shadow-2xs transition-colors"
                          title="Download PDF Receipt"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>

                        {/* View Receipt Modal */}
                        <button
                          type="button"
                          onClick={() => setThermalReceiptRecord(r)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs cursor-pointer shadow-2xs transition-colors"
                          title="Preview Receipt Slip"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditDrawer(r)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-semibold cursor-pointer transition-none shadow-2xs"
                        >
                          Edit
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.orderId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="Delete Order"
                        >
                          <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. POS FAST-ENTRY MODAL / DRAWER */}
      {showPosDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[94vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-['Manrope'] flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-red-50 text-[#EA1D2C] flex items-center justify-center">
                    <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </span>
                  <span>{editingRecord ? `Edit Order: ${editingRecord.orderId}` : 'POS Rapid Order Terminal'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-velocity entry with real-time RMB currency conversion, freight calculations, and instant ledger sync.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPosDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-5 pt-4 text-xs">
              {/* Section 1: Customer & Logistics Identification */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  01 · Customer &amp; Order Identification
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="e.g. Sourov Ahmed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Mobile / WhatsApp No</label>
                    <input
                      type="text"
                      value={formData.mobileNo}
                      onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                      placeholder="+880 1711..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Importer Code / Mark</label>
                    <input
                      type="text"
                      value={formData.importerClient}
                      onChange={(e) => setFormData({ ...formData, importerClient: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono uppercase"
                      placeholder="e.g. HTI"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Shipping Mark</label>
                    <input
                      type="text"
                      value={formData.shippingMark}
                      onChange={(e) => setFormData({ ...formData, shippingMark: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="HTI-DAC-01"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Website Order Ref (Optional)</label>
                    <input
                      type="text"
                      value={formData.websiteOrderNo}
                      onChange={(e) => setFormData({ ...formData, websiteOrderNo: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="WEB-1092"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Order Date</label>
                    <input
                      type="date"
                      value={formData.orderDate}
                      onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Product & Supplier Sourcing */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  02 · Product Details &amp; Sourcing Platform
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Product / Item Details *</label>
                    <input
                      type="text"
                      required
                      value={formData.itemDetails}
                      onChange={(e) => setFormData({ ...formData, itemDetails: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="e.g. Women Silk Scarf Accessories"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Supplier / Platform</label>
                    <select
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Taobao">Taobao</option>
                      <option value="1688">1688 (Alibaba CN)</option>
                      <option value="Alibaba">Alibaba International</option>
                      <option value="Pinduoduo">Pinduoduo</option>
                      <option value="Factory Direct">Factory Direct</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Service Mode</label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Sourcing & Shipping">Sourcing &amp; Shipping</option>
                      <option value="Sourcing Only">Sourcing Only</option>
                      <option value="Air Cargo">Air Cargo (3-7d)</option>
                      <option value="Sea Cargo">Sea Cargo (35-45d)</option>
                      <option value="Door-to-Door">Door-to-Door Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">China Courier Tracking (SF/ZTO/YTO)</label>
                    <input
                      type="text"
                      value={formData.chinaCourierTracking}
                      onChange={(e) => setFormData({ ...formData, chinaCourierTracking: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="SF14092847192"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Current Status</label>
                    <select
                      value={formData.currentStatus}
                      onChange={(e) => setFormData({ ...formData, currentStatus: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Processing">Processing / Order Placed</option>
                      <option value="Received in CN Hub">Received in China Hub (Guangzhou/Yiwu)</option>
                      <option value="Dispatched Flight/Ship">Dispatched (Air / Ocean Corridor)</option>
                      <option value="Customs Clearance DAC">Customs Clearance (DAC Airport / CGP)</option>
                      <option value="Ready for Delivery">Ready for Delivery / Warehouse Arrived</option>
                      <option value="Delivered">Delivered &amp; Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Live Real-time POS Calculator (RMB + BDT + Freight + Profit) */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900 block">
                    03 · Live POS Costing &amp; Freight Engine
                  </span>
                  <span className="text-[11px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    Auto-Computed Realtime
                  </span>
                </div>

                {/* RMB Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Quantity (Pcs) *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 1 })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Unit Price (RMB ¥) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={formData.unitPriceRmb}
                      onChange={(e) => setFormData({ ...formData, unitPriceRmb: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Total Purchase (RMB)</label>
                    <div className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs font-mono font-extrabold text-amber-700 flex items-center justify-center">
                      ¥{computedForm.totalRmb.toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">RMB Rate (BDT) *</label>
                    <input
                      type="number"
                      step="0.05"
                      min={1}
                      required
                      value={formData.rmbRateBdt}
                      onChange={(e) => setFormData({ ...formData, rmbRateBdt: Number(e.target.value) || 19.5 })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center"
                    />
                  </div>
                </div>

                {/* Freight & Weight Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">CN Weight (KG)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={formData.cnWeightKg}
                      onChange={(e) => setFormData({ ...formData, cnWeightKg: Number(e.target.value) || 0 })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">BD Weight (KG)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={formData.bdWeightKg}
                      onChange={(e) => setFormData({ ...formData, bdWeightKg: Number(e.target.value) || 0 })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-center font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Shipping Rate / KG (৳)</label>
                    <input
                      type="number"
                      step="10"
                      min={0}
                      value={formData.shippingRatePerKgBdt}
                      onChange={(e) => setFormData({ ...formData, shippingRatePerKgBdt: Number(e.target.value) || 0 })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Int'l Freight (BDT)</label>
                    <div className="w-full h-8 px-2.5 rounded bg-white border border-slate-300 text-xs font-mono font-extrabold text-sky-700 flex items-center justify-center">
                      ৳{computedForm.intlFreightBdt.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Final Totals Breakdown Banner */}
                <div className="p-3.5 rounded-lg bg-white border border-amber-300/80 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Purchase Cost BDT</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">৳{computedForm.purchaseCostBdt.toLocaleString()}</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block uppercase font-mono">Customer Paid ৳</label>
                    <input
                      type="number"
                      step="100"
                      min={0}
                      value={formData.purchaseCostPaidBdt}
                      onChange={(e) => setFormData({ ...formData, purchaseCostPaidBdt: Number(e.target.value) || 0 })}
                      className="w-full h-7 px-2 rounded border border-slate-300 text-xs font-mono font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Outstanding Due</span>
                    <span className="text-sm font-extrabold text-red-600 font-mono">৳{computedForm.purchaseDueBdt.toLocaleString()}</span>
                  </div>

                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Grand Total Bill</span>
                    <span className="text-base font-black text-slate-900 font-mono">৳{computedForm.totalBillBdt.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: BD Local Delivery Dispatch */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  04 · Bangladesh Local Delivery &amp; Dispatch
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Courier Partner</label>
                    <select
                      value={formData.bdCourierName}
                      onChange={(e) => setFormData({ ...formData, bdCourierName: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    >
                      <option value="Steadfast">Steadfast Courier</option>
                      <option value="Pathao">Pathao Courier</option>
                      <option value="RedX">RedX Logistics</option>
                      <option value="Paperfly">Paperfly</option>
                      <option value="Hub Pickup">Dhaka Central Hub Pickup</option>
                      <option value="SA Paribahan">SA Paribahan</option>
                      <option value="Sundarban">Sundarban Courier</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">BD Courier Tracking No</label>
                    <input
                      type="text"
                      value={formData.bdTrackingNo}
                      onChange={(e) => setFormData({ ...formData, bdTrackingNo: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="e.g. STDF-8839201"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Remarks / Customer Update</label>
                    <input
                      type="text"
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                      placeholder="Customer requested extra packing"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPosDrawer(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord}
                  className="px-6 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingRecord ? 'Saving...' : editingRecord ? 'Update POS Record' : 'Save to POS Ledger →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. THERMAL POS RECEIPT PRINT MODAL */}
      {thermalReceiptRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            {/* Thermal Slip Content (80mm width standard) */}
            <div className="text-slate-900 font-mono text-xs border border-dashed border-slate-300 p-4 rounded-lg bg-slate-50 space-y-3">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
                <div className="text-base font-black tracking-tight font-['Manrope'] text-[#EA1D2C]">
                  GoShipping Express
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  China to Bangladesh Freight &amp; Sourcing Desk
                </div>
                <div className="text-[10px] text-slate-600 font-mono font-bold mt-1">
                  POS ORDER: {thermalReceiptRecord.orderId}
                </div>
                <div className="text-[9px] text-slate-400">
                  {thermalReceiptRecord.orderDate} · Dhaka Central Terminal
                </div>
              </div>

              {/* Customer Info */}
              <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div><span className="text-slate-400">Customer:</span> <span className="font-bold">{thermalReceiptRecord.customerName}</span></div>
                {thermalReceiptRecord.mobileNo && <div><span className="text-slate-400">Phone:</span> {thermalReceiptRecord.mobileNo}</div>}
                {thermalReceiptRecord.shippingMark && <div><span className="text-slate-400">Mark:</span> <span className="font-bold text-[#EA1D2C]">{thermalReceiptRecord.shippingMark}</span></div>}
              </div>

              {/* Sourcing & Product Breakdown */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="font-bold truncate">{thermalReceiptRecord.itemDetails}</div>
                <div className="flex justify-between text-slate-600">
                  <span>{thermalReceiptRecord.quantity} pcs @ ¥{Number(thermalReceiptRecord.unitPriceRmb).toFixed(2)}</span>
                  <span className="font-bold">¥{Number(thermalReceiptRecord.totalPurchaseRmb).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>RMB Rate (BDT)</span>
                  <span>@{Number(thermalReceiptRecord.rmbRateBdt).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Purchase BDT:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Freight Charges */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-slate-600">
                  <span>Weight ({thermalReceiptRecord.bdWeightKg || thermalReceiptRecord.cnWeightKg} KG @ ৳{thermalReceiptRecord.shippingRatePerKgBdt})</span>
                  <span>{thermalReceiptRecord.serviceType}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Int'l Freight BDT:</span>
                  <span>৳{Number(thermalReceiptRecord.internationalFreightBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Settlement */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between text-xs font-black">
                  <span>TOTAL BILL:</span>
                  <span>৳{Number(thermalReceiptRecord.totalBillBdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>PAID AMOUNT:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostPaidBdt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600 font-extrabold">
                  <span>DUE BALANCE:</span>
                  <span>৳{Number(thermalReceiptRecord.purchaseCostDueBdt).toLocaleString()}</span>
                </div>
              </div>

              {/* Footer barcode & contact */}
              <div className="text-center text-[9px] text-slate-500 pt-1 space-y-1">
                {thermalReceiptRecord.bdTrackingNo && (
                  <div className="font-mono text-slate-700 font-bold">
                    Courier Tracking: {thermalReceiptRecord.bdCourierName} {thermalReceiptRecord.bdTrackingNo}
                  </div>
                )}
                <div>Support Hotline: +880 1797-252627</div>
                <div className="font-mono tracking-widest text-[10px] text-slate-400">
                  * * * THANK YOU FOR SHIPPING * * *
                </div>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setThermalReceiptRecord(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPdf(thermalReceiptRecord)}
                className="px-4 py-2 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download PDF Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. IMPORT CSV MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 font-['Manrope']">
                Import Orders from Google Sheets CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Copy and paste the raw CSV rows or content from your <strong>All-in-One Google Sheet</strong>. All 30 columns will be parsed and auto-calculated into the POS ledger.
              </p>

              <textarea
                rows={8}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="Paste CSV rows here (including header)..."
                className="w-full p-3 rounded-lg border border-slate-300 font-mono text-[11px] focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleImportCsv}
                  className="px-5 py-2 rounded-lg bg-[#EA1D2C] text-white font-bold hover:bg-[#D41523] disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? 'Importing...' : 'Start Import →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
