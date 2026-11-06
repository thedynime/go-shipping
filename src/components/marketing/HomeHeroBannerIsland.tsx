import React, { useState, useEffect } from 'react';
import { HOME_BANNERS, type HeroBanner } from '../../data/homeBanners';

export default function HomeHeroBannerIsland({ initialBanners }: { initialBanners?: HeroBanner[] }) {
  const [banners, setBanners] = useState<HeroBanner[]>(
    initialBanners && initialBanners.length > 0 ? initialBanners : HOME_BANNERS
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetch('/api/banners')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.banners) && data.banners.length > 0) {
          setBanners(data.banners);
        }
      })
      .catch(() => {});
  }, []);

  const safeBanners = banners.length > 0 ? banners : HOME_BANNERS;
  const current = safeBanners[currentIndex % safeBanners.length] || safeBanners[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % safeBanners.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + safeBanners.length) % safeBanners.length);
  };

  return (
    <div className="relative bg-white border-b border-slate-200 overflow-hidden font-['Inter',sans-serif]">
      {/* Banner Indicator Bar on Top if multiple banners */}
      {safeBanners.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA1D2C] animate-pulse" />
            <span className="font-mono font-bold text-slate-700 text-[11px] uppercase tracking-wider hidden sm:inline">
              {current.badge}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {safeBanners.map((b, idx) => (
              <button
                key={b.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 transition-all rounded-full cursor-pointer ${
                  idx === currentIndex % safeBanners.length ? 'w-6 bg-[#EA1D2C]' : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handlePrev}
                className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center text-xs transition-none cursor-pointer"
                title="Previous Banner"
              >
                ‹
              </button>
              <button
                onClick={handleNext}
                className="w-6 h-6 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center text-xs transition-none cursor-pointer"
                title="Next Banner"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Banner Body inspired by img_01.png */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Bengali High-Converting Copy & Actions */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            
            {/* Category / Service Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#EA1D2C] text-xs font-bold font-mono tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C] animate-pulse" />
              <span>{current.badge}</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-extrabold text-[#11181E] tracking-tight leading-[1.2] font-['Noto_Sans_Bengali','Manrope',sans-serif]">
                {current.headlineBengali}
              </h1>
              <p className="text-base sm:text-xl font-bold text-[#EA1D2C] tracking-tight leading-snug font-['Noto_Sans_Bengali','Manrope',sans-serif]">
                {current.headlineAccent}
              </p>
            </div>

            {/* Subtitle Description */}
            <p className="text-xs sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl font-['Noto_Sans_Bengali','Inter',sans-serif]">
              {current.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
              <a
                href={current.primaryCtaLink}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-lg bg-[#EA1D2C] text-white text-xs sm:text-sm font-bold hover:bg-[#D41523] active:bg-[#B91C1C] transition-colors shadow-md shadow-red-500/20 cursor-pointer min-h-[44px] font-['Noto_Sans_Bengali','Manrope',sans-serif]"
              >
                <span>{current.primaryCtaText}</span>
              </a>

              {current.secondaryCtaText && current.secondaryCtaLink && (
                <a
                  href={current.secondaryCtaLink}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-xs cursor-pointer min-h-[44px] font-['Noto_Sans_Bengali','Manrope',sans-serif]"
                >
                  <span>{current.secondaryCtaText}</span>
                </a>
              )}
            </div>

            {/* 3 Checkpoint Badges like img_01.png */}
            <div className="pt-4 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-700">
                {(current.features || []).map((feat) => (
                  <span key={feat} className="inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#EA1D2C] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{feat}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Composition with Market/Cargo Frame & Fast-Track Box */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xl group">
              <div className="aspect-[4/3] w-full relative overflow-hidden">
                <img
                  src={current.imageUrl}
                  alt={current.imageAlt}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

                {/* China Flag Badge Overlay */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-1.5 rounded-full shadow-md flex items-center gap-2">
                  <span className="w-4 h-3 rounded-xs bg-[#DE2910] relative flex items-center justify-center text-[8px] text-[#FFDE00] font-black leading-none">
                    ★
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 font-mono">CHINA HUB</span>
                </div>

                {/* Stencil Label */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                    {current.taglineSmall || 'Guangzhou · Yiwu · Shenzhen ⇄ Dhaka'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5 font-['Manrope']">
                    GoShipping Express Cargo
                  </div>
                </div>
              </div>
            </div>

            {/* Fast Track Floating Card */}
            <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 shadow-md">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EA1D2C] animate-pulse" />
                  <span>দ্রুত পার্সেল ট্র্যাকিং (Live Track)</span>
                </span>
                <a href="/tracking" className="text-[#EA1D2C] text-[11px] hover:underline font-semibold">
                  Full Portal →
                </a>
              </div>
              <form action="/tracking" method="GET" className="flex gap-2">
                <input
                  type="text"
                  name="code"
                  placeholder="GOSH-XXXX ট্র্যাকিং কোড বা ফোন..."
                  className="flex-1 h-9 px-3 rounded-md border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA1D2C]"
                  required
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md bg-[#EA1D2C] text-white font-bold text-xs hover:bg-[#D41523] transition-none cursor-pointer shrink-0"
                >
                  Track
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
