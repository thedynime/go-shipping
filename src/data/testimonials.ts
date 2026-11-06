export interface Testimonial {
  id: string;
  clientName: string;
  roleOrCompany: string;
  location: string;
  quote: string;
  rating: number;
  initial: string;
  tag?: string;
  date?: string;
}

/**
 * GoShipping Verified Client Feedback & Testimonials
 * ---------------------------------------------------
 * To add or edit reviews:
 * Simply add a new object to the TESTIMONIALS array below or update existing entries!
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    clientName: 'Tanvir Ahmed',
    roleOrCompany: 'Managing Director, Horizon Apparels Ltd',
    location: 'Savar EPZ, Dhaka',
    quote: 'চীনের গুয়াংজু ওয়্যারহাউসে ফেব্রিক ও অ্যাক্সেসরিজ পৌঁছে দেওয়ার ৭ দিনের মধ্যেই এয়ারে ঢাকায় হাতে পেয়েছি। কাস্টমস হ্যান্ডলিং এবং প্রতি ধাপে ট্র্যাকিং আপডেট একদম নির্ভরযোগ্য ছিল।',
    rating: 5,
    initial: 'T',
    tag: 'Air Cargo Importer',
    date: 'October 2026'
  },
  {
    id: 't-2',
    clientName: 'Mahmudul Hasan',
    roleOrCompany: 'Founder, GadgetXpress Bangladesh',
    location: 'Mirpur DOHS, Dhaka',
    quote: '১৬৮৮ এবং তাওবাও থেকে বিভিন্ন সেলারের মাল গুয়াংজু ওয়্যারহাউসে একত্রিত (consolidation) করে এক চালানে পাঠিয়ে দিয়েছে। কোনো হিডেন পোর্ট চার্জ ছাড়া পুরো ডোর-টু-ডোর ডেলিভারি পেয়েছি।',
    rating: 5,
    initial: 'M',
    tag: 'E-commerce Seller',
    date: 'October 2026'
  },
  {
    id: 't-3',
    clientName: 'Shamim Reza',
    roleOrCompany: 'Proprietor, Bengal Machinery Tools',
    location: 'Chittagong Seaport Corridor',
    quote: 'সি শিপমেন্টে হেভি কন্টেইনার আনার ক্ষেত্রে পার সিবিএম (Per CBM) রেট খুব সাশ্রয়ী ছিল। চট্টগ্রাম সিএফএস থেকে নির্বিঘ্নে মালামাল ডেলিভারি পেয়েছি।',
    rating: 5,
    initial: 'S',
    tag: 'Sea Freight Importer',
    date: 'September 2026'
  }
];
