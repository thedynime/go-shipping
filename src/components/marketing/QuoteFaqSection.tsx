import React, { useState } from 'react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'p2p-transfer',
    category: 'P2P Hand Carry',
    question: 'How does P2P Transfer (Hand Carry) work and what are the benefits?',
    answer: 'P2P (Person-to-Person) Transfer is our ultra-rapid logistics channel for urgent commercial samples, high-value electronics, documents, and lightweight merchandise. Packages are received at our Guangzhou consolidation warehouse, handed over to verified flight couriers within our agent network, and delivered to Dhaka within 24 to 48 hours. Shipments include secure warehouse holding, immediate airport clearance, real-time telemetry, and quick self-pickup or door delivery.'
  },
  {
    id: 'hubs-addresses',
    category: 'Hubs & Addresses',
    question: 'What are the official warehouse intake and pickup hub addresses?',
    answer: 'China Origin Intake Hub: 765, Sanyuanli Avenue, Baiyun District, Guangzhou (广州市白云区三元里大道765号). Open 7 days a week for 1688, Taobao, and factory shipments. Bangladesh Central Hub: 43/31, Sabujkanon, Dhaka-1214. Chittagong Port Hub: GoShipping CFS Terminal, CPA Seaport Zone, Agrabad Commercial Area, Chittagong. Malaysia Hub: Lot 2720-B, Jalan Industri 12, Kampung Baru Sungai Buloh, 47000, Selangor, Malaysia.'
  },
  {
    id: 'customs-brokerage',
    category: 'Customs & Clearance',
    question: 'What is included in the customs clearance and tariff assessment?',
    answer: 'Every Ship for Me booking includes end-to-end clearing and forwarding (C&F). Our licensed customs brokerage team manages HS code classification, duty pre-assessment, port documentation, and statutory customs clearance at Dhaka HSIA airport and Chittagong seaport. You receive an itemized commercial invoice with zero hidden port demurrage fees.'
  },
  {
    id: 'shipping-mark-procedure',
    category: 'Shipment Procedure',
    question: 'How do I send goods from 1688, Taobao, or a Chinese supplier?',
    answer: 'Step 1: Submit your booking request through this form to receive your unique Shipping Mark (e.g., GS-DAC-XXXX). Step 2: Instruct your Chinese seller to label all cartons with this mark and deliver to our Guangzhou warehouse. Step 3: Our intake team inspects the cargo, confirms physical measurements, and dispatches via your chosen mode (Air, Sea, or P2P).'
  },
  {
    id: 'restricted-goods',
    category: 'Compliance',
    question: 'What cargo items are restricted or prohibited?',
    answer: 'Hazardous chemicals, explosive compounds, flammable liquids, and contraband goods are strictly prohibited. Items containing built-in lithium batteries, cosmetics, or specialized electronics require prior verification and manufacturer MSDS documentation before dispatch.'
  }
];

export default function QuoteFaqSection() {
  const [openId, setOpenId] = useState<string | null>('p2p-transfer');

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-950/60 text-[#EA1D2C] flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
              Shipping &amp; Forwarding Frequently Asked Questions
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete procedural guide, transit SLAs, China warehouse protocols, and customs policies.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-none overflow-hidden ${
                isOpen
                  ? 'border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white font-['Manrope',sans-serif]">
                    {item.question}
                  </span>
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-transform ${
                    isOpen
                      ? 'bg-[#EA1D2C] text-white border-[#EA1D2C] rotate-180'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-red-100/60 dark:border-red-950/40">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
