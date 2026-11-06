import React, { useState, useEffect } from 'react';

export interface TestimonialItem {
  id: string;
  clientName: string;
  roleOrCompany: string;
  location: string;
  quote: string;
  rating: number;
  initial: string;
  tag?: string;
  date?: string;
  avatarUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

const DEFAULT_TESTIMONIAL: Omit<TestimonialItem, 'id'> = {
  clientName: 'Tanvir Ahmed',
  roleOrCompany: 'Managing Director, Horizon Apparels Ltd',
  location: 'Dhaka, Bangladesh',
  quote: 'চীনের গুয়াংজু ওয়্যারহাউসে পণ্য পৌঁছে দেওয়ার ৭ দিনের মধ্যেই এয়ারে ঢাকায় হাতে পেয়েছি। কাস্টমস হ্যান্ডলিং একদম নির্ভরযোগ্য ছিল।',
  rating: 5,
  initial: 'T',
  tag: 'Air Cargo Importer',
  date: 'November 2026',
  avatarUrl: '',
  displayOrder: 0,
  isActive: true
};

export default function TestimonialsManager({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestimonialItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Omit<TestimonialItem, 'id'>>(DEFAULT_TESTIMONIAL);

  const fetchTestimonials = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/testimonials');
      const data = await res.json();
      if (data.success && Array.isArray(data.testimonials)) {
        setTestimonials(data.testimonials);
      }
    } catch {
      showToast('Failed to load testimonials', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      ...DEFAULT_TESTIMONIAL,
      displayOrder: testimonials.length
    });
    setModalOpen(true);
  };

  const openEditModal = (item: TestimonialItem) => {
    setEditingItem(item);
    setFormData({
      clientName: item.clientName,
      roleOrCompany: item.roleOrCompany,
      location: item.location || '',
      quote: item.quote,
      rating: item.rating || 5,
      initial: item.initial || (item.clientName ? item.clientName.charAt(0).toUpperCase() : 'C'),
      tag: item.tag || '',
      date: item.date || '',
      avatarUrl: item.avatarUrl || '',
      displayOrder: item.displayOrder,
      isActive: item.isActive
    });
    setModalOpen(true);
  };

