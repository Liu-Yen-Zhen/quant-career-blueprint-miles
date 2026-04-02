import { Injectable } from '@angular/core';
import { AuthChangeEvent, createClient, SupabaseClient } from '@supabase/supabase-js';

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
  completedTasks: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SharedNotesService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        // 讓 owner 在同一瀏覽器可保留登入，跨裝置/無痕則可重新登入取回同一份資料
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  async getCurrentUserEmail(): Promise<string | null> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return data.user?.email?.toLowerCase() || null;
  }

  onAuthStateChange(callback: (email: string | null, event: AuthChangeEvent) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user?.email?.toLowerCase() || null, event);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }

  async signInWithPassword(email: string, password: string): Promise<string> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    return data.user?.email?.toLowerCase() || email.trim().toLowerCase();
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async sendPasswordResetEmail(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );
    if (error) throw error;
  }

  async updateCurrentUserPassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
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

    let completedTasks: string[] = [];
    const completedRes = await this.supabase
      .from('completed_tasks')
      .select('task_key');
    if (completedRes.error) {
      if (!this.isMissingTableError(completedRes.error)) {
        throw completedRes.error;
      }
    } else {
      completedTasks = (completedRes.data || [])
        .map((row: any) => this.normalizeTaskKey(row?.task_key))
        .filter(Boolean);
    }

    return {
      logs,
      categoriesByDay,
      completedTasks: Array.from(new Set(completedTasks))
    };
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

    const completedTasks = Array.from(
      new Set((state.completedTasks || []).map(v => this.normalizeTaskKey(v)).filter(Boolean))
    );

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

    const deleteCompletedRes = await this.supabase
      .from('completed_tasks')
      .delete()
      .not('task_key', 'is', null);
    if (deleteCompletedRes.error && !this.isMissingTableError(deleteCompletedRes.error)) {
      throw deleteCompletedRes.error;
    }

    if (completedTasks.length > 0) {
      const upsertCompletedRes = await this.supabase
        .from('completed_tasks')
        .upsert(completedTasks.map(taskKey => ({ task_key: taskKey })), { onConflict: 'task_key' });
      if (upsertCompletedRes.error && !this.isMissingTableError(upsertCompletedRes.error)) {
        throw upsertCompletedRes.error;
      }
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

  private normalizeTaskKey(raw: unknown): string {
    return String(raw || '').trim();
  }

  private isMissingTableError(error: unknown): boolean {
    const code = String((error as any)?.code || '');
    const message = String((error as any)?.message || '').toLowerCase();
    return code === 'PGRST205' || message.includes('schema cache');
  }
}
