import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { HOME_BANNERS, type HeroBanner } from '../../data/homeBanners';
import { db } from '../db/client';
import { homeBanners } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

export interface BannerRecord extends HeroBanner {
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.banners_store.json');

declare global {
  var __goshipping_banners: BannerRecord[] | undefined;
}

function getInitialBanners(): BannerRecord[] {
  return HOME_BANNERS.map((b, index) => ({
    ...b,
    displayOrder: index,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function loadBannersFromFile(): BannerRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[BannerService] Failed to load banners from store:', err);
  }
  return getInitialBanners();
}

function saveBannersToFile(banners: BannerRecord[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(banners, null, 2), 'utf-8');
  } catch (err) {
    console.error('[BannerService] Failed to save banners to store:', err);
  }
}

let memoryBanners: BannerRecord[] = globalThis.__goshipping_banners || loadBannersFromFile();
globalThis.__goshipping_banners = memoryBanners;

export class BannerService {
  /**
   * List all banners (or only active ones for public homepage)
   */
  static async getBanners(activeOnly = false): Promise<BannerRecord[]> {
    // Try to read from database if accessible
    try {
      const records = await db.select().from(homeBanners).orderBy(asc(homeBanners.displayOrder));
      if (records && records.length > 0) {
        const formatted: BannerRecord[] = records.map((r) => ({
          id: r.id,
          badge: r.badge,
          badgeColor: r.badgeColor || '#EA1D2C',
          headlineBengali: r.headlineBengali,
          headlineAccent: r.headlineAccent,
          subtitle: r.subtitle,
          primaryCtaText: r.primaryCtaText,
          primaryCtaLink: r.primaryCtaLink,
          secondaryCtaText: r.secondaryCtaText || undefined,
          secondaryCtaLink: r.secondaryCtaLink || undefined,
          features: Array.isArray(r.features) ? r.features : [],
          imageUrl: r.imageUrl,
          imageAlt: r.imageAlt,
          taglineSmall: r.taglineSmall || undefined,
          displayOrder: r.displayOrder,
          isActive: r.isActive,
          createdAt: r.createdAt?.toISOString(),
          updatedAt: r.updatedAt?.toISOString()
        }));

        memoryBanners = formatted;
        globalThis.__goshipping_banners = memoryBanners;
        saveBannersToFile(memoryBanners);

        return activeOnly ? formatted.filter((b) => b.isActive) : formatted;
      }
    } catch {
      // Database not reachable, gracefully fallback to persisted store
    }

    const sorted = [...memoryBanners].sort((a, b) => a.displayOrder - b.displayOrder);
    return activeOnly ? sorted.filter((b) => b.isActive) : sorted;
  }

  /**
   * Get single banner by ID
   */
  static async getById(id: string): Promise<BannerRecord | null> {
    const all = await this.getBanners(false);
    return all.find((b) => b.id === id) || null;
  }

  /**
   * Create a new homepage banner
   */
  static async createBanner(payload: Omit<BannerRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<BannerRecord> {
    const id = `b-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newRecord: BannerRecord = {
      ...payload,
      id,
      displayOrder: typeof payload.displayOrder === 'number' ? payload.displayOrder : memoryBanners.length,
      isActive: payload.isActive ?? true,
      features: Array.isArray(payload.features) ? payload.features : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    memoryBanners.push(newRecord);
    saveBannersToFile(memoryBanners);

    // Sync to DB if available
    try {
      await db.insert(homeBanners).values({
        id: newRecord.id,
        badge: newRecord.badge,
        badgeColor: newRecord.badgeColor || '#EA1D2C',
        headlineBengali: newRecord.headlineBengali,
        headlineAccent: newRecord.headlineAccent,
        subtitle: newRecord.subtitle,
        primaryCtaText: newRecord.primaryCtaText,
        primaryCtaLink: newRecord.primaryCtaLink,
        secondaryCtaText: newRecord.secondaryCtaText || null,
        secondaryCtaLink: newRecord.secondaryCtaLink || null,
        features: newRecord.features,
        imageUrl: newRecord.imageUrl,
        imageAlt: newRecord.imageAlt,
        taglineSmall: newRecord.taglineSmall || null,
        displayOrder: newRecord.displayOrder,
        isActive: newRecord.isActive
      });
    } catch {}

    return newRecord;
  }

  /**
   * Update an existing homepage banner
   */
  static async updateBanner(id: string, payload: Partial<BannerRecord>): Promise<BannerRecord | null> {
    const index = memoryBanners.findIndex((b) => b.id === id);
    if (index === -1) {
      return null;
    }

    const existing = memoryBanners[index];
    const updated: BannerRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      features: Array.isArray(payload.features) ? payload.features : existing.features,
      updatedAt: new Date().toISOString()
    };

    memoryBanners[index] = updated;
    saveBannersToFile(memoryBanners);

    // Sync to DB if available
    try {
      await db.update(homeBanners).set({
        badge: updated.badge,
        badgeColor: updated.badgeColor || '#EA1D2C',
        headlineBengali: updated.headlineBengali,
        headlineAccent: updated.headlineAccent,
        subtitle: updated.subtitle,
        primaryCtaText: updated.primaryCtaText,
        primaryCtaLink: updated.primaryCtaLink,
        secondaryCtaText: updated.secondaryCtaText || null,
        secondaryCtaLink: updated.secondaryCtaLink || null,
        features: updated.features,
        imageUrl: updated.imageUrl,
        imageAlt: updated.imageAlt,
        taglineSmall: updated.taglineSmall || null,
        displayOrder: updated.displayOrder,
        isActive: updated.isActive
      }).where(eq(homeBanners.id, id));
    } catch {}

    return updated;
  }

  /**
   * Delete banner
   */
  static async deleteBanner(id: string): Promise<boolean> {
    const initialLen = memoryBanners.length;
    memoryBanners = memoryBanners.filter((b) => b.id !== id);
    if (memoryBanners.length !== initialLen) {
      saveBannersToFile(memoryBanners);
      try {
        await db.delete(homeBanners).where(eq(homeBanners.id, id));
      } catch {}
      return true;
    }
    return false;
  }

  /**
   * Reorder banners
   */
  static async reorderBanners(orderedIds: string[]): Promise<BannerRecord[]> {
    orderedIds.forEach((id, index) => {
      const banner = memoryBanners.find((b) => b.id === id);
      if (banner) {
        banner.displayOrder = index;
      }
    });

    saveBannersToFile(memoryBanners);

    // Update in DB
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(homeBanners).set({ displayOrder: i }).where(eq(homeBanners.id, orderedIds[i]));
      }
    } catch {}

    return this.getBanners(false);
  }
}