  const handleToggleActive = async (item: TestimonialItem) => {
    const updatedStatus = !item.isActive;
    try {
      const res = await fetch(`/api/admin/testimonials/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus })
      });
      if (res.ok) {
        setTestimonials((prev) =>
          prev.map((t) => (t.id === item.id ? { ...t, isActive: updatedStatus } : t))
        );
        showToast(`Review ${updatedStatus ? 'published' : 'hidden'} successfully!`, 'success');
      } else {
        throw new Error('Update failed');
      }
    } catch {
      showToast('Error updating review status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client review? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTestimonials((prev) => prev.filter((t) => t.id !== id));
        showToast('Client review deleted successfully', 'success');
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      showToast('Error deleting client review', 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newList = [...testimonials];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;

    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    setTestimonials(newList);

    const orderedIds = newList.map((t) => t.id);
    try {
      await fetch('/api/admin/testimonials/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds })
      });
      showToast('Review display order updated!', 'info');
    } catch {
      showToast('Failed to save reordering', 'error');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const initial = formData.initial?.trim() || (formData.clientName.trim().charAt(0).toUpperCase() || 'C');

    const payload = {
      ...formData,
      initial,
      rating: Number(formData.rating) || 5
    };

    try {
      if (editingItem) {
        // Update
        const res = await fetch(`/api/admin/testimonials/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update review');
        showToast('Client review updated successfully!', 'success');
      } else {
        // Create
        const res = await fetch('/api/admin/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create review');
        showToast('New client review added successfully!', 'success');
      }
      setModalOpen(false);
      fetchTestimonials();
    } catch (err: any) {
      showToast(err.message || 'Error saving review', 'error');
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
                Verified Client Reviews &amp; Testimonials
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {testimonials.length} Total Reviews
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Manage client feedback, ratings, and quotes displayed in the homepage "What Our Clients Say" section.
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
            <span>+ Add Client Review</span>
          </button>
        </div>
      </div>

      {/* Testimonials Grid / List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          Loading client reviews...
        </div>
      ) : testimonials.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
          No client reviews added yet. Click "+ Add Client Review" above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, index) => (
            <div
              key={t.id}
              className={`p-6 rounded-xl bg-white border flex flex-col justify-between space-y-4 transition-all ${
                t.isActive ? 'border-slate-200 shadow-2xs' : 'border-slate-200/60 bg-slate-50/50 opacity-75'
              }`}
            >
              <div className="space-y-3">
                {/* Header row: stars & active badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: t.rating || 5 }).map((_, rIdx) => (
                      <svg key={rIdx} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {t.isActive ? 'Live' : 'Hidden'}
                  </span>
                </div>

                {/* Quote */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal italic">
                  “{t.quote}”
                </p>
              </div>

              {/* Author Info */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {t.avatarUrl ? (
                      <img
                        src={t.avatarUrl}
                        alt={t.clientName}
                        className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-[#EA1D2C] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {t.initial || (t.clientName ? t.clientName.charAt(0).toUpperCase() : 'C')}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-900">{t.clientName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[170px]">{t.roleOrCompany}</div>
                    </div>
                  </div>

                  {t.tag && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                      {t.tag}
                    </span>
                  )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] cursor-pointer"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === testimonials.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] cursor-pointer"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(t)}
                      className="px-2 py-1 rounded text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      {t.isActive ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer transition-none"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="px-2 py-1 rounded hover:bg-red-50 text-red-600 text-[11px] font-semibold cursor-pointer transition-none"
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
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 font-['Manrope']">
                {editingItem ? 'Edit Client Review' : 'Add New Client Review'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                title="Close dialog"
              >
                <svg className="w-4 h-4 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 pt-4 text-xs">
              {/* Client Name & Initial */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 space-y-1">
                  <label className="font-bold text-slate-700">Client Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                    placeholder="e.g. Tanvir Ahmed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Avatar Initial</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.initial}
                    onChange={(e) => setFormData({ ...formData, initial: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-center font-bold text-xs uppercase"
                    placeholder="T"
                  />
                </div>
              </div>

              {/* Role & Company */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Role / Designation / Company</label>
                <input
                  type="text"
                  required
                  value={formData.roleOrCompany}
                  onChange={(e) => setFormData({ ...formData, roleOrCompany: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                  placeholder="e.g. Managing Director, Horizon Apparels Ltd"
                />
              </div>

              {/* Location & Tag & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="Savar EPZ, Dhaka"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tag / Category</label>
                  <input
                    type="text"
                    value={formData.tag || ''}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="Air Cargo Importer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Date Text</label>
                  <input
                    type="text"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs"
                    placeholder="October 2026"
                  />
                </div>
              </div>

              {/* Star Rating & Avatar URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Star Rating</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  >
                    <option value={5}>★★★★★ (5 Stars - Excellent)</option>
                    <option value={4}>★★★★☆ (4 Stars - Very Good)</option>
                    <option value={3}>★★★☆☆ (3 Stars - Good)</option>
                    <option value={2}>★★☆☆☆ (2 Stars - Fair)</option>
                    <option value={1}>★☆☆☆☆ (1 Star - Poor)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Avatar Photo URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.avatarUrl || ''}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Review Quote Text */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Client Review / Testimonial Quote</label>
                <textarea
                  required
                  rows={4}
                  value={formData.quote}
                  onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-[#EA1D2C] focus:outline-none"
                  placeholder="Enter customer feedback in Bengali or English..."
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="testimonialIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#EA1D2C] rounded border-slate-300 focus:ring-[#EA1D2C]"
                />
                <label htmlFor="testimonialIsActive" className="font-semibold text-slate-800 cursor-pointer">
                  Display this review publicly on homepage
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
                  {saving ? 'Saving...' : editingItem ? 'Update Review' : 'Add Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
