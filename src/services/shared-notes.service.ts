import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://povzwweoisrucqeaebmb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6I7StVgWH6QaP2NOiRJ6Xw_zYTk-ily';

export interface SharedLogEntry {
  id: string;
  dayId: string;
  timestamp: number;
  content: string;
  type: 'theory' | 'code' | 'bug' | 'idea';
  category: string;
}

export interface SharedNotesState {
  logs: SharedLogEntry[];
  categoriesByDay: Record<string, string[]>;
}

@Injectable({
  providedIn: 'root'
})
export class SharedNotesService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  async hasSession(): Promise<boolean> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return !!data.session;
  }

  onAuthStateChange(cb: (signedIn: boolean) => void): { unsubscribe: () => void } {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      cb(!!session);
    });
    return {
      unsubscribe: () => data.subscription.unsubscribe()
    };
  }

  async signInWithOtp(email: string): Promise<void> {
    const clean = String(email || '').trim();
    if (!clean) throw new Error('Email is required');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await this.supabase.auth.signInWithOtp({
      email: clean,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async loadState(): Promise<SharedNotesState | null> {
    const [logsRes, categoriesRes] = await Promise.all([
      this.supabase
        .from('learning_logs')
        .select('id, day_id, timestamp, content, type, category')
        .order('timestamp', { ascending: false }),
      this.supabase
        .from('log_categories_by_day')
        .select('day_id, categories')
    ]);

    if (logsRes.error) throw logsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    const logs: SharedLogEntry[] = (logsRes.data || []).map((r: any) => ({
      id: String(r.id || ''),
      dayId: String(r.day_id || ''),
      timestamp: Number(r.timestamp || Date.now()),
      content: String(r.content || ''),
      type: this.normalizeType(r.type),
      category: this.normalizeCategoryName(r.category || '通用')
    }));

    const categoriesByDay: Record<string, string[]> = {};
    for (const row of (categoriesRes.data || []) as any[]) {
      const dayId = String(row?.day_id || '').trim();
      if (!dayId) continue;
      const arr = Array.isArray(row?.categories) ? row.categories : ['通用'];
      categoriesByDay[dayId] = this.normalizeCategoryList(arr);
    }

    return { logs, categoriesByDay };
  }

  async replaceState(state: SharedNotesState): Promise<void> {
    const logs = (state.logs || []).map(log => ({
      id: log.id,
      day_id: log.dayId,
      timestamp: Number(log.timestamp),
      content: log.content,
      type: this.normalizeType(log.type),
      category: this.normalizeCategoryName(log.category || '通用')
    }));

    const categoriesByDay = Object.entries(state.categoriesByDay || {})
      .map(([dayId, categories]) => ({
        day_id: dayId,
        categories: this.normalizeCategoryList(categories || [])
      }))
      .filter(r => r.day_id);

    const deleteLogsRes = await this.supabase
      .from('learning_logs')
      .delete()
      .not('id', 'is', null);
    if (deleteLogsRes.error) throw deleteLogsRes.error;

    if (logs.length > 0) {
      const upsertLogsRes = await this.supabase
        .from('learning_logs')
        .upsert(logs, { onConflict: 'id' });
      if (upsertLogsRes.error) throw upsertLogsRes.error;
    }

    const deleteCategoriesRes = await this.supabase
      .from('log_categories_by_day')
      .delete()
      .not('day_id', 'is', null);
    if (deleteCategoriesRes.error) throw deleteCategoriesRes.error;

    if (categoriesByDay.length > 0) {
      const upsertCategoriesRes = await this.supabase
        .from('log_categories_by_day')
        .upsert(categoriesByDay, { onConflict: 'day_id' });
      if (upsertCategoriesRes.error) throw upsertCategoriesRes.error;
    }
  }

  private normalizeCategoryName(raw: string): string {
    return String(raw || '').replace(/\s+/g, ' ').trim() || '通用';
  }

  private normalizeCategoryList(raw: unknown[]): string[] {
    const uniq = Array.from(
      new Set((raw || []).map(v => this.normalizeCategoryName(String(v))).filter(Boolean))
    );
    if (!uniq.includes('通用')) uniq.unshift('通用');
    return uniq;
  }

  private normalizeType(raw: unknown): 'theory' | 'code' | 'bug' | 'idea' {
    if (raw === 'theory' || raw === 'code' || raw === 'bug' || raw === 'idea') return raw;
    return 'idea';
  }
}
