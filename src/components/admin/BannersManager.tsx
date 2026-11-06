import React, { useState, useEffect } from 'react';

export interface BannerItem {
  id: string;
  badge: string;
  badgeColor?: string;
  headlineBengali: string;
  headlineAccent: string;
  subtitle: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  features: string[];
  imageUrl: string;
  imageAlt: string;
  taglineSmall?: string;
  displayOrder: number;
  isActive: boolean;
}

const DEFAULT_BANNER: Omit<BannerItem, 'id'> = {
  badge: 'GO SHIPPING • CARGO EXPRESS',
  badgeColor: '#EA1D2C',
  headlineBengali: 'চীন থেকে পণ্য সরাসরি আপনার দরজায়',
  headlineAccent: 'সহজ সোর্সিং, নির্ভরযোগ্য কাস্টমস ও দ্রুততম শিপমেন্ট।',
  subtitle: 'গুয়াংজু, শেনঝেন ও ইঊ ওয়্যারহাউস থেকে সরাসরি আকাশ বা সমুদ্রপথে বাংলাদেশে ঝামেলাহীন পণ্য পরিবহন।',
  primaryCtaText: 'রেট ক্যালকুলেটর →',
  primaryCtaLink: '/quote',
  secondaryCtaText: 'ট্র্যাক পার্সেল',
  secondaryCtaLink: '/tracking',
  features: [
    'China Product Sourcing',
    'Customs Clearance Included',
    'Door-to-Door Delivery'
  ],
  imageUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1600&q=85',
  imageAlt: 'Go Shipping Freight Cargo Hub',
  taglineSmall: 'Guangzhou · Shenzhen · Yiwu ⇄ Dhaka · Chittagong',
  displayOrder: 0,
  isActive: true
};

