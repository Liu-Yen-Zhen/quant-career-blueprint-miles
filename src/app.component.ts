import { Component, inject, signal, computed, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { MarkdownModule, provideMarkdown } from 'ngx-markdown';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

interface WeekData {
  id: number;
  title: string;
  phase: string;
  phaseId: number;
  summary: string;
  keyConcepts: string[];
  skills: { [key: string]: number };
}

interface DaySchedule {
  day_id: string;
  yushi_focus: string;
  am: { topic: string; tasks: string[] };
  pm: { topic: string; tasks: string[] };
  night: { topic: string; tasks: string[] };
}

interface PhaseData {
  id: number;
  name: string;
  color: string;
  weeks: number[];
}

interface LogEntry {
  id: string;
  dayId?: string;
  content: string;
  timestamp: number;
  type?: 'theory' | 'code' | 'bug' | 'idea';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MarkdownModule, FormsModule],
  providers: [provideMarkdown()],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private gemini = inject(GeminiService);

  // --- Core Data ---
  phases = signal<PhaseData[]>([]);
  weeks = signal<WeekData[]>([]);
  schedule = signal<Record<number, DaySchedule[]>>({});

  // --- UI State ---
  selectedWeekId = signal<number>(1);
  selectedDayIndex = signal<number>(0);
  activeTab = signal<'roadmap' | 'interview' | 'project'>('roadmap');

  // --- Persisted Tasks & Logs (Persisted) ---
  completedTasks = signal<Set<string>>(new Set<string>());
  learningLogs = signal<LogEntry[]>([]);
  currentLogInput = signal<string>('');
  currentLogType = signal<'theory' | 'code' | 'bug' | 'idea'>('idea'); // 新增當前筆記類型

  // --- Journal Filter (by module/type) ---
  journalFilter = signal<'all' | 'theory' | 'code' | 'bug' | 'idea'>('all');

  // 用來捲動到 Learning Journal
  journalSection = viewChild<ElementRef>('journalSection');

  // AI & Interview State
  tutorLoading = signal<boolean>(false);
  interviewLoading = signal<boolean>(false);
  interviewQuestion = signal<string>('');
  interviewAnswer = signal<string>('');
  showAnswer = signal<boolean>(false);

  // Radar Chart
  radarChartContainer = viewChild<ElementRef>('radarChart');

  constructor() {
    this.loadStaticData();
    this.loadPersistedState();

    effect(() => {
      // 週 / 日切換時更新雷達圖
      this.currentDaySchedule();
      this.renderRadarChart();
    });

    effect(() => {
      // 切 tab 時也更新一次
      this.activeTab();
      this.renderRadarChart();
    });
  }

  // --- Data Load ---
  async loadStaticData() {
    // 你原本載入 metadata 的邏輯（保留）
    try {
      const res = await fetch('./metadata.json');
      const data = await res.json();

      this.phases.set(data.phases || []);
      this.weeks.set(data.weeks || []);
      this.schedule.set(data.schedule || {});
    } catch (e) {
      console.error('Failed to load metadata.json', e);
    }
  }

  loadPersistedState() {
    try {
      const tasksRaw = localStorage.getItem('completedTasks');
      const logsRaw = localStorage.getItem('learningLogs');

      if (tasksRaw) {
        const arr = JSON.parse(tasksRaw) as string[];
        this.completedTasks.set(new Set(arr));
      }
      if (logsRaw) {
        const logs = JSON.parse(logsRaw) as LogEntry[];
        this.learningLogs.set(logs || []);
      }
    } catch (e) {
      console.error('Failed to load persisted state', e);
    }

    effect(() => {
      localStorage.setItem('completedTasks', JSON.stringify(Array.from(this.completedTasks())));
    });
    effect(() => {
      localStorage.setItem('learningLogs', JSON.stringify(this.learningLogs()));
    });
  }

  // --- Derived ---
  currentWeekData = computed(() => this.weeks().find(w => w.id === this.selectedWeekId()));
  currentPhaseData = computed(() => {
    const w = this.currentWeekData();
    if (!w) return null;
    return this.phases().find(p => p.id === w.phaseId) || null;
  });

  currentWeekSchedule = computed(() => this.schedule()[this.selectedWeekId()] || []);
  currentDaySchedule = computed(() => this.currentWeekSchedule()[this.selectedDayIndex()] || this.currentWeekSchedule()[0]);

  // 先取得「當天全部 logs」
  currentDayLogs = computed(() => {
    const dayId = this.currentDaySchedule()?.day_id;
    return this.learningLogs()
      .filter(l => l.dayId === dayId)
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  // 再依照篩選條件顯示（all / theory / code / bug / idea）
  filteredDayLogs = computed(() => {
    const filter = this.journalFilter();
    const logs = this.currentDayLogs();
    if (filter === 'all') return logs;
    return logs.filter(l => (l.type || 'idea') === filter);
  });

  currentEarnedSkills = computed(() => {
    const week = this.currentWeekData();
    if (!week) return { Math: 0, Coding: 0 };

    // 你原本的 skills 邏輯（保留）
    const skills = week.skills || {};
    const math = skills['Math'] ?? 0;
    const coding = skills['Coding'] ?? 0;
    return { Math: math, Coding: coding };
  });

  // --- Actions ---
  selectWeek(id: number) {
    this.selectedWeekId.set(id);
    this.selectedDayIndex.set(0);
    this.resetAI();
  }

  selectDay(i: number) {
    this.selectedDayIndex.set(i);
    this.resetAI();
  }

  setTab(tab: 'roadmap' | 'interview' | 'project') {
    this.activeTab.set(tab);
    this.resetAI();
  }

  toggleTask(task: string) {
    this.completedTasks.update(set => {
      const newSet = new Set(set);
      if (newSet.has(task)) newSet.delete(task);
      else newSet.add(task);
      return newSet;
    });
  }

  isTaskCompleted(task: string) {
    return this.completedTasks().has(task);
  }

  // 新增：切換筆記類型
  setLogType(type: 'theory' | 'code' | 'bug' | 'idea') {
    this.currentLogType.set(type);
  }

  setJournalFilter(filter: 'all' | 'theory' | 'code' | 'bug' | 'idea') {
    this.journalFilter.set(filter);

    // 若希望「切到模塊時，新增筆記類型也跟著換」
    if (filter !== 'all') {
      this.currentLogType.set(filter);
    }
  }

  openJournal(filter: 'all' | 'theory' | 'code' | 'bug' | 'idea') {
    this.setJournalFilter(filter);

    // 等畫面更新後捲動
    setTimeout(() => {
      const el = this.journalSection()?.nativeElement;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  // 修改：儲存時加入 type
  addLog() {
    const content = this.currentLogInput().trim();
    if (!content) return;

    this.learningLogs.update(logs => [{
      id: crypto.randomUUID(),
      dayId: this.currentDaySchedule()?.day_id,
      content,
      timestamp: Date.now(),
      type: this.currentLogType()
    }, ...logs]);

    this.currentLogInput.set('');
  }

  deleteLog(id: string) {
    this.learningLogs.update(logs => logs.filter(l => l.id !== id));
  }

  async generateDailySummary() {
    const logs = this.currentDayLogs();
    if (logs.length === 0) return;

    this.tutorLoading.set(true);
    try {
      const prompt = [
        `請用繁體中文整理今日學習紀錄，要求：`,
        `1) 依照「理論/程式/Debug/總結」分類`,
        `2) 每類列出重點與可行下一步`,
        `3) 若有公式用 $...$ 或 $$...$$`,
        `內容如下：`,
        logs.map(l => `- [${l.type || 'idea'}] ${new Date(l.timestamp).toLocaleString()}:\n${l.content}`).join('\n\n')
      ].join('\n');

      const res = await this.gemini.generateText(prompt);
      this.learningLogs.update(old => [{
        id: crypto.randomUUID(),
        dayId: this.currentDaySchedule()?.day_id,
        content: `### 今日總結（AI）\n\n${res}`,
        timestamp: Date.now(),
        type: 'idea'
      }, ...old]);

      this.journalFilter.set('idea');
    } catch (e) {
      console.error(e);
    } finally {
      this.tutorLoading.set(false);
    }
  }

  async generateQuestion() {
    this.interviewLoading.set(true);
    this.showAnswer.set(false);
    this.interviewQuestion.set('');
    this.interviewAnswer.set('');

    try {
      const prompt = `請給我一題量化面試題（機率/統計/微積分/演算法），題目用繁體中文，並提供一段提示與完整解答（解答請用 Markdown，可包含 LaTeX）。`;
      const res = await this.gemini.generateText(prompt);

      // 用簡單方式切段（你原本的分段邏輯可能不同；此處保留最穩的方式）
      this.interviewQuestion.set(res.split('解答')[0].trim());
      this.interviewAnswer.set(res.trim());
    } catch (e) {
      console.error(e);
      this.interviewQuestion.set('題目產生失敗，請稍後再試。');
    } finally {
      this.interviewLoading.set(false);
    }
  }

  toggleAnswer() {
    this.showAnswer.update(v => !v);
  }

  resetAI() {
    this.tutorLoading.set(false);
    this.interviewLoading.set(false);
  }

  // --- Radar Chart ---
  renderRadarChart() {
    if (this.activeTab() !== 'roadmap') return;
    if (!this.radarChartContainer()) return;

    const element = this.radarChartContainer()!.nativeElement;
    element.innerHTML = '';

    const skills = this.currentEarnedSkills();
    const data = [
      { axis: 'Math', value: (skills['Math'] || 0) / 100 },
      { axis: 'Coding', value: (skills['Coding'] || 0) / 100 }
    ];

    const width = 250;
    const height = 250;
    const radius = Math.min(width, height) / 2 - 30;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const angleSlice = (Math.PI * 2) / data.length;

    const rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, 1]);

    // Axes
    data.forEach((d, i) => {
      const angle = i * angleSlice - Math.PI / 2;
      const x = rScale(1) * Math.cos(angle);
      const y = rScale(1) * Math.sin(angle);

      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', '#334155')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', x * 1.15)
        .attr('y', y * 1.15)
        .attr('fill', '#94a3b8')
        .attr('font-size', 10)
        .attr('text-anchor', 'middle')
        .text(d.axis);
    });

    // Radar path
    const line = d3.lineRadial<any>()
      .radius((d: any) => rScale(d.value))
      .angle((d: any, i: number) => i * angleSlice);

    g.append('path')
      .datum(data)
      .attr('d', line as any)
      .attr('fill', 'rgba(34,197,94,0.15)')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2);

    // Dots
    g.selectAll('.radarDot')
      .data(data)
      .enter()
      .append('circle')
      .attr('r', 3)
      .attr('cx', (d: any, i: number) => rScale(d.value) * Math.cos(i * angleSlice - Math.PI / 2))
      .attr('cy', (d: any, i: number) => rScale(d.value) * Math.sin(i * angleSlice - Math.PI / 2))
      .attr('fill', '#22c55e');
  }
}
