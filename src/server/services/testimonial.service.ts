import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TESTIMONIALS, type Testimonial } from '../../data/testimonials';
import { db } from '../db/client';
import { testimonials } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

export interface TestimonialRecord extends Testimonial {
  avatarUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const STORE_PATH = path.resolve(process.cwd(), '.testimonials_store.json');

declare global {
  var __goshipping_testimonials: TestimonialRecord[] | undefined;
}

function getInitialTestimonials(): TestimonialRecord[] {
  return TESTIMONIALS.map((t, index) => ({
    ...t,
    avatarUrl: '',
    displayOrder: index,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function loadTestimonialsFromFile(): TestimonialRecord[] {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[TestimonialService] Failed to load testimonials from store:', err);
  }
  return getInitialTestimonials();
}

function saveTestimonialsToFile(data: TestimonialRecord[]): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TestimonialService] Failed to save testimonials to store:', err);
  }
}

let memoryTestimonials: TestimonialRecord[] = globalThis.__goshipping_testimonials || loadTestimonialsFromFile();
globalThis.__goshipping_testimonials = memoryTestimonials;

export class TestimonialService {
  /**
   * List all testimonials (or only active ones for public homepage)
   */
  static async getTestimonials(activeOnly = false): Promise<TestimonialRecord[]> {
    // Try to read from database if accessible
    try {
      const records = await db.select().from(testimonials).orderBy(asc(testimonials.displayOrder));
      if (records && records.length > 0) {
        const formatted: TestimonialRecord[] = records.map((r) => ({
          id: r.id,
          clientName: r.clientName,
          roleOrCompany: r.roleOrCompany,
          location: r.location || '',
          quote: r.quote,
          rating: r.rating,
          initial: r.initial || (r.clientName.trim().charAt(0).toUpperCase() || 'C'),
          tag: r.tag || undefined,
          date: r.dateText || undefined,
          avatarUrl: r.avatarUrl || undefined,
          displayOrder: r.displayOrder,
          isActive: r.isActive,
          createdAt: r.createdAt?.toISOString(),
          updatedAt: r.updatedAt?.toISOString()
        }));

        memoryTestimonials = formatted;
        globalThis.__goshipping_testimonials = memoryTestimonials;
        saveTestimonialsToFile(memoryTestimonials);

        return activeOnly ? formatted.filter((t) => t.isActive) : formatted;
      }
    } catch {
      // Database not reachable, gracefully fallback to persisted store
    }

    const sorted = [...memoryTestimonials].sort((a, b) => a.displayOrder - b.displayOrder);
    return activeOnly ? sorted.filter((t) => t.isActive) : sorted;
  }

  /**
   * Get single testimonial by ID
   */
  static async getById(id: string): Promise<TestimonialRecord | null> {
    const all = await this.getTestimonials(false);
    return all.find((t) => t.id === id) || null;
  }

  /**
   * Create a new client testimonial
   */
  static async createTestimonial(payload: Omit<TestimonialRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestimonialRecord> {
    const id = `t-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const initial = payload.initial?.trim() || (payload.clientName.trim().charAt(0).toUpperCase() || 'C');

    const newRecord: TestimonialRecord = {
      ...payload,
      id,
      initial,
      displayOrder: typeof payload.displayOrder === 'number' ? payload.displayOrder : memoryTestimonials.length,
      isActive: payload.isActive ?? true,
      rating: Number(payload.rating) || 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    memoryTestimonials.push(newRecord);
    saveTestimonialsToFile(memoryTestimonials);

    // Sync to DB if available
    try {
      await db.insert(testimonials).values({
        id: newRecord.id,
        clientName: newRecord.clientName,
        roleOrCompany: newRecord.roleOrCompany,
        location: newRecord.location || null,
        quote: newRecord.quote,
        rating: newRecord.rating,
        initial: newRecord.initial,
        tag: newRecord.tag || null,
        dateText: newRecord.date || null,
        avatarUrl: newRecord.avatarUrl || null,
        displayOrder: newRecord.displayOrder,
        isActive: newRecord.isActive
      });
    } catch {}

    return newRecord;
  }

  /**
   * Update an existing client testimonial
   */
  static async updateTestimonial(id: string, payload: Partial<TestimonialRecord>): Promise<TestimonialRecord | null> {
    const index = memoryTestimonials.findIndex((t) => t.id === id);
    if (index === -1) {
      return null;
    }

    const existing = memoryTestimonials[index];
    const initial = payload.initial?.trim() || 
      (payload.clientName ? payload.clientName.trim().charAt(0).toUpperCase() : existing.initial);

    const updated: TestimonialRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      initial,
      rating: payload.rating !== undefined ? Number(payload.rating) : existing.rating,
      updatedAt: new Date().toISOString()
    };

    memoryTestimonials[index] = updated;
    saveTestimonialsToFile(memoryTestimonials);

    // Sync to DB if available
    try {
      await db.update(testimonials).set({
        clientName: updated.clientName,
        roleOrCompany: updated.roleOrCompany,
        location: updated.location || null,
        quote: updated.quote,
        rating: updated.rating,
        initial: updated.initial,
        tag: updated.tag || null,
        dateText: updated.date || null,
        avatarUrl: updated.avatarUrl || null,
        displayOrder: updated.displayOrder,
        isActive: updated.isActive
      }).where(eq(testimonials.id, id));
    } catch {}

    return updated;
  }

  /**
   * Delete testimonial
   */
  static async deleteTestimonial(id: string): Promise<boolean> {
    const initialLen = memoryTestimonials.length;
    memoryTestimonials = memoryTestimonials.filter((t) => t.id !== id);
    if (memoryTestimonials.length !== initialLen) {
      saveTestimonialsToFile(memoryTestimonials);
      try {
        await db.delete(testimonials).where(eq(testimonials.id, id));
      } catch {}
      return true;
    }
    return false;
  }

  /**
   * Reorder testimonials
   */
  static async reorderTestimonials(orderedIds: string[]): Promise<TestimonialRecord[]> {
    orderedIds.forEach((id, index) => {
      const item = memoryTestimonials.find((t) => t.id === id);
      if (item) {
        item.displayOrder = index;
      }
    });

    saveTestimonialsToFile(memoryTestimonials);

    // Update in DB
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(testimonials).set({ displayOrder: i }).where(eq(testimonials.id, orderedIds[i]));
      }
    } catch {}

    return this.getTestimonials(false);
  }
}