export default function BannersManager({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Omit<BannerItem, 'id'>>(DEFAULT_BANNER);
  const [featureInputs, setFeatureInputs] = useState<string[]>(DEFAULT_BANNER.features);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banners');
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setBanners(data.banners);
      }
    } catch {
      showToast('Failed to load homepage banners', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      ...DEFAULT_BANNER,
      displayOrder: banners.length
    });
    setFeatureInputs([...DEFAULT_BANNER.features]);
    setModalOpen(true);
  };

  const openEditModal = (banner: BannerItem) => {
    setEditingBanner(banner);
    setFormData({
      badge: banner.badge,
      badgeColor: banner.badgeColor || '#EA1D2C',
      headlineBengali: banner.headlineBengali,
      headlineAccent: banner.headlineAccent,
      subtitle: banner.subtitle,
      primaryCtaText: banner.primaryCtaText,
      primaryCtaLink: banner.primaryCtaLink,
      secondaryCtaText: banner.secondaryCtaText || '',
      secondaryCtaLink: banner.secondaryCtaLink || '',
      features: Array.isArray(banner.features) ? banner.features : [],
      imageUrl: banner.imageUrl,
      imageAlt: banner.imageAlt,
      taglineSmall: banner.taglineSmall || '',
      displayOrder: banner.displayOrder,
      isActive: banner.isActive
    });
    setFeatureInputs(Array.isArray(banner.features) && banner.features.length > 0 ? [...banner.features] : ['']);
    setModalOpen(true);
  };

  const handleToggleActive = async (banner: BannerItem) => {
    const updatedStatus = !banner.isActive;
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus })
      });
      if (res.ok) {
        setBanners((prev) =>
          prev.map((b) => (b.id === banner.id ? { ...b, isActive: updatedStatus } : b))
        );
        showToast(`Banner ${updatedStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
      } else {
        throw new Error('Update failed');
      }
    } catch {
      showToast('Error updating banner status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner slide? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBanners((prev) => prev.filter((b) => b.id !== id));
        showToast('Banner slide deleted successfully', 'success');
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      showToast('Error deleting banner', 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBanners.length) return;

    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    setBanners(newBanners);

    const orderedIds = newBanners.map((b) => b.id);
    try {
      await fetch('/api/admin/banners/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      showToast('Banner display order updated!', 'info');
    } catch {
      showToast('Failed to save banner reordering', 'error');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const cleanedFeatures = featureInputs.map((f) => f.trim()).filter(Boolean);

    const payload = {
      ...formData,
      features: cleanedFeatures
    };

    try {
      if (editingBanner) {
        // Update
        const res = await fetch(`/api/admin/banners/${editingBanner.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update banner');
        showToast('Homepage banner updated successfully!', 'success');
      } else {
        // Create
        const res = await fetch('/api/admin/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create banner');
        showToast('New homepage banner created successfully!', 'success');
      }
      setModalOpen(false);
      fetchBanners();
    } catch (err: any) {
      showToast(err.message || 'Error saving banner', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 font-['Manrope',sans-serif]">
                Homepage Hero Banners &amp; Slider
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-[#EA1D2C] border border-red-200">
                {banners.length} Total Slides
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Manage the hero banners and rotating carousel slides shown on the homepage. Any updates made here instantly take effect on the live website.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-lg bg-[#EA1D2C] text-white text-xs font-bold hover:bg-[#D41523] shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Add New Slide</span>
          </button>
        </div>
      </div>

      {/* Banner Cards List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          Loading homepage banners...
        </div>
      ) : banners.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No banner slides created yet. Click "+ Add New Slide" above.
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((b, index) => (
            <div
              key={b.id}
              className={`p-5 rounded-xl bg-white border transition-all ${
                b.isActive ? 'border-slate-200 shadow-2xs' : 'border-slate-200/60 bg-slate-50/50 opacity-75'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Visual Thumbnail */}
                <div className="lg:col-span-3">
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/9] bg-slate-900 group">
                    <img
                      src={b.imageUrl}
                      alt={b.imageAlt}
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                      Slide #{index + 1}
                    </div>
                    {b.taglineSmall && (
                      <div className="absolute bottom-1.5 left-2 right-2 text-[9px] font-mono text-slate-300 truncate">
                        {b.taglineSmall}
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner Content Details */}
                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[#EA1D2C] text-[10px] font-bold font-mono">
                      {b.badge}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {b.isActive ? 'Active on Homepage' : 'Hidden / Inactive'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 font-['Noto_Sans_Bengali','Manrope'] line-clamp-1">
                    {b.headlineBengali}
                  </h3>
                  <p className="text-xs font-semibold text-[#EA1D2C] font-['Noto_Sans_Bengali'] line-clamp-1">
                    {b.headlineAccent}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {b.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                      Primary CTA: {b.primaryCtaText} ({b.primaryCtaLink})
                    </span>
                    {b.secondaryCtaText && (
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                        Sec: {b.secondaryCtaText}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col justify-end gap-2 items-end">
                  <div className="flex items-center gap-1.5 w-full justify-end">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === banners.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b)}
                      className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-none ${
                        b.isActive
                          ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {b.isActive ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 w-full justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="px-3.5 py-1.5 rounded bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-none"
                    >
                      Edit Slide
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      className="px-3 py-1.5 rounded border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-bold cursor-pointer transition-none"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 font-['Manrope']">
                {editingBanner ? 'Edit Hero Banner Slide' : 'Create New Hero Banner Slide'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 pt-4 text-xs">
              {/* Badge & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Top Badge Text</label>
                  <input
                    type="text"
                    required
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                    placeholder="e.g. GO SHIPPING • CHINA SOURCING & LOGISTICS"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tagline Small (Under Photo)</label>
                  <input
                    type="text"
                    value={formData.taglineSmall || ''}
                    onChange={(e) => setFormData({ ...formData, taglineSmall: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                    placeholder="Guangzhou · Yiwu · Shenzhen"
                  />
                </div>
              </div>

              {/* Main Headline Bengali */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Main Headline (Bengali)</label>
                <input
                  type="text"
                  required
                  value={formData.headlineBengali}
                  onChange={(e) => setFormData({ ...formData, headlineBengali: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                  placeholder="e.g. চীন থেকে পণ্য সোর্সিং ও শিপমেন্ট করতে চান?"
                />
              </div>

              {/* Accent Headline */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Accent Headline (Red Highlight)</label>
                <input
                  type="text"
                  required
                  value={formData.headlineAccent}
                  onChange={(e) => setFormData({ ...formData, headlineAccent: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-[#EA1D2C] focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                  placeholder="e.g. সঠিক পণ্য, নির্ভরযোগ্য Supplier — সবকিছু এক জায়গায়।"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Subtitle / Description</label>
                <textarea
                  required
                  rows={3}
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                  placeholder="Enter detailed description in Bengali or English..."
                />
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">Primary Action Button</span>
                  <div>
                    <label className="text-[11px] text-slate-500">Button Text</label>
                    <input
                      type="text"
                      required
                      value={formData.primaryCtaText}
                      onChange={(e) => setFormData({ ...formData, primaryCtaText: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                      placeholder="e.g. সোর্সিং শুরু করুন →"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Destination Link</label>
                    <input
                      type="text"
                      required
                      value={formData.primaryCtaLink}
                      onChange={(e) => setFormData({ ...formData, primaryCtaLink: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="e.g. /sourcing or /quote"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-slate-800 block">Secondary Button (Optional)</span>
                  <div>
                    <label className="text-[11px] text-slate-500">Button Text</label>
                    <input
                      type="text"
                      value={formData.secondaryCtaText || ''}
                      onChange={(e) => setFormData({ ...formData, secondaryCtaText: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                      placeholder="e.g. Ship for Me"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Destination Link</label>
                    <input
                      type="text"
                      value={formData.secondaryCtaLink || ''}
                      onChange={(e) => setFormData({ ...formData, secondaryCtaLink: e.target.value })}
                      className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono"
                      placeholder="e.g. /quote"
                    />
                  </div>
                </div>
              </div>

              {/* Image URL & Alt */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Right Image URL</label>
                    <input
                      type="url"
                      required
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Image Alt Text</label>
                    <input
                      type="text"
                      required
                      value={formData.imageAlt}
                      onChange={(e) => setFormData({ ...formData, imageAlt: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                      placeholder="GoShipping Freight Cargo"
                    />
                  </div>
                </div>
                {formData.imageUrl && (
                  <div className="w-32 h-20 rounded border border-slate-200 overflow-hidden bg-slate-100">
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Features (Checkpoints) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Bullet Features / Checkpoints (Bottom Icons)</span>
                  <button
                    type="button"
                    onClick={() => setFeatureInputs([...featureInputs, ''])}
                    className="text-[#EA1D2C] text-[11px] font-bold hover:underline cursor-pointer"
                  >
                    + Add Bullet
                  </button>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {featureInputs.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => {
                          const updated = [...featureInputs];
                          updated[fIdx] = e.target.value;
                          setFeatureInputs(updated);
                        }}
                        className="flex-1 h-8 px-2.5 rounded border border-slate-300 text-xs"
                        placeholder={`Feature #${fIdx + 1}`}
                      />
                      {featureInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFeatureInputs(featureInputs.filter((_, idx) => idx !== fIdx))}
                          className="w-7 h-8 rounded border border-slate-200 text-slate-500 hover:text-red-600 text-xs flex items-center justify-center cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bannerIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#EA1D2C] rounded border-slate-300 focus:ring-[#EA1D2C]"
                />
                <label htmlFor="bannerIsActive" className="font-semibold text-slate-800 cursor-pointer">
                  Publish &amp; display this banner slide on homepage
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-[#EA1D2C] text-white font-bold hover:bg-[#D41523] shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
