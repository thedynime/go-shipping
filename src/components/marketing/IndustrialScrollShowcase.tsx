import React, { useState, useEffect, useRef } from 'react';

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const SERVICES: ServiceItem[] = [
  {
    id: 'air',
    title: 'AIR SHIPMENT',
    description:
      'Fast and reliable air cargo service from China to Bangladesh. Ideal for urgent shipments and time-sensitive products (7–14 days approx.).',
    icon: 'plane'
  },
  {
    id: 'ocean',
    title: 'SEA SHIPMENT',
    description:
      'Affordable and efficient sea freight for larger shipments and bulk commercial cargo from China to Bangladesh (35–45 days approx.).',
    icon: 'ship'
  },
  {
    id: 'door-to-door',
    title: 'DOOR-TO-DOOR DELIVERY',
    description:
      'From China warehouse directly to your doorstep across all 64 districts in Bangladesh with complete coordination.',
    icon: 'truck'
  },
  {
    id: 'customs',
    title: 'CUSTOMS CLEARANCE SUPPORT',
    description:
      'In-house customs clearance support, tariff HS classification, and export/import compliance with zero surprises.',
    icon: 'scales'
  },
  {
    id: 'warehousing',
    title: 'CHINA WAREHOUSE SUPPORT',
    description:
      'Receiving, consolidation, and inspection hubs in Guangzhou, Yiwu, and Shenzhen before dispatch to Bangladesh.',
    icon: 'warehouse'
  },
  {
    id: 'support',
    title: 'DEDICATED CUSTOMER SUPPORT',
    description:
      'A responsive team ready to help at every shipping stage with transparent WhatsApp and phone communication.',
    icon: 'crane'
  }
];

const getServiceHref = (id: string) => {
  switch (id) {
    case 'air':
      return '/services/air-shipment';
    case 'ocean':
      return '/services/sea-shipment';
    case 'door-to-door':
      return '/services/door-to-door';
    case 'customs':
      return '/services/customs-clearance';
    case 'warehousing':
      return '/services/china-warehouse';
    case 'support':
      return '/contact';
    default:
      return '/services';
  }
};

function renderServiceIcon(icon: string, className = 'w-7 h-7') {
  if (icon === 'plane') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
      </svg>
    );
  }
  if (icon === 'ship') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
        <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
        <line x1="12" y1="1" x2="12" y2="5" />
      </svg>
    );
  }
  if (icon === 'scales') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
        <path d="M7 21h10" />
        <path d="M12 3v18" />
        <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
      </svg>
    );
  }
  if (icon === 'warehouse') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
        <path d="M6 18h12" />
        <path d="M6 14h12" />
      </svg>
    );
  }
  if (icon === 'crane') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 22h20" />
        <path d="M6 22V2l10 5" />
        <path d="m16 7 4 2v5l-4-2" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

