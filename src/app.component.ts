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

interface DailyTask {
  day_id: string;
  title: string;
  am: { topic: string; tasks: string[] };
  pm: { topic: string; tasks: string[] };
  night: { topic: string; tasks: string[] };
  yushi_focus: string;
}

interface LogEntry {
  id: string;
  dayId: string;
  timestamp: number;
  content: string;
  type: 'theory' | 'code' | 'bug' | 'idea'; // 新增 type
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MarkdownModule, FormsModule],
  providers: [provideMarkdown()],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  radarChartContainer = viewChild<ElementRef>('radarChart');
  journalSection = viewChild<ElementRef>('journalSection');

  activeTab = signal<'roadmap' | 'interview' | 'project'>('roadmap');
  selectedWeekId = signal<number>(2);
  selectedDayIndex = signal<number>(0);

  interviewQuestion = signal<string>('');
  interviewAnswer = signal<string>('');
  interviewLoading = signal<boolean>(false);
  showAnswer = signal<boolean>(false);

  tutorConcept = signal<string>('');
  tutorResponse = signal<string>('');
  tutorLoading = signal<boolean>(false);

  completedTasks = signal<Set<string>>(new Set());

  learningLogs = signal<LogEntry[]>([]);
  currentLogInput = signal<string>('');
  currentLogType = signal<'theory' | 'code' | 'bug' | 'idea'>('idea'); // 新增當前筆記
  journalFilter = signal<'all' | 'theory' | 'code' | 'bug' | 'idea'>('all'); // 新增：日誌檢視篩選

  phases = [
    { id: 1, name: '第一階段：量化基石與計算思維', color: 'text-cyan-400', weeks: [1, 2, 3] },
    { id: 2, name: '第二階段：數據工程與事件驅動', color: 'text-emerald-400', weeks: [4, 5, 6] },
    { id: 3, name: '第三階段：策略開發與機器學習', color: 'text-purple-400', weeks: [7, 8, 9, 10] },
    { id: 4, name: '第四階段：專題產出與職涯衝刺', color: 'text-rose-400', weeks: [11, 12] },
  ];

  weeksData: WeekData[] = [
    { id: 1, title: 'W1 — 統計基礎與隨機過程入門', phase: 'Phase 1', phaseId: 1, summary: '從常見分佈到隨機過程基本概念。', keyConcepts: ['Distribution', 'Expectation', 'Variance', 'Markov Property'], skills: { Math: 8, Trading: 2 } },
    { id: 2, title: 'W2 — 時間序列與平穩性檢定', phase: 'Phase 1', phaseId: 1, summary: 'ADF/KPSS 與隨機漫步、AR 模型的核心差異。', keyConcepts: ['ADF', 'KPSS', 'Random Walk', 'AR(1)'], skills: { Math: 7, Trading: 4 } },
    { id: 3, title: 'W3 — 線性代數與 SVD', phase: 'Phase 1', phaseId: 1, summary: '向量空間、特徵值與 SVD 分解。', keyConcepts: ['Eigen', 'SVD', 'PCA'], skills: { Math: 7, ML: 3 } },
    { id: 4, title: 'W4 — Python 資料工程與回測框架', phase: 'Phase 2', phaseId: 2, summary: '建立可靠資料處理與回測骨架。', keyConcepts: ['ETL', 'vectorbt', 'ccxt'], skills: { Coding: 8, Trading: 3 } },
    { id: 5, title: 'W5 — 事件驅動與交易成本', phase: 'Phase 2', phaseId: 2, summary: '手續費、滑價、延遲與成交模型。', keyConcepts: ['Slippage', 'Fees', 'Latency'], skills: { Trading: 6, Micro: 3 } },
    { id: 6, title: 'W6 — 市場微結構與 Order Book', phase: 'Phase 2', phaseId: 2, summary: 'Order book、OFI、流動性與毒性。', keyConcepts: ['LOB', 'OFI', 'VPIN'], skills: { Micro: 8, Trading: 4 } },
    { id: 7, title: 'W7 — 策略設計：趨勢/均值回歸', phase: 'Phase 3', phaseId: 3, summary: '從訊號到風控到評估。', keyConcepts: ['Trend', 'Mean Reversion'], skills: { Trading: 7, Coding: 4 } },
    { id: 8, title: 'W8 — 風控與部位管理', phase: 'Phase 3', phaseId: 3, summary: '波動率目標、槓桿與停損。', keyConcepts: ['Vol targeting', 'Position sizing'], skills: { Trading: 7, Math: 3 } },
    { id: 9, title: 'W9 — 機器學習：特徵與驗證', phase: 'Phase 3', phaseId: 3, summary: '特徵工程、交叉驗證與 leakage。', keyConcepts: ['CV', 'Leakage'], skills: { ML: 7, Coding: 5 } },
    { id: 10, title: 'W10 — 強化學習與市場造市', phase: 'Phase 3', phaseId: 3, summary: '從 AS 模型到 RL 動態調參。', keyConcepts: ['AS model', 'RL'], skills: { Micro: 6, ML: 5 } },
    { id: 11, title: 'W11 — 專題整合與部署', phase: 'Phase 4', phaseId: 4, summary: '把系統變成可展示作品。', keyConcepts: ['Vercel', 'Docker'], skills: { Coding: 6, Trading: 4 } },
    { id: 12, title: 'W12 — 面試衝刺與作品打磨', phase: 'Phase 4', phaseId: 4, summary: '題庫、敘事與作品包裝。', keyConcepts: ['Interview', 'Storytelling'], skills: { Trading: 5, Coding: 3 } },
  ];

  detailedSchedule: Record<number, DailyTask[]> = {
    1: [
      { day_id: 'D1', title: '分佈與期望', yushi_focus: '認識常見分佈與期望的意義', am: { topic: 'Distribution', tasks: ['Normal vs Lognormal', 'Expectation basics'] }, pm: { topic: 'Python', tasks: ['numpy random', 'visualize distributions'] }, night: { topic: 'Algo', tasks: ['Two Sum', 'Complexity basics'] } },
      { day_id: 'D2', title: '變異數與協方差', yushi_focus: '掌握 variance/covariance 的直覺', am: { topic: 'Variance', tasks: ['Variance derivation', 'Cov intuition'] }, pm: { topic: 'Pandas', tasks: ['cov/corr practice'] }, night: { topic: 'Algo', tasks: ['Two Pointers: Container With Most Water', 'Trapping Rain Water'] } },
      { day_id: 'D3', title: '隨機過程入門', yushi_focus: 'Markov property 與隨機漫步', am: { topic: 'Random Walk', tasks: ['Markov definition', 'RW simulation'] }, pm: { topic: 'Plotting', tasks: ['simulate paths', 'compare drift'] }, night: { topic: 'Algo', tasks: ['Binary search'] } },
      { day_id: 'D4', title: '重點複習與筆記整理', yushi_focus: '把概念寫成可複習的筆記', am: { topic: 'Review', tasks: ['Make summary notes', 'Key formulas'] }, pm: { topic: 'Coding', tasks: ['Refactor notebooks'] }, night: { topic: 'Algo', tasks: ['Stacks basics'] } },
      { day_id: 'D5', title: '小測驗與弱點補強', yushi_focus: '用題目檢查盲點', am: { topic: 'Quiz', tasks: ['Solve 5 problems', 'Fix mistakes'] }, pm: { topic: 'Practice', tasks: ['Implement small utilities'] }, night: { topic: 'Algo', tasks: ['Sliding window'] } },
    ],
    2: [
      { day_id: 'D1', title: '平穩性直覺', yushi_focus: 'Random Walk vs Stationary', am: { topic: 'Stationarity', tasks: ['What is stationary', 'Examples'] }, pm: { topic: 'Simulation', tasks: ['RW vs AR(1)', 'Visual compare'] }, night: { topic: 'Algo', tasks: ['Hash map practice'] } },
      { day_id: 'D2', title: 'ADF / KPSS', yushi_focus: '理解檢定假設與解讀', am: { topic: 'ADF/KPSS', tasks: ['Null hypotheses', 'Interpret p-values'] }, pm: { topic: 'Python', tasks: ['Run tests on series'] }, night: { topic: 'Algo', tasks: ['Prefix sums'] } },
      { day_id: 'D3', title: '差分與轉換', yushi_focus: '把非平穩變成可建模', am: { topic: 'Diff', tasks: ['Why diff works', 'When not'] }, pm: { topic: 'Implementation', tasks: ['Apply diff', 'Re-test'] }, night: { topic: 'Algo', tasks: ['Queue/Deque'] } },
      { day_id: 'D4', title: 'AR(1) 與估計', yushi_focus: 'AR 模型的意義與參數', am: { topic: 'AR(1)', tasks: ['Model equation', 'Stability condition'] }, pm: { topic: 'Estimation', tasks: ['Fit AR', 'Check residuals'] }, night: { topic: 'Algo', tasks: ['DP basics'] } },
      { day_id: 'D5', title: '整合與輸出報告', yushi_focus: '把結果寫成可重現的研究', am: { topic: 'Report', tasks: ['Write summary', 'Add plots'] }, pm: { topic: 'Cleanup', tasks: ['Organize code', 'Commit'] }, night: { topic: 'Algo', tasks: ['DP: Climbing stairs'] } },
    ],

    // 下面保留你原本的其他週內容（如果你的檔案裡有更多 schedule，直接沿用即可）
    3: this.detailedSchedule?.[3] || [],
    4: this.detailedSchedule?.[4] || [],
    5: this.detailedSchedule?.[5] || [],
    6: this.detailedSchedule?.[6] || [],
    7: this.detailedSchedule?.[7] || [],
    8: this.detailedSchedule?.[8] || [],
    9: this.detailedSchedule?.[9] || [],
    10: this.detailedSchedule?.[10] || [],
    11: this.detailedSchedule?.[11] || [],
    12: this.detailedSchedule?.[12] || [],
  };

  totalPossibleSkills = computed(() => {
    const totals: any = {};
    this.weeksData.forEach(w => Object.keys(w.skills).forEach(k => totals[k] = (totals[k] || 0) + w.skills[k]));
    return totals;
  });

  currentEarnedSkills = computed(() => {
    const current: any = {};
    const completed = this.completedTasks();
    this.weeksData.forEach(week => {
      const weekTasks = this.detailedSchedule[week.id] || [];
      const allTasks = weekTasks.flatMap(d => [...d.am.tasks, ...d.pm.tasks, ...d.night.tasks]);
      if (allTasks.length === 0) return;
      const ratio = allTasks.filter(t => completed.has(t)).length / allTasks.length;
      Object.keys(week.skills).forEach(k => current[k] = (current[k] || 0) + (week.skills[k] * ratio));
    });
    const normalized: any = {};
    const max = this.totalPossibleSkills();
    Object.keys(current).forEach(k => normalized[k] = max[k] > 0 ? (current[k] / max[k]) * 100 : 0);
    return normalized;
  });

  // --- Helpers ---
  currentWeekData = computed(() => this.weeksData.find(w => w.id === this.selectedWeekId()));
  currentPhaseData = computed(() => this.phases.find(p => p.id === this.currentWeekData()?.phaseId));
  currentWeekSchedule = computed(() => this.detailedSchedule[this.selectedWeekId()] || []);
  currentDaySchedule = computed(() => this.currentWeekSchedule()[this.selectedDayIndex()] || this.currentWeekSchedule()[0]);
  currentDayLogs = computed(() => {
    const dayId = this.currentDaySchedule()?.day_id;
    return this.learningLogs().filter(l => l.dayId === dayId).sort((a, b) => b.timestamp - a.timestamp);
  });

  // 新增：依照模組/分類篩選（讓筆記不混在一起）
  filteredDayLogs = computed(() => {
    const filter = this.journalFilter();
    const logs = this.currentDayLogs();
    if (filter === 'all') return logs;
    return logs.filter(l => (l.type || 'idea') === filter);
  });

  // --- Actions ---
  selectWeek(id: number) { this.selectedWeekId.set(id); this.selectedDayIndex.set(0); this.journalFilter.set('all'); this.resetAI(); }
  selectDay(index: number) { this.selectedDayIndex.set(index); this.journalFilter.set('all'); }
  setTab(tab: 'roadmap' | 'interview' | 'project') { this.activeTab.set(tab); }

  setJournalFilter(filter: 'all' | 'theory' | 'code' | 'bug' | 'idea') { this.journalFilter.set(filter); }

  // 點左側模組卡片 -> 自動切分類 + 滾動到中間 Learning Journal
  openJournal(filter: 'all' | 'theory' | 'code' | 'bug' | 'idea') {
    this.journalFilter.set(filter);
    if (filter !== 'all') this.currentLogType.set(filter as any);
    queueMicrotask(() => {
      const el = this.journalSection()?.nativeElement as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  resetAI() { this.tutorResponse.set(''); this.tutorConcept.set(''); }

  toggleTask(task: string) {
    this.completedTasks.update(set => {
      const newSet = new Set(set);
      newSet.has(task) ? newSet.delete(task) : newSet.add(task);
      return newSet;
    });
  }
  isTaskCompleted(task: string) { return this.completedTasks().has(task); }

  // 新增：切換筆記類型（新增筆記用）
  setLogType(type: 'theory' | 'code' | 'bug' | 'idea') {
    this.currentLogType.set(type);
  }

  // 修改：儲存時加入 type
  addLog() {
    const content = this.currentLogInput().trim();
    if (!content) return;
    this.learningLogs.update(logs => [{ 
      id: crypto.randomUUID(), 
      dayId: this.currentDaySchedule()?.day_id, 
      timestamp: Date.now(), 
      content,
      type: this.currentLogType()
    }, ...logs]);
    this.currentLogInput.set('');
  }
  deleteLog(id: string) { this.learningLogs.update(logs => logs.filter(l => l.id !== id)); }

  // 新增：生成每日總結
  async generateDailySummary() {
    const logs = this.currentDayLogs().map(l => ({ type: l.type || 'idea', content: l.content }));
    const title = this.currentDaySchedule()?.title || 'Quant Study';
    
    this.tutorLoading.set(true);
    this.tutorConcept.set('每日學習總結');
    this.tutorResponse.set('');
    
    const summary = await this.geminiService.summarizeDailyLogs(logs, title);
    this.tutorResponse.set(summary);
    this.tutorLoading.set(false);
    
    this.learningLogs.update(prev => [{
      id: crypto.randomUUID(),
      dayId: this.currentDaySchedule()?.day_id,
      timestamp: Date.now(),
      content: `## 🤖 AI Daily Recap\n${summary}`,
      type: 'idea'
    }, ...prev]);
  }

  // --- Interview ---
  async generateQuestion() {
    this.interviewLoading.set(true);
    this.showAnswer.set(false);
    const q = await this.geminiService.generateInterviewQuestion();
    this.interviewQuestion.set(q.question);
    this.interviewAnswer.set(q.answer);
    this.interviewLoading.set(false);
  }

  toggleAnswer() { this.showAnswer.set(!this.showAnswer()); }

  // --- D3 ---
  drawRadarChart(skills: { [key: string]: number }) {
    if (!this.radarChartContainer()) return;
    const element = this.radarChartContainer()!.nativeElement;
    d3.select(element).selectAll('*').remove();
    const width = 300, height = 300, margin = 60, radius = Math.min(width, height) / 2 - margin;
    const svg = d3.select(element).append('svg').attr('width', width).attr('height', height).append('g').attr('transform', `translate(${width/2},${height/2})`);
    
    const axisConfig = [ { k: 'Math', l: '數學' }, { k: 'Coding', l: '程式' }, { k: 'Trading', l: '策略' }, { k: 'ML', l: '機器學習' }, { k: 'Micro', l: '微結構' } ];
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);
    const angleSlice = Math.PI * 2 / axisConfig.length;

    [20, 40, 60, 80, 100].forEach(level => {
      const coords = axisConfig.map((_, i) => ({ x: rScale(level) * Math.cos(angleSlice * i - Math.PI/2), y: rScale(level) * Math.sin(angleSlice * i - Math.PI/2) }));
      svg.append('path').datum([...coords, coords[0]]).attr('d', d3.line<any>().x(d=>d.x).y(d=>d.y)).attr('fill', 'none').attr('stroke', '#334155').attr('stroke-width', 1);
    });

    axisConfig.forEach((axis, i) => {
      const x = rScale(100) * Math.cos(angleSlice * i - Math.PI/2);
      const y = rScale(100) * Math.sin(angleSlice * i - Math.PI/2);
      svg.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x).attr('y2', y).attr('stroke', '#334155');
      svg.append('text').attr('x', x*1.12).attr('y', y*1.12).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#94a3b8').attr('font-size', 11).text(axis.l);
    });

    const points = axisConfig.map((axis, i) => {
      const val = skills[axis.k] || 0;
      return { x: rScale(val) * Math.cos(angleSlice * i - Math.PI/2), y: rScale(val) * Math.sin(angleSlice * i - Math.PI/2) };
    });

    svg.append('path')
      .datum([...points, points[0]])
      .attr('d', d3.line<any>().x(d=>d.x).y(d=>d.y))
      .attr('fill', 'rgba(34, 211, 238, 0.15)')
      .attr('stroke', 'rgba(34, 211, 238, 0.9)')
      .attr('stroke-width', 2);

    points.forEach(p => {
      svg.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 3).attr('fill', 'rgba(34, 211, 238, 1)');
    });
  }

  constructor() {
    effect(() => {
      const skills = this.currentEarnedSkills();
      this.drawRadarChart(skills);
    });
  }
}