export const IndustrialScrollShowcase: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Monitor scroll progress smoothly
  useEffect(() => {
    const handleScroll = () => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const totalDist = el.offsetHeight - window.innerHeight;
      if (totalDist <= 0) return;

      const current = -rect.top;
      const rawProgress = current / totalDist;
      const clamped = Math.min(Math.max(rawProgress, 0), 1);
      setScrollProgress(clamped);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // SCENE PROGRESSION THRESHOLDS (0.0 to 1.0):
  // Scene 1: Terminal Yard (0.00 to 0.16)
  // Scene 2: Split Horizon & Freight Disciplines (0.16 to 0.32)
  // Scene 3: Horizontal Services Stream (0.32 to 0.48)
  // Scene 4: Aerial 90-Degree Highway Bend (0.48 to 0.60)
  // Scene 5: Central Vertical Highway & Assurance (0.60 to 0.78)
  // Scene 6: Open Ocean Vessel Cruising & 4 Pillars (0.78 to 0.90)
  // Scene 7: Orbital Deep Ocean Resolution (0.90 to 1.00)
  const isScene1 = scrollProgress < 0.16;
  const isScene2 = scrollProgress >= 0.16 && scrollProgress < 0.32;
  const isScene3 = scrollProgress >= 0.32 && scrollProgress < 0.48;
  const isScene23 = isScene2 || isScene3;
  const isScene4 = scrollProgress >= 0.48 && scrollProgress < 0.60;
  const isScene5 = scrollProgress >= 0.60 && scrollProgress < 0.78;
  const isOcean = scrollProgress >= 0.78;
  const isScene6 = scrollProgress >= 0.78 && scrollProgress < 0.90;
  const isScene7 = scrollProgress >= 0.90;

  // Sub-progressions
  const p1 = Math.min(Math.max(scrollProgress / 0.16, 0), 1);
  const p3 = isScene3 ? (scrollProgress - 0.32) / 0.16 : scrollProgress >= 0.48 ? 1 : 0;
  const p23 = isScene23 ? (scrollProgress - 0.16) / 0.32 : scrollProgress >= 0.48 ? 1 : 0;
  const p4 = isScene4 ? (scrollProgress - 0.48) / 0.12 : scrollProgress >= 0.60 ? 1 : 0;
  const p5 = isScene5 ? (scrollProgress - 0.60) / 0.18 : scrollProgress >= 0.78 ? 1 : 0;
  const pOcean = isOcean ? (scrollProgress - 0.78) / 0.22 : 0;

  // Parametric geometry for Scene 4 aerial bend:
  // Starts on horizontal lane (X=15%, Y=30%), curves smoothly 90-deg downward to center (X=50%), exits straight down center
  let truckX = 15;
  let truckY = 30;
  let truckHeading = 0; // 0 deg = east / right (forward into lane)

  if (p4 < 0.25) {
    // Phase 1: Straight horizontal entry along lane
    const sub = p4 / 0.25;
    truckX = 15 + sub * 18.3; // 15% -> 33.3%
    truckY = 30;
    truckHeading = 0;
  } else if (p4 < 0.75) {
    // Phase 2: Smooth 90-degree curve
    const sub = (p4 - 0.25) / 0.50;
    const rad = sub * (Math.PI / 2);
    truckX = 33.3 + Math.sin(rad) * 16.7; // 33.3% -> 50.0%
    truckY = 30.0 + (1.0 - Math.cos(rad)) * 26.7; // 30.0% -> 56.7%
    truckHeading = sub * 90; // 0 deg -> 90 deg
  } else {
    // Phase 3: Straight vertical exit down center
    const sub = (p4 - 0.75) / 0.25;
    truckX = 50.0;
    truckY = 56.7 + sub * 28.3; // 56.7% -> 85.0%
    truckHeading = 90;
  }

  return (
    <div id="industrial-services" className="relative w-full">
      {/* ========================================================================= */}
      {/* 01. RESPONSIVE MOBILE & TABLET SERVICES VIEW (lg:hidden)                 */}
      {/* High-Performance, Fully Interactive, Instant-Tap Navigation Cards        */}
      {/* ========================================================================= */}
      <section className="lg:hidden py-14 sm:py-20 bg-[#11181E] text-white px-4 sm:px-6 border-b border-slate-800 font-['Inter',sans-serif]">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-[#EA1D2C] uppercase tracking-wider block font-mono">
              /OUR FREIGHT SERVICES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-['Manrope'] text-white tracking-tight uppercase leading-tight">
              EVERYTHING YOUR FREIGHT NEEDS.<br />
              <span className="text-slate-400">UNDER ONE GROUP.</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              From fast air cargo to bulk ocean containers, customs clearance to final doorstep delivery across all 64 districts in Bangladesh — complete supply chain coverage with direct door delivery.
            </p>
          </div>

          {/* 6 Clickable Service Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SERVICES.map((s) => {
              const href = getServiceHref(s.id);
              return (
                <a
                  key={s.id}
                  href={href}
                  className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-[#EA1D2C] active:scale-[0.99] transition-all flex flex-col justify-between space-y-4 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center group-hover:bg-[#EA1D2C] group-hover:text-white transition-colors">
                      {renderServiceIcon(s.icon, 'w-6 h-6')}
                    </div>
                    <span className="text-xs font-bold text-[#EA1D2C] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      <span>Details</span>
                      <span>→</span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-extrabold text-white font-['Manrope'] tracking-tight">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-normal">
                      {s.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] font-semibold text-slate-300 flex items-center gap-1 group-hover:text-white">
                    <span>View Service Rates &amp; Delivery Info</span>
                  </div>
                </a>
              );
            })}
          </div>

          {/* 4 Pillars Summary */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
              OUR 4 CORE FREIGHT PILLARS
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]"></span>
                <span>China Warehouse Hubs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]"></span>
                <span>In-House Customs Clearance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]"></span>
                <span>Door-to-Door Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EA1D2C]"></span>
                <span>24/7 Dedicated Support</span>
              </div>
            </div>
          </div>

          {/* Quick CTA Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href="/quote"
              className="flex-1 h-11 px-5 rounded-lg bg-[#EA1D2C] hover:bg-[#D41523] active:bg-[#B7101C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span>Get a Shipping Quote</span>
              <span>→</span>
            </a>
            <a
              href="https://wa.me/8801797252627?text=Hello%20Go%20Shipping%2C%20I%20would%20like%20a%20shipping%20quote."
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-11 px-5 rounded-lg border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-900/60 transition-colors cursor-pointer"
            >
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02. DESKTOP 650vh CINEMATIC SCROLL VIEW (hidden lg:block)                 */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="hidden lg:block relative w-full h-[650vh] bg-white font-['Inter',sans-serif] select-none"
      >
      {/* Sticky Cinematic Fullscreen Viewport (100% Clean Fullscreen) */}
      <div
        className={`sticky top-0 h-screen w-full overflow-hidden transition-colors duration-500 ${
          isOcean ? 'bg-[#071838]' : 'bg-white'
        }`}
      >
        {/* ================================================================= */}
        {/* MAIN CINEMATIC STAGE (Sequential Logistics Journey)               */}
        {/* ================================================================= */}
        <div className="relative z-10 w-full h-full overflow-hidden flex items-center justify-center">
          
          {/* --------------------------------------------------------------- */}
          {/* SCENE 1: CONTAINER TERMINAL YARD (True 4K UHD Machinery)        */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
              isScene1 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Pure White Canvas with Slim Ground Tarmac Band at Bottom */}
            <div className="absolute inset-0 bg-white">
              <div className="absolute bottom-0 left-0 right-0 h-20 sm:h-24 bg-[#11181E] border-t border-slate-800">
                <div
                  className="w-full h-full opacity-15"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, #FFFFFF 0px, #FFFFFF 20px, transparent 20px, transparent 70px)',
                    backgroundSize: '70px 100%'
                  }}
                ></div>
              </div>
            </div>

            {/* Containers on Right (Ground level Blue & Orange ready to receive container - 4K UHD) */}
            <div className="absolute bottom-20 sm:bottom-24 right-6 sm:right-12 md:right-16 z-20">
              <img
                src="/assets/goshipping-machinery/hd/containers_ground_4k.png"
                alt="Stacked Blue and Orange Containers in Terminal Yard"
                className="h-[36vh] sm:h-[42vh] md:h-[46vh] max-h-[340px] w-auto object-contain drop-shadow-xl"
              />
            </div>

            {/* Reach Stacker Hoisting White Container (Heroic 4K UHD Scale, drives & lands on stack) */}
            <div
              className="absolute bottom-20 sm:bottom-24 z-30 will-change-transform"
              style={{
                left: `calc(1vw + ${p1 * 17}vw)`,
                transform: `translateY(calc(-40px + ${p1 * 40}px))`
              }}
            >
              <img
                src="/assets/goshipping-machinery/hd/ref_crane_lifted.png"
                alt="Reach Stacker Hoisting and Placing White 40ft Container"
                className="h-[60vh] sm:h-[66vh] md:h-[72vh] max-h-[560px] w-auto object-contain drop-shadow-2xl"
              />
            </div>

            {/* Minimalist Circular Scroll Prompt Ring matching video cursor */}
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
              <div
                className="w-10 h-10 rounded-md border border-slate-300 flex items-center justify-center bg-white/90"
                style={{
                  transform: `rotate(${scrollProgress * 720}deg)`
                }}
              >
                <span className="text-xs text-slate-700 font-bold">↓</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SCENE 2 & 3: SPLIT HORIZON TRUCK + HORIZONTAL SERVICES (4K)     */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`absolute inset-0 flex flex-col transition-opacity duration-500 pointer-events-none ${
              isScene23 ? 'opacity-100 pointer-events-auto' : 'opacity-0'
            }`}
          >
            {/* TOP HALF: PURE WHITE WITH ROLLING TRUCK & GIANT BACKGROUND TEXT */}
            <div className="relative h-[42vh] w-full bg-white overflow-hidden flex items-end">
              {/* Giant Faint Display Typography: "OUR SERVICES" */}
              <div
                className="absolute top-2 left-0 whitespace-nowrap text-[16vw] font-black text-slate-100 leading-none tracking-tighter will-change-transform pointer-events-none select-none"
                style={{
                  transform: `translateX(calc(12vw - ${p23 * 100}vw))`
                }}
              >
                OUR SERVICES
              </div>

              {/* Moving Semi Truck Sits Directly on the Horizon Line (True 4K UHD Studio Asset) */}
              <div className="relative z-20 w-full flex justify-center">
                <div
                  className="relative will-change-transform flex items-end"
                  style={{
                    transform: `translateX(${Math.sin(p23 * 8) * 6}px)`
                  }}
                >
                  <img
                    src="/assets/goshipping-machinery/hd/ref_truck_container.png"
                    alt="Heavy Freight Semi Truck with White Container Driving on Horizon"
                    className="h-[22vh] sm:h-[25vh] max-h-[190px] w-auto object-contain block select-none drop-shadow-md"
                  />
                </div>
              </div>
            </div>

            {/* HORIZONTAL CRISP HORIZON LINE */}
            <div className="w-full h-[1px] bg-[#11181E]"></div>

            {/* BOTTOM HALF: PITCH MIDNIGHT (#11181E) */}
            <div className="relative flex-1 w-full bg-[#11181E] text-white p-6 sm:p-14 flex flex-col justify-between overflow-hidden border-t border-white/10">
              
              {/* Subphase 2: "EVERYTHING YOUR FREIGHT NEEDS. UNDER ONE GROUP." */}
              <div
                className={`transition-opacity duration-300 ${
                  isScene2 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start max-w-7xl mx-auto">
                  <div className="md:col-span-7">
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-black font-['Manrope'] text-white tracking-tight leading-[1.04] uppercase">
                      EVERYTHING YOUR<br />
                      FREIGHT NEEDS.<br />
                      <span className="text-[#4B5563]">UNDER ONE GROUP.</span>
                    </h2>
                  </div>
                  <div className="md:col-span-5 space-y-4 text-xs sm:text-sm text-slate-300 font-normal leading-relaxed pt-2">
                    <p>
                      From air to sea, from customs clearance to final delivery, we bring decades of expertise across every freight discipline.
                    </p>
                    <p>
                      Our integrated service network means one partner, one point of contact, and total visibility from origin to destination.
                    </p>
                  </div>
                </div>
              </div>

              {/* Subphase 3: Horizontal Services Ribbon (Minimalist Icons & Titles) */}
              <div
                className={`absolute inset-0 px-6 sm:px-14 flex items-center transition-opacity duration-300 ${
                  isScene3 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div
                  className="flex items-start gap-14 sm:gap-24 whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translateX(calc(52vw - ${p3 * 165}vw))`
                  }}
                >
                  {SERVICES.map((s) => {
                    return (
                      <a
                        key={s.id}
                        href={getServiceHref(s.id)}
                        className="w-[300px] sm:w-[380px] shrink-0 space-y-3.5 block pointer-events-auto cursor-pointer group hover:opacity-95"
                      >
                        {/* Minimalist White Vector Icon */}
                        <div className="w-10 h-10 flex items-center justify-center text-white mb-2 group-hover:text-[#EA1D2C] transition-colors">
                          {renderServiceIcon(s.icon)}
                        </div>

                        {/* Title in bold white uppercase */}
                        <h3 className="text-xl sm:text-2xl font-black font-['Manrope'] text-white tracking-tight uppercase group-hover:text-[#EA1D2C] transition-colors">
                          {s.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal whitespace-normal">
                          {s.description}
                        </p>

                        <div className="pt-2 text-xs font-bold text-[#EA1D2C] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Explore Service Details</span>
                          <span>→</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Center Pill: "OUR SERVICES" */}
              <div className="w-full flex justify-center pt-4">
                <span className="px-4 py-1.5 rounded-md border border-white/20 text-[10px] font-mono tracking-wider text-white/80">
                  OUR SERVICES
                </span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SCENE 4: AERIAL TOP-DOWN 90-DEGREE HIGHWAY BEND (4K VECTOR)     */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`absolute inset-0 bg-white transition-opacity duration-500 pointer-events-none ${
              isScene4 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Resolution-Independent High-Definition Vector SVG Road & City Canvas */}
            <svg
              className="absolute inset-0 w-full h-full select-none"
              viewBox="0 0 1440 900"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Pattern 1: Urban Master Plan Paving Grid */}
                <pattern id="urbanGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
                </pattern>

                {/* Pattern 2: Corrugated Metal Roof Ribs */}
                <pattern id="roofRibs" width="8" height="8" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#94A3B8" strokeWidth="1.5" opacity="0.4" />
                </pattern>

                {/* Pattern 3: Solar Panels Grid */}
                <pattern id="solarGrid" width="12" height="8" patternUnits="userSpaceOnUse">
                  <rect width="12" height="8" fill="#1E293B" stroke="#38BDF8" strokeWidth="0.5" />
                </pattern>
              </defs>

              {/* 1. BASE URBAN MASTER PLAN GROUND */}
              <rect width="1440" height="900" fill="#F8FAFC" />
              <rect width="1440" height="900" fill="url(#urbanGrid)" />

              {/* 2. CONNECTING CITY STREETS & SERVICE ALLEYS */}
              {/* Top Alleyway */}
              <rect x="210" y="0" width="40" height="169" fill="#334155" />
              <line x1="230" y1="0" x2="230" y2="160" stroke="#FFFFFF" strokeDasharray="6 6" strokeWidth="1.5" />
              <g fill="#FFFFFF">
                <rect x="212" y="162" width="36" height="2" />
                <rect x="212" y="166" width="36" height="2" />
              </g>

              {/* Right East Alleyway */}
              <rect x="821" y="420" width="180" height="40" fill="#334155" />
              <line x1="821" y1="440" x2="1000" y2="440" stroke="#FFFFFF" strokeDasharray="6 6" strokeWidth="1.5" />

              {/* Inner South Alleyway */}
              <rect x="230" y="371" width="35" height="100" fill="#334155" />
              <line x1="247.5" y1="371" x2="247.5" y2="470" stroke="#FFFFFF" strokeDasharray="6 6" strokeWidth="1.5" />

              {/* 3. SIDEWALKS (PAVEMENTS ALONG HIGHWAY) */}
              {/* Outer Sidewalk */}
              <path
                d="M 0,169 L 480,169 A 341,341 0 0 1 821,510 L 821,900 L 795,900 L 795,510 A 315,315 0 0 0 480,195 L 0,195 Z"
                fill="#E2E8F0"
                stroke="#CBD5E1"
                strokeWidth="1"
              />
              <path
                d="M 0,169 L 480,169 A 341,341 0 0 1 821,510 L 821,900"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />

              {/* Inner Sidewalk */}
              <path
                d="M 0,345 L 480,345 A 165,165 0 0 1 645,510 L 645,900 L 619,900 L 619,510 A 139,139 0 0 0 480,371 L 0,371 Z"
                fill="#E2E8F0"
                stroke="#CBD5E1"
                strokeWidth="1"
              />
              <path
                d="M 0,371 L 480,371 A 139,139 0 0 1 619,510 L 619,900"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />

              {/* 4. SOLID ASPHALT ROAD SURFACE */}
              <path
                d="M 0,195 L 480,195 A 315,315 0 0 1 795,510 L 795,900 L 645,900 L 645,510 A 165,165 0 0 0 480,345 L 0,345 Z"
                fill="#11181E"
              />
              <path
                d="M 0,195 L 480,195 A 315,315 0 0 1 795,510 L 795,900"
                fill="none"
                stroke="#334155"
                strokeWidth="2"
                opacity="0.6"
              />
              <path
                d="M 0,345 L 480,345 A 165,165 0 0 1 645,510 L 645,900"
                fill="none"
                stroke="#334155"
                strokeWidth="2"
                opacity="0.6"
              />
              <path
                d="M 0,270 L 480,270 A 240,240 0 0 1 720,510 L 720,900"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="4"
                strokeDasharray="20 20"
                opacity="0.85"
              />

              {/* 5. MINIMALIST ARCHITECTURAL LANDMARKS (CLEAN, SPACIOUS & PROFESSIONAL) */}
              
              {/* TOP-LEFT ZONE: Cargo Terminal 01 */}
              <g id="bldg-terminal-a">
                <rect x="45" y="25" width="210" height="105" rx="3" fill="#CBD5E1" />
                <rect x="40" y="20" width="210" height="105" rx="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
                <rect x="55" y="35" width="85" height="42" rx="2" fill="url(#solarGrid)" stroke="#475569" strokeWidth="1" />
                <rect x="155" y="35" width="75" height="25" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" />
                <text x="55" y="102" fontFamily="monospace" fontSize="9" fontWeight="bold" fill="#64748B" letterSpacing="1">
                  CARGO TERMINAL 01
                </text>
              </g>

              {/* TOP-RIGHT ZONE: GoShipping Headquarters Tower */}
              <g id="bldg-tower-hq">
                <rect x="1045" y="35" width="230" height="165" rx="4" fill="#CBD5E1" />
                <rect x="1040" y="30" width="230" height="165" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="2" />
                <circle cx="1110" cy="85" r="30" fill="#1E293B" stroke="#EA1D2C" strokeWidth="2" />
                <circle cx="1110" cy="85" r="22" fill="none" stroke="#FFFFFF" strokeDasharray="4 4" strokeWidth="1" />
                <text x="1103" y="93" fontFamily="sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">H</text>
                <rect x="1165" y="45" width="85" height="55" fill="#1E293B" stroke="#475569" strokeWidth="1" />
                <rect x="1175" y="55" width="65" height="35" fill="#38BDF8" opacity="0.2" stroke="#38BDF8" strokeWidth="1" />
                <text x="1075" y="152" fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#94A3B8" letterSpacing="1.5">
                  GOSHIPPING TOWER
                </text>
              </g>

              {/* EAST ZONE: Intermodal Container Depot (Clean & Minimal Stacking Area) */}
              <g id="container-yard">
                <rect x="960" y="540" width="340" height="180" rx="4" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
                {/* 3 Intermodal Containers (Red, Blue, Dark Slate) */}
                <rect x="990" y="568" width="115" height="26" rx="2" fill="#EA1D2C" stroke="#991B1B" strokeWidth="1" />
                <line x1="1047" y1="568" x2="1047" y2="594" stroke="#F87171" strokeWidth="1" />

                <rect x="990" y="606" width="115" height="26" rx="2" fill="#2563EB" stroke="#1E40AF" strokeWidth="1" />
                <line x1="1047" y1="606" x2="1047" y2="632" stroke="#60A5FA" strokeWidth="1" />

                <rect x="990" y="644" width="115" height="26" rx="2" fill="#1E293B" stroke="#0F172A" strokeWidth="1" />
                <line x1="1047" y1="644" x2="1047" y2="670" stroke="#475569" strokeWidth="1" />

                {/* Staging Crane Stacker */}
                <rect x="1145" y="590" width="55" height="32" rx="3" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
                <circle cx="1172" cy="606" r="5" fill="#1E293B" />

                <text x="990" y="700" fontFamily="monospace" fontSize="9" fontWeight="bold" fill="#64748B" letterSpacing="1">
                  INTERMODAL CONTAINER DEPOT
                </text>
              </g>

              {/* INNER ZONE: Signature GoShipping Logistics Hub (Spacious & Clean) */}
              <g id="bldg-inner-hub">
                <rect x="85" y="525" width="380" height="250" rx="4" fill="#CBD5E1" />
                <rect x="80" y="520" width="380" height="250" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2" />
                <rect x="100" y="540" width="340" height="120" fill="url(#roofRibs)" stroke="#CBD5E1" strokeWidth="1" />
                
                {/* Modern Helipad / Brand Seal */}
                <circle cx="160" cy="715" r="28" fill="#11181E" stroke="#EA1D2C" strokeWidth="2" />
                <circle cx="160" cy="715" r="20" fill="none" stroke="#FFFFFF" strokeDasharray="4 4" strokeWidth="1" />
                <text x="153" y="723" fontFamily="sans-serif" fontWeight="900" fontSize="20" fill="#FFFFFF">G</text>

                {/* Office Wing */}
                <rect x="215" y="690" width="205" height="50" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
                <text x="230" y="718" fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#1E293B" letterSpacing="1.5">
                  GOSHIPPING CARGO HUB
                </text>
                <text x="230" y="731" fontFamily="sans-serif" fontSize="8" fill="#64748B">
                  CENTRAL DISTRIBUTION &amp; CUSTOMS
                </text>
              </g>

              {/* 6. URBAN GREENERY & TREES (CLEAN & SPACED) */}
              <g id="trees">
                <circle cx="35" cy="154" r="10" fill="#059669" />
                <circle cx="34" cy="153" r="8" fill="#10B981" />

                <circle cx="380" cy="150" r="10" fill="#059669" />
                <circle cx="379" cy="149" r="8" fill="#10B981" />

                <circle cx="580" cy="210" r="11" fill="#047857" />
                <circle cx="579" cy="209" r="9" fill="#10B981" />

                <circle cx="730" cy="330" r="11" fill="#059669" />
                <circle cx="729" cy="329" r="9" fill="#10B981" />

                <circle cx="835" cy="520" r="10" fill="#047857" />
                <circle cx="835" cy="519" r="8" fill="#10B981" />

                <circle cx="835" cy="760" r="10" fill="#059669" />
                <circle cx="835" cy="759" r="8" fill="#10B981" />

                <circle cx="480" cy="420" r="11" fill="#059669" />
                <circle cx="479" cy="419" r="9" fill="#10B981" />

                <circle cx="598" cy="530" r="10" fill="#047857" />
                <circle cx="598" cy="529" r="8" fill="#10B981" />

                <circle cx="598" cy="760" r="10" fill="#059669" />
                <circle cx="598" cy="759" r="8" fill="#10B981" />
              </g>

              {/* 7. ROADSIDE STREET LAMPS (MINIMAL) */}
              <g id="lamps" fill="#F8FAFC" stroke="#475569" strokeWidth="1">
                <circle cx="200" cy="182" r="2.5" />
                <circle cx="420" cy="182" r="2.5" />
                <circle cx="670" cy="270" r="2.5" />
                <circle cx="770" cy="410" r="2.5" />
                <circle cx="808" cy="620" r="2.5" />
                <circle cx="808" cy="800" r="2.5" />
                <circle cx="632" cy="620" r="2.5" />
                <circle cx="632" cy="800" r="2.5" />
              </g>
            </svg>

            {/* Aerial Top-Down Truck (Bigger 4K UHD Vector Filling the Lane Proportionately) */}
            <div
              className="absolute z-20 will-change-transform flex items-center justify-center pointer-events-none"
              style={{
                left: `${truckX}%`,
                top: `${truckY}%`,
                transform: `translate(-50%, -50%) rotate(${truckHeading}deg)`
              }}
            >
              <img
                src="/assets/goshipping-machinery/hd/truck_aerial_4k.svg"
                alt="Aerial Semi Truck Negotiating Highway Curve"
                className="w-56 sm:w-72 md:w-80 lg:w-[350px] h-auto drop-shadow-2xl"
              />
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SCENE 5: VERTICAL CENTER HIGHWAY + EDITORIAL ASSURANCE (4K)      */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`absolute inset-0 bg-white flex transition-opacity duration-500 pointer-events-none ${
              isScene5 ? 'opacity-100 pointer-events-auto' : 'opacity-0'
            }`}
          >
            {/* Left Column: Bold Headline & Lead Copy */}
            <div className="w-[36%] h-full p-8 sm:p-14 flex flex-col justify-between">
              <div className="space-y-4 pt-10">
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black font-['Manrope'] tracking-tight leading-[1.02] uppercase">
                  <span className="text-slate-400">RELIABILITY</span><br />
                  <span className="text-[#11181E]">AT EVERY</span><br />
                  <span className="text-[#11181E]">MILESTONE</span>
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm leading-relaxed pb-8">
                With every service under one roof and one accountable team, your supply chain moves the way your business demands: predictably, transparently, and without excuses.
              </p>
            </div>

            {/* Center Column: Vertical Center Highway Lane (Larger scale 4K) */}
            <div className="relative w-[28%] h-full bg-[#11181E] overflow-hidden flex justify-center border-x border-slate-800">
              {/* Dashed Center Road Lines Scrolling Upward */}
              <div
                className="absolute inset-0 flex justify-center opacity-70 will-change-transform"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(180deg, #FFFFFF 0px, #FFFFFF 30px, transparent 30px, transparent 60px)',
                  backgroundSize: '4px 60px',
                  backgroundPosition: `center ${p5 * 3200}px`,
                  backgroundRepeat: 'repeat-y'
                }}
              ></div>

              {/* Top-Down Aerial Truck Driving Straight Down South (Physically advancing down the highway) */}
              <div
                className="absolute z-10 left-1/2 will-change-transform flex items-center justify-center pointer-events-none"
                style={{
                  top: `calc(-15% + ${p5 * 135}%)`,
                  transform: `translateX(calc(-50% + ${Math.sin(p5 * 18) * 3}px))`
                }}
              >
                <img
                  src="/assets/goshipping-machinery/hd/truck_aerial_vertical_4k.svg"
                  alt="Aerial Semi Truck Driving Down Highway"
                  className="h-[300px] sm:h-[360px] md:h-[420px] lg:h-[480px] w-auto drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Right Column: Vertical Assurance Cards */}
            <div className="w-[36%] h-full p-8 sm:p-14 flex items-center overflow-hidden">
              <div
                className="space-y-8 will-change-transform"
                style={{
                  transform: `translateY(calc(20vh - ${p5 * 72}vh))`
                }}
              >
                {/* Card 1: Global Coverage */}
                <div className="space-y-2 max-w-sm">
                  <div className="w-8 h-8 flex items-center justify-center text-slate-900 mb-1">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-['Manrope'] uppercase">
                    GLOBAL NETWORK COVERAGE
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    From APAC trade corridors to transatlantic sea routes, integrated air and ocean forwarding gives you complete reach.
                  </p>
                </div>

                {/* Card 2: 24/7 Support */}
                <div className="space-y-2 max-w-sm">
                  <div className="w-8 h-8 flex items-center justify-center text-slate-900 mb-1">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-['Manrope'] uppercase">
                    24/7 CUSTOMER SUPPORT
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Real people, always available. Whether it is a routine update or an urgent issue, we pick up the phone and we own the outcome.
                  </p>
                </div>

                {/* Card 3: Milestone Visibility */}
                <div className="space-y-2 max-w-sm">
                  <div className="w-8 h-8 flex items-center justify-center text-slate-900 mb-1">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 font-['Manrope'] uppercase">
                    CARGO INTEGRITY & CONTROL
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Rigorous handling protocols, bonded warehouse security, and licensed brokerage ensure zero clearance surprises.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* SCENE 6 & 7: DEEP OCEAN CARGO SHIP VOYAGE (4K UHD SCALE)        */}
          {/* --------------------------------------------------------------- */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-between transition-opacity duration-500 pointer-events-none ${
              isOcean ? 'opacity-100 pointer-events-auto' : 'opacity-0'
            }`}
            style={{
              backgroundColor: '#071838',
              backgroundImage: 'url(/assets/goshipping-machinery/hd/ocean_canvas_hd.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* SUBPHASE 6A: 4 CORNER VALUE PROPOSITIONS AROUND SAILING SHIP */}
            <div
              className={`absolute inset-0 p-8 sm:p-14 grid grid-cols-1 md:grid-cols-2 content-between pointer-events-none transition-opacity duration-500 z-30 ${
                isScene6 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Top Left: One Point of Contact */}
              <div className="max-w-xs space-y-1.5 pt-6">
                <div className="text-white/80 font-mono text-sm tracking-wider mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white font-['Manrope'] tracking-tight uppercase">
                  ONE POINT OF CONTACT
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-normal">
                  No more chasing multiple vendors. One team manages your entire shipment from origin to destination.
                </p>
              </div>

              {/* Top Right: Full Supply Chain Visibility */}
              <div className="max-w-xs space-y-1.5 pt-6 md:text-right md:justify-self-end">
                <div className="text-white/80 font-mono text-sm tracking-wider mb-1 flex items-center gap-2 md:justify-end">
                  <span className="w-5 h-5 rounded-sm border border-white/40 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white font-['Manrope'] tracking-tight uppercase">
                  FULL SUPPLY CHAIN VISIBILITY
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-normal">
                  Track your freight in real time and get proactive updates before issues become delays.
                </p>
              </div>

              {/* Bottom Left: Compliance You Can Trust */}
              <div className="max-w-xs space-y-1.5 pb-10">
                <div className="text-white/80 font-mono text-sm tracking-wider mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center">
                    <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white font-['Manrope'] tracking-tight uppercase">
                  COMPLIANCE YOU CAN TRUST
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-normal">
                  Our licensed customs brokers keep your shipments moving within every regulatory requirement across APAC.
                </p>
              </div>

              {/* Bottom Right: Competitive Pricing */}
              <div className="max-w-xs space-y-1.5 pb-10 md:text-right md:justify-self-end">
                <div className="text-white/80 font-mono text-sm tracking-wider mb-1 flex items-center gap-2 md:justify-end">
                  <span className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold">$</span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white font-['Manrope'] tracking-tight uppercase">
                  COMPETITIVE, TRANSPARENT PRICING
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed font-normal">
                  No hidden fees. Clear, competitive pricing backed by responsive sales support throughout the shipment.
                </p>
              </div>
            </div>

            {/* The Container Cargo Ship (Larger 4K UHD 3120px Asset) */}
            <div
              className="relative z-20 my-auto will-change-transform flex items-center justify-center"
              style={{
                transform: `translateY(${pOcean * 80}px) scale(${Math.max(0.60, 1.0 - pOcean * 0.40)})`
              }}
            >
              <img
                src="/assets/goshipping-machinery/hd/cargo_ship_4k.png"
                alt="Container Ship Sailing in Deep Ocean with Multi-Colored Container Bays"
                className="h-[44vh] sm:h-[50vh] md:h-[54vh] max-h-[420px] w-auto object-contain drop-shadow-[0_30px_70px_rgba(0,0,0,0.9)]"
              />
            </div>

            {/* SUBPHASE 7B: ORBITAL OVERLAY AT FINAL HORIZON */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-between py-12 pointer-events-none transition-opacity duration-500 z-40 ${
                isScene7 ? 'opacity-100 pointer-events-auto' : 'opacity-0'
              }`}
            >
              {/* Top Headline Overlay */}
              <div className="text-center max-w-xl mx-auto space-y-3 pt-6">
                {/* Arrow Beacon >>> */}
                <div className="text-white/70 font-mono tracking-widest text-sm flex justify-center gap-1">
                  <span>&gt;</span><span>&gt;</span><span>&gt;</span>
                </div>

                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white font-['Manrope'] tracking-tight uppercase leading-[1.05]">
                  FAST ISSUE<br />RESOLUTION
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal px-4 max-w-md mx-auto">
                  When something unexpected happens, we do not point fingers — we solve it. Our team acts immediately to protect your timeline.
                </p>
              </div>

              {/* Bottom Call to Action Button */}
              <div className="pt-4">
                <a
                  href="#quote-section"
                  className="px-8 py-3.5 rounded-md bg-[#EA1D2C] hover:bg-[#D01422] text-white font-bold text-xs tracking-wider uppercase transition-colors duration-150 border border-white/20 cursor-pointer"
                >
                  START A SHIPMENT WITH GOSHIPPING →
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  </div>
  );
};
