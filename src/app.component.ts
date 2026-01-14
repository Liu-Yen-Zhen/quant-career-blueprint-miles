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
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MarkdownModule, FormsModule],
  providers: [provideMarkdown()],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  radarChartContainer = viewChild<ElementRef>('radarChart');

  // --- State ---
  activeTab = signal<'roadmap' | 'interview' | 'project'>('roadmap');
  selectedWeekId = signal<number>(1);
  selectedDayIndex = signal<number>(0);

  // Completed Tasks & Logs (Persisted)
  completedTasks = signal<Set<string>>(new Set<string>());
  learningLogs = signal<LogEntry[]>([]);
  currentLogInput = signal<string>('');

  // AI & Interview State
  tutorLoading = signal<boolean>(false);
  tutorResponse = signal<string>('');
  tutorConcept = signal<string>('');
  interviewQuestion = signal<string>('');
  interviewAnswer = signal<string>('');
  showAnswer = signal<boolean>(false);
  interviewLoading = signal<boolean>(false);

  // --- Data Definitions ---
  phases = [
    { id: 1, name: '第一階段：量化基石', weeks: [1, 2, 3], color: 'text-cyan-400' },
    { id: 2, name: '第二階段：數據工程', weeks: [4, 5, 6], color: 'text-emerald-400' },
    { id: 3, name: '第三階段：策略與ML', weeks: [7, 8, 9, 10], color: 'text-purple-400' },
    { id: 4, name: '第四階段：專題與職涯', weeks: [11, 12], color: 'text-rose-400' }
  ];

  weeksData: WeekData[] = [
    { id: 1, phase: '量化基石', phaseId: 1, title: '概率論、統計學與量化面試思維', summary: '建立貝氏思維與概率直覺，這是通過頂尖自營商面試的第一道門檻。', keyConcepts: ['Bayesian Inference', 'Poisson Distribution', 'Signal-to-Noise Ratio', 'Survivorship Bias'], skills: { Math: 90, Coding: 60, Trading: 20, ML: 10, Micro: 30 } },
    { id: 2, phase: '量化基石', phaseId: 1, title: '市場微結構與訂單簿 (HFT 核心)', summary: '理解 LOB 動力學，這是 HFT 的物理學。深入分析 TAIFEX 與 Binance 的差異。', keyConcepts: ['Limit Order Book', 'Iceberg Orders', 'Market Impact', 'Adverse Selection'], skills: { Math: 70, Coding: 70, Trading: 40, ML: 20, Micro: 90 } },
    { id: 3, phase: '量化基石', phaseId: 1, title: '量化策略開發 (Alpha Research)', summary: '從動能策略到統計套利，尋找市場的 Alpha。', keyConcepts: ['Cointegration', 'Pairs Trading', 'Funding Rate', 'IC'], skills: { Math: 80, Coding: 60, Trading: 70, ML: 30, Micro: 40 } },
    { id: 4, phase: '數據工程', phaseId: 2, title: '事件驅動回測引擎構建', summary: '捨棄向量化回測，構建能模擬真實延遲的 Event-Driven 系統。', keyConcepts: ['Event-Driven', 'State Machine', 'Slippage', 'Backtest-to-Live'], skills: { Math: 40, Coding: 95, Trading: 50, ML: 20, Micro: 60 } },
    { id: 5, phase: '數據工程', phaseId: 2, title: '高頻交易 (HFT) 進階實作', summary: '造市商模型與市場摩擦模擬。', keyConcepts: ['Avellaneda-Stoikov', 'Inventory Risk', 'Latency', 'Rebate'], skills: { Math: 70, Coding: 90, Trading: 80, ML: 30, Micro: 80 } },
    { id: 6, phase: '數據工程', phaseId: 2, title: '數據工程與性能調優 (HPC)', summary: '利用 C++ 與優化技術處理金融大數據。', keyConcepts: ['Parquet', 'ZeroMQ', 'Multiprocessing', 'Cython'], skills: { Math: 30, Coding: 100, Trading: 20, ML: 20, Micro: 50 } },
    { id: 7, phase: '策略開發', phaseId: 3, title: '機器學習：特徵工程與標籤', summary: '挖掘訂單流中的 Alpha，使用 OFI 與 VPIN 指標。', keyConcepts: ['Triple Barrier', 'Fractional Diff', 'OFI', 'Feature Engineering'], skills: { Math: 60, Coding: 70, Trading: 40, ML: 80, Micro: 60 } },
    { id: 8, phase: '策略開發', phaseId: 3, title: '機器學習：模型訓練與驗證', summary: '使用 XGBoost 與 Purged K-Fold 預測價格。', keyConcepts: ['XGBoost', 'Purged K-Fold', 'LSTM', 'Meta-Labeling'], skills: { Math: 70, Coding: 70, Trading: 30, ML: 95, Micro: 40 } },
    { id: 9, phase: '策略開發', phaseId: 3, title: '強化學習 (RL) 與最優執行', summary: '將造市問題建模為 MDP，訓練 Agent 進行動態掛單。', keyConcepts: ['Reinforcement Learning', 'DQN', 'Smart Order Routing', 'Optimal Execution'], skills: { Math: 80, Coding: 80, Trading: 50, ML: 90, Micro: 70 } },
    { id: 10, phase: '策略開發', phaseId: 3, title: '風險管理、保證金與壓測', summary: '生存之本：VaR、壓力測試與資金管理。', keyConcepts: ['VaR', 'Kelly Criterion', 'Stress Testing', 'Margin Call'], skills: { Math: 90, Coding: 50, Trading: 90, ML: 30, Micro: 40 } },
    { id: 11, phase: '專題衝刺', phaseId: 4, title: '最終專題：Binance 高頻造市系統', summary: '綜合運用 NautilusTrader 與 RL，在 Binance 模擬環境部署實戰機器人。', keyConcepts: ['Docker', 'Live Trading', 'Latency Optimization', 'System Architecture'], skills: { Math: 70, Coding: 90, Trading: 80, ML: 80, Micro: 80 } },
    { id: 12, phase: '專題衝刺', phaseId: 4, title: '面試攻防與職涯衝刺', summary: '針對優式資本等頂尖自營商的行為面試與技術面試特訓。', keyConcepts: ['Behavioral Interview', 'Whiteboard Coding', 'System Design', 'Soft Skills'], skills: { Math: 60, Coding: 60, Trading: 90, ML: 50, Micro: 70 } }
  ];

  detailedSchedule: { [key: number]: DailyTask[] } = {
    1: [
      { day_id: "W1D1", title: "機率論、貝氏定理與大數法則", am: { topic: "機率論基礎", tasks: ["研讀貝氏定理", "推導期望值方差", "Heard on Street 機率題"] }, pm: { topic: "Python NumPy", tasks: ["向量化運算", "NumPy Broadcasting", "計算協方差矩陣"] }, night: { topic: "LeetCode: Array", tasks: ["Two Sum", "Best Time to Buy Stock", "Product Except Self"] }, yushi_focus: "優式重視代碼效率。確保 NumPy 運算不含 Python 原生迴圈。" },
      { day_id: "W1D2", title: "分佈特徵：肥尾與偏度", am: { topic: "市場分佈", tasks: ["Normal vs Log-normal", "Jarque-Bera Test", "泊松分佈與訂單"] }, pm: { topic: "Pandas 優化", tasks: ["數據降位存儲", "Rolling 加速", "清洗 Tick Data"] }, night: { topic: "LeetCode: Array", tasks: ["Max Subarray", "3Sum", "Rotate Image"] }, yushi_focus: "理解泊松分佈與 HFT 掛單時間的關係。" },
      { day_id: "W1D3", title: "時間序列基礎", am: { topic: "平穩性檢定", tasks: ["ADF & KPSS Test", "隨機漫步", "幾何機率"] }, pm: { topic: "Plotly 視覺化", tasks: ["動態指標 Dash", "相關性熱力圖", "Volume Profile"] }, night: { topic: "LeetCode: Hash", tasks: ["Group Anagrams", "Longest Consecutive"] }, yushi_focus: "回測時需嚴格過濾前視偏誤。" },
      { day_id: "W1D4", title: "線性代數與降維", am: { topic: "PCA 應用", tasks: ["SVD 分解", "PCA 穩定狀態", "面試題腦力激盪"] }, pm: { topic: "Numba 加速", tasks: ["@njit 優化 BS公式", "效能比較", "Cython 基礎"] }, night: { topic: "LeetCode: Window", tasks: ["Longest Substring", "Repeating Replace"] }, yushi_focus: "利用 Numba 將運算加速至毫秒等級。" },
      { day_id: "W1D5", title: "面試思維總結", am: { topic: "凱利公式", tasks: ["推導 Kelly Criterion", "聖彼得堡悖論", "數學筆記整理"] }, pm: { topic: "數據存儲", tasks: ["Parquet vs CSV", "構建本地資料庫", "Data Loader"] }, night: { topic: "Review", tasks: ["週複習", "撰寫 Medium"] }, yushi_focus: "展現技術文檔能力，證明溝通效率。" }
    ],
    2: [
      { day_id: "W2D1", title: "訂單簿 (LOB) 理論", am: { topic: "L1/L2/L3", tasks: ["Spread 形成", "LOB 結構", "訂單到達率"] }, pm: { topic: "LOB 模擬器", tasks: ["OrderBook Class", "add/cancel 邏輯", "隊列排序優化"] }, night: { topic: "LeetCode: Two Pointers", tasks: ["Container Water", "Trapping Rain"] }, yushi_focus: "解釋 Spread 形成與滑價。" },
      { day_id: "W2D2", title: "撮合引擎", am: { topic: "撮合邏輯", tasks: ["FIFO 原則", "Maker/Taker 費率", "訂單流失計算"] }, pm: { topic: "WebSocket API", tasks: ["Binance API", "斷線重連", "Tick 存儲"] }, night: { topic: "LeetCode: Stack", tasks: ["Valid Parentheses", "Temperatures"] }, yushi_focus: "理解 TAIFEX 與 Crypto 撮合差異。" },
      { day_id: "W2D3", title: "毒性流量", am: { topic: "VPIN 指標", tasks: ["VPIN 原理", "逆向選擇風險", "存貨風險"] }, pm: { topic: "OFI 實作", tasks: ["Order Flow Imbalance", "VPIN 腳本", "指標相關性"] }, night: { topic: "LeetCode: Binary Search", tasks: ["Rotated Array", "Median Two Arrays"] }, yushi_focus: "OFI 是 HFT 最強短期預測指標。" },
      { day_id: "W2D4", title: "市場衝擊", am: { topic: "Almgren-Chriss", tasks: ["平方根法則", "永久/暫時衝擊", "滑價模型"] }, pm: { topic: "成交機率模擬", tasks: ["限價單成交估算", "隊列位置模擬", "滑價測試"] }, night: { topic: "LeetCode: Linked List", tasks: ["Reverse List", "Merge Lists"] }, yushi_focus: "忽略衝擊成本將導致回測失真。" },
      { day_id: "W2D5", title: "微結構總結", am: { topic: "面試準備", tasks: ["延遲來源分析", "冰山訂單", "LOB 筆記"] }, pm: { topic: "Asyncio", tasks: ["異步數據架構", "Producer-Consumer", "LOB 更新優化"] }, night: { topic: "Output", tasks: ["微結構文章發布"] }, yushi_focus: "將特徵計算延遲降至微秒級。" }
    ],
    3: [
      { day_id: "W3D1", title: "動能策略", am: { topic: "動能原理", tasks: ["自相關性", "Z-score 正規化", "市場無效率"] }, pm: { topic: "策略實作", tasks: ["Donchian Channel", "波幅計算", "ATR 停損"] }, night: { topic: "LeetCode: Trees", tasks: ["Max Depth", "Invert Tree"] }, yushi_focus: "重視 MDD 與夏普比率。" },
      { day_id: "W3D2", title: "均值回歸", am: { topic: "OU 過程", tasks: ["Ornstein-Uhlenbeck", "協整檢定", "均值回歸原理"] }, pm: { topic: "Pairs Trading", tasks: ["相關性篩選", "Spread Z-score", "門檻回測"] }, night: { topic: "LeetCode: Trees", tasks: ["Validate BST", "LCA"] }, yushi_focus: "Pairs Trading 需注意 Regime Shift。" },
      { day_id: "W3D3", title: "期現套利", am: { topic: "基差與費率", tasks: ["Basis 變動", "Funding Rate", "三角套利"] }, pm: { topic: "套利模擬", tasks: ["期現數據串接", "成本計算", "費率轉折"] }, night: { topic: "LeetCode: Tries", tasks: ["Implement Trie", "Word Search II"] }, yushi_focus: "Binance 資金費率是 Alpha 來源。" },
      { day_id: "W3D4", title: "因子分析", am: { topic: "IC 與衰減", tasks: ["Information Coeff", "因子周轉率", "解釋力分析"] }, pm: { topic: "因子回測", tasks: ["分層回測", "累積收益", "市況分析"] }, night: { topic: "LeetCode: Heap", tasks: ["Kth Largest", "Top K Frequent"] }, yushi_focus: "回測務必包含手續費與滑價。" },
      { day_id: "W3D5", title: "組合優化", am: { topic: "風險平價", tasks: ["Risk Parity", "馬可維茲優化", "策略邏輯整理"] }, pm: { topic: "相關性過濾", tasks: ["相關性矩陣", "剔除冗餘", "信號合併"] }, night: { topic: "Output", tasks: ["Alpha 研究日誌"] }, yushi_focus: "嚴格驗證展現交易紀律。" }
    ],
    4: [
      { day_id: "W4D1", title: "回測引擎設計", am: { topic: "事件驅動", tasks: ["Event Loop 設計", "DataHandler", "延遲模擬"] }, pm: { topic: "Event Queue", tasks: ["Queue 基類", "Market/Signal Event", "數據餵送"] }, night: { topic: "LeetCode: Backtrack", tasks: ["Subsets", "Combination Sum"] }, yushi_focus: "引擎需模擬 Tick-by-Tick。" },
      { day_id: "W4D2", title: "持倉管理", am: { topic: "Portfolio", tasks: ["持倉追蹤", "Unrealized PnL", "訂單狀態機"] }, pm: { topic: "持倉系統", tasks: ["Signal 轉 Order", "現金更新", "訂單追蹤"] }, night: { topic: "LeetCode: Backtrack", tasks: ["Word Search", "Permutations"] }, yushi_focus: "狀態機是掛單確認關鍵。" },
      { day_id: "W4D3", title: "執行模擬", am: { topic: "Execution", tasks: ["FillEvent", "滑價模型", "限價單撮合"] }, pm: { topic: "撮合器實作", tasks: ["ExecutionHandler", "成交機率", "部分成交"] }, night: { topic: "LeetCode: Graphs", tasks: ["Num Islands", "Clone Graph"] }, yushi_focus: "模擬真實隊列位置。" },
      { day_id: "W4D4", title: "績效指標", am: { topic: "Risk Metrics", tasks: ["Sharpe/Sortino", "Time Underwater", "日誌分析"] }, pm: { topic: "報告生成", tasks: ["權益曲線", "統計摘要", "月度分佈"] }, night: { topic: "LeetCode: Graphs", tasks: ["Course Schedule", "Pacific Atlantic"] }, yushi_focus: "穩定 Alpha 優於暴利。" },
      { day_id: "W4D5", title: "系統整合", am: { topic: "偏誤檢查", tasks: ["Look-ahead Check", "延遲影響", "一致性分析"] }, pm: { topic: "整合測試", tasks: ["策略運行測試", "向量 vs 事件", "速度優化"] }, night: { topic: "Output", tasks: ["回測引擎文章"] }, yushi_focus: "參考 NautilusTrader 架構。" }
    ],
    5: [
      { day_id: "W5D1", title: "A-S 模型", am: { topic: "Avellaneda-Stoikov", tasks: ["最優報價推導", "庫存風險參數", "Spread/Vol"] }, pm: { topic: "造市算法", tasks: ["庫存 Skew", "撮合模擬", "風險厭惡測試"] }, night: { topic: "LeetCode: DP", tasks: ["Climbing Stairs", "Coin Change"] }, yushi_focus: "庫存高時需擴大 Spread。" },
      { day_id: "W5D2", title: "延遲影響", am: { topic: "Latency", tasks: ["Tick-to-Trade", "Colocation", "延遲套利"] }, pm: { topic: "Cython 優化", tasks: ["函數封裝", "循環緩衝", "解析速度"] }, night: { topic: "LeetCode: DP", tasks: ["Palindromic Sub", "Word Break"] }, yushi_focus: "部署於機房降低延遲。" },
      { day_id: "W5D3", title: "回扣與競爭", am: { topic: "Maker-Taker", tasks: ["Rebate 機制", "HFT 獲利", "優先權競爭"] }, pm: { topic: "Rebate 策略", tasks: ["掛單獎勵", "費率測試", "成交質量"] }, night: { topic: "LeetCode: DP", tasks: ["LIS", "Palindromic Subs"] }, yushi_focus: "精確計算費率是核心。" },
      { day_id: "W5D4", title: "HFT 風控", am: { topic: "斷路器", tasks: ["Self-trade 防範", "規模限制", "胖手指"] }, pm: { topic: "過濾層實作", tasks: ["Execution 風控", "極端行情撤單", "日誌系統"] }, night: { topic: "LeetCode: Greedy", tasks: ["Max Subarray", "Jump Game"] }, yushi_focus: "風控是交易員生命線。" },
      { day_id: "W5D5", title: "壓測與總結", am: { topic: "獲利來源", tasks: ["Edge 分析", "延遲優化表", "微結構面試"] }, pm: { topic: "行情回放", tasks: ["Flash Crash 數據", "高負載測試", "Hot Path"] }, night: { topic: "Output", tasks: ["A-S 模型實戰"] }, yushi_focus: "優化序列化延遲。" }
    ],
    6: [
      { day_id: "W6D1", title: "存儲架構", am: { topic: "Parquet", tasks: ["Chunking", "mmap", "列式存儲"] }, pm: { topic: "讀取器實作", tasks: ["多執行緒加載", "壓縮優化", "TB 級檢索"] }, night: { topic: "LeetCode: Intervals", tasks: ["Insert Interval", "Merge Intervals"] }, yushi_focus: "用 Parquet 節省記憶體。" },
      { day_id: "W6D2", title: "並行計算", am: { topic: "Multiprocessing", tasks: ["Shared Memory", "Ray 框架", "GIL 影響"] }, pm: { topic: "回測加速", tasks: ["多核分配", "參數掃描", "加速比測試"] }, night: { topic: "LeetCode: Intervals", tasks: ["Non-overlap", "Meeting Rooms"] }, yushi_focus: "參數掃描從天降至分。" },
      { day_id: "W6D3", title: "網路通訊", am: { topic: "ZeroMQ", tasks: ["UDP vs TCP", "二進制協議", "傳輸延遲"] }, pm: { topic: "消息總線", tasks: ["ZMQ 通訊", "二進制格式", "延遲測試"] }, night: { topic: "LeetCode: List", tasks: ["Remove Nth", "Reorder List"] }, yushi_focus: "理解完整延遲路徑。" },
      { day_id: "W6D4", title: "C++ 整合", am: { topic: "Pybind11", tasks: ["數據交換", "GC 干擾", "STL 應用"] }, pm: { topic: "C++ 組件", tasks: ["算法封裝", "指標計算", "Python 整合"] }, night: { topic: "LeetCode: Heap", tasks: ["Median Stream"] }, yushi_focus: "C++ 能力是巨大加分。" },
      { day_id: "W6D5", title: "性能調優", am: { topic: "Profiling", tasks: ["cProfile", "CPU Cache", "優化清單"] }, pm: { topic: "全面優化", tasks: ["火焰圖分析", "重構瓶頸", "基準測試"] }, night: { topic: "Output", tasks: ["高效優化實戰"] }, yushi_focus: "優化是為了系統穩定。" }
    ],
    7: [
      { day_id: "W7D1", title: "標籤法", am: { topic: "Triple Barrier", tasks: ["方法原理", "固定標籤缺點", "Meta-Labeling"] }, pm: { topic: "標籤實作", tasks: ["動態波幅屏障", "信號生成", "分佈視覺化"] }, night: { topic: "LeetCode: Binary", tasks: ["Find Min Rotated"] }, yushi_focus: "將風控融入模型目標。" },
      { day_id: "W7D2", title: "分數差分", am: { topic: "FracDiff", tasks: ["平穩性矛盾", "ADF 檢定", "權重窗口"] }, pm: { topic: "特徵轉換", tasks: ["差分函數", "ADF 驗證", "記憶性保留"] }, night: { topic: "LeetCode: Binary", tasks: ["Koko Bananas"] }, yushi_focus: "量化市場情緒。" },
      { day_id: "W7D3", title: "微結構特徵", am: { topic: "OFI 壓力", tasks: ["不平衡度", "壓力集中", "自相關性"] }, pm: { topic: "特徵提取", tasks: ["Tick 轉因子", "熱力圖", "重要性評估"] }, night: { topic: "LeetCode: Window", tasks: ["Min Window Sub"] }, yushi_focus: "VPIN 具預測力。" },
      { day_id: "W7D4", title: "特徵選擇", am: { topic: "降維", tasks: ["RFE", "UMAP/t-SNE", "因子擁擠"] }, pm: { topic: "篩選 Pipeline", tasks: ["隨機森林評估", "剔除相關", "PCA"] }, night: { topic: "LeetCode: Stack", tasks: ["Reverse Polish"] }, yushi_focus: "樹模型優於神經網絡。" },
      { day_id: "W7D5", title: "Feature Store", am: { topic: "Look-ahead", tasks: ["特徵字典", "漂移分析", "面試防範"] }, pm: { topic: "存儲系統", tasks: ["讀寫接口", "Point-in-time", "矩陣生成"] }, night: { topic: "Output", tasks: ["特徵工程實戰"] }, yushi_focus: "提升研究效率。" }
    ],
    8: [
      { day_id: "W8D1", title: "交叉驗證", am: { topic: "Purged K-Fold", tasks: ["Purging/Embargo", "數據洩漏", "金融特殊性"] }, pm: { topic: "驗證實作", tasks: ["分割函數", "清洗間隔", "標準流程"] }, night: { topic: "LeetCode: DP", tasks: ["LCS"] }, yushi_focus: "防止數據洩漏。" },
      { day_id: "W8D2", title: "GBDT", am: { topic: "XGBoost", tasks: ["不平衡處理", "自定義 Loss", "參數調優"] }, pm: { topic: "模型訓練", tasks: ["超參數優化", "PR/ROC 曲線", "權重調整"] }, night: { topic: "LeetCode: DP", tasks: ["Edit Distance"] }, yushi_focus: "XGBoost 是表格王者。" },
      { day_id: "W8D3", title: "LSTM", am: { topic: "RNN/LSTM", tasks: ["梯度問題", "TCN 優勢", "序列預測"] }, pm: { topic: "價格預測", tasks: ["PyTorch 架構", "窗口生成", "Loss 監控"] }, night: { topic: "LeetCode: Trees", tasks: ["Max Path Sum"] }, yushi_focus: "優先精通 XGBoost。" },
      { day_id: "W8D4", title: "模型集成", am: { topic: "Stacking", tasks: ["集成策略", "Meta-Labeling", "權重分配"] }, pm: { topic: "二階段過濾", tasks: ["方向預測", "信心過濾", "回測提升"] }, night: { topic: "LeetCode: Graphs", tasks: ["Longest Consec"] }, yushi_focus: "Meta-Labeling 提升夏普。" },
      { day_id: "W8D5", title: "穩定性分析", am: { topic: "評估指標", tasks: ["過擬合對策", "信號解釋", "面試準備"] }, pm: { topic: "穩定性測試", tasks: ["OOS 測試", "年份分析", "回測報告"] }, night: { topic: "Output", tasks: ["ML 應用實戰"] }, yushi_focus: "重視可解釋性。" }
    ],
    9: [
      { day_id: "W9D1", title: "RL 基礎", am: { topic: "MDP", tasks: ["馬可夫決策", "Epsilon-greedy", "交易定位"] }, pm: { topic: "Gym 環境", tasks: ["Action/State", "Reward 設計", "訓練循環"] }, night: { topic: "LeetCode: Bit", tasks: ["Num 1 Bits", "Counting Bits"] }, yushi_focus: "懲罰庫存積壓。" },
      { day_id: "W9D2", title: "DQN", am: { topic: "Deep Q", tasks: ["Exp Replay", "Target Network", "Q 函數"] }, pm: { topic: "Agent 訓練", tasks: ["網路整合", "Reward 變化", "行為觀察"] }, night: { topic: "LeetCode: Math", tasks: ["Happy Number", "Plus One"] }, yushi_focus: "庫存多時積極拋售。" },
      { day_id: "W9D3", title: "最優執行", am: { topic: "VWAP/TWAP", tasks: ["拆單", "執行缺口", "拆分策略"] }, pm: { topic: "執行器", tasks: ["量分佈拆單", "頻率調整", "Slippage 計算"] }, night: { topic: "LeetCode: Array", tasks: ["Product Except"] }, yushi_focus: "RL 在執行有優勢。" },
      { day_id: "W9D4", title: "SOR", am: { topic: "智能路由", tasks: ["跨所掃描", "衝擊減少", "路徑優化"] }, pm: { topic: "路由邏輯", tasks: ["多所模擬", "選擇模型", "滑價優化"] }, night: { topic: "LeetCode: Backtrack", tasks: ["Parentheses"] }, yushi_focus: "多交易所流動性分配。" },
      { day_id: "W9D5", title: "整合回測", am: { topic: "執行專題", tasks: ["優化指標", "品質衡量", "衝擊降低"] }, pm: { topic: "端到端", tasks: ["RL+執行", "壓力測試", "績效報告"] }, night: { topic: "Output", tasks: ["RL 造市系統"] }, yushi_focus: "展示速度外優勢。" }
    ],
    10: [
      { day_id: "W10D1", title: "風險度量", am: { topic: "VaR", tasks: ["Value at Risk", "CVaR", "風險分解"] }, pm: { topic: "VaR 工具", tasks: ["歷史模擬", "回溯測試", "趨勢圖"] }, night: { topic: "LeetCode: Matrix", tasks: ["Set Zeroes", "Spiral"] }, yushi_focus: "如何處理爆倉？" },
      { day_id: "W10D2", title: "資金管理", am: { topic: "Kelly", tasks: ["多策略應用", "風險縮放", "部位控制"] }, pm: { topic: "部位規模", tasks: ["波幅調整", "槓桿控制", "MDD 影響"] }, night: { topic: "LeetCode: String", tasks: ["Palindromic"] }, yushi_focus: "風控是生存之本。" },
      { day_id: "W10D3", title: "保證金", am: { topic: "Margin", tasks: ["維持保證金", "Crypto 機制", "跨抵押"] }, pm: { topic: "強平模擬", tasks: ["占用更新", "強平警報", "安全邊際"] }, night: { topic: "LeetCode: Heap", tasks: ["Merge k Lists"] }, yushi_focus: "理解強平與保險基金。" },
      { day_id: "W10D4", title: "壓力測試", am: { topic: "Stress Test", tasks: ["蒙地卡羅", "歷史劇變", "相關性崩潰"] }, pm: { topic: "蒙地卡羅", tasks: ["萬次模擬", "崩潰點", "應對報告"] }, night: { topic: "LeetCode: Graphs", tasks: ["Word Ladder"] }, yushi_focus: "展現抗壓性。" },
      { day_id: "W10D5", title: "風控整合", am: { topic: "面試專題", tasks: ["斷路器清單", "異常重啟", "風險筆記"] }, pm: { topic: "全系統", tasks: ["監控整合", "延遲測試", "風控報表"] }, night: { topic: "Output", tasks: ["風險管理實戰"] }, yushi_focus: "策略的底座。" }
    ],
    11: [
      { day_id: "W11D1", title: "專題修訂", am: { topic: "組件整合", tasks: ["接口對齊", "Docker 環境", "GitHub 結構"] }, pm: { topic: "數據同構", tasks: ["回測實盤一致", "回放工具", "一致性驗證"] }, night: { topic: "LeetCode: Hard", tasks: ["Sliding Window"] }, yushi_focus: "代碼一致性。" },
      { day_id: "W11D2", title: "模型調優", am: { topic: "參數優化", tasks: ["Gamma 回饋", "滑價調整", "穩定性"] }, pm: { topic: "模擬盤", tasks: ["Paper Trading", "PnL 記錄", "表現比對"] }, night: { topic: "LeetCode: Hard", tasks: ["Sudoku"] }, yushi_focus: "追求完美。" },
      { day_id: "W11D3", title: "部署監控", am: { topic: "文檔", tasks: ["README", "API 文檔", "代碼重構"] }, pm: { topic: "監控系統", tasks: ["Docker 部署", "Grafana", "報警"] }, night: { topic: "LeetCode: Hard", tasks: ["Valid Paren"] }, yushi_focus: "工程實踐加分。" },
      { day_id: "W11D4", title: "展示準備", am: { topic: "投影片", tasks: ["架構圖", "Edge 解釋", "績效表"] }, pm: { topic: "基準測試", tasks: ["延遲測試", "性能圖表", "分析報告"] }, night: { topic: "LeetCode: Hard", tasks: ["N-Queens"] }, yushi_focus: "解釋解決了什麼難題。" },
      { day_id: "W11D5", title: "專題總結", am: { topic: "回顧", tasks: ["改進方向", "上傳 GitHub", "解說文檔"] }, pm: { topic: "Demo", tasks: ["錄製影片", "QA 演練", "註解檢查"] }, night: { topic: "LeetCode", tasks: ["複習錯題"] }, yushi_focus: "生存決心。" }
    ],
    12: [
      { day_id: "W12D1", title: "JD 與經歷", am: { topic: "JD 解析", tasks: ["公司文化", "STAR 經歷", "自我介紹"] }, pm: { topic: "算法複習", tasks: ["排序搜尋", "DP 圖論", "白板練習"] }, night: { topic: "Math", tasks: ["綠皮書 50 題"] }, yushi_focus: "強調 Python 高效能。" },
      { day_id: "W12D2", title: "技術複習", am: { topic: "微結構", tasks: ["LOB 延遲", "優化方法", "HFT 案例"] }, pm: { topic: "ML 面試", tasks: ["過擬合", "可解釋性", "數據處理"] }, night: { topic: "Math", tasks: ["期望值漫步"] }, yushi_focus: "針對 JD 關鍵字。" },
      { day_id: "W12D3", title: "行為面試", am: { topic: "行為題", tasks: ["壓力失敗", "動機", "職涯規劃"] }, pm: { topic: "專案追問", tasks: ["Bug 解決", "異常重啟", "資金決策"] }, night: { topic: "Math", tasks: ["馬可夫鏈"] }, yushi_focus: "反脆弱性。" },
      { day_id: "W12D4", title: "模擬面試", am: { topic: "全流程", tasks: ["演練", "表達分析", "邏輯優化"] }, pm: { topic: "投遞", tasks: ["成果檢查", "GitHub", "申請"] }, night: { topic: "Mindset", tasks: ["心智圖"] }, yushi_focus: "冷靜自信。" },
      { day_id: "W12D5", title: "任務達成", am: { topic: "Checkbox", tasks: ["代碼展示", "總結感謝", "公式複習"] }, pm: { topic: "社群", tasks: ["面試反饋", "市場關注", "交流"] }, night: { topic: "Celebrate", tasks: ["100% 完成"] }, yushi_focus: "只是開始。" }
    ]
  };

  constructor() {
    // Load persisted state
    this.completedTasks.set(new Set(JSON.parse(localStorage.getItem('quant_tasks') || '[]')));
    
    try {
      const savedLogs = localStorage.getItem('quant_learning_logs');
      if (savedLogs) this.learningLogs.set(JSON.parse(savedLogs));
    } catch (e) {
      console.warn('Failed to parse logs', e);
    }

    // Persist effects
    effect(() => {
      localStorage.setItem('quant_tasks', JSON.stringify(Array.from(this.completedTasks())));
    });

    effect(() => {
      localStorage.setItem('quant_learning_logs', JSON.stringify(this.learningLogs()));
    });

    // Draw Chart
    effect(() => {
      const skills = this.currentEarnedSkills();
      if (this.activeTab() === 'roadmap') {
        setTimeout(() => this.drawRadarChart(skills), 100);
      }
    });
  }

  // --- Computed Skills ---
  totalPossibleSkills = computed(() => {
    const total: { [key: string]: number } = { Math: 0, Coding: 0, Trading: 0, ML: 0, Micro: 0 };
    this.weeksData.forEach(w => Object.keys(w.skills).forEach(k => total[k] = (total[k] || 0) + w.skills[k]));
    return total;
  });

  currentEarnedSkills = computed(() => {
    const current: { [key: string]: number } = { Math: 0, Coding: 0, Trading: 0, ML: 0, Micro: 0 };
    const completed = this.completedTasks();
    this.weeksData.forEach(week => {
      const weekTasks = this.detailedSchedule[week.id];
      if (!weekTasks) return;
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

  // --- Actions ---
  selectWeek(id: number) { this.selectedWeekId.set(id); this.selectedDayIndex.set(0); this.resetAI(); }
  selectDay(index: number) { this.selectedDayIndex.set(index); }
  setTab(tab: 'roadmap' | 'interview' | 'project') { this.activeTab.set(tab); }
  resetAI() { this.tutorResponse.set(''); this.tutorConcept.set(''); }

  toggleTask(task: string) {
    this.completedTasks.update(set => {
      const newSet = new Set(set);
      newSet.has(task) ? newSet.delete(task) : newSet.add(task);
      return newSet;
    });
  }
  isTaskCompleted(task: string) { return this.completedTasks().has(task); }

  addLog() {
    const content = this.currentLogInput().trim();
    if (!content) return;
    this.learningLogs.update(logs => [{ id: crypto.randomUUID(), dayId: this.currentDaySchedule()?.day_id, timestamp: Date.now(), content }, ...logs]);
    this.currentLogInput.set('');
  }
  deleteLog(id: string) { this.learningLogs.update(logs => logs.filter(l => l.id !== id)); }

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

    // Grid
    [20, 40, 60, 80, 100].forEach(level => {
      const coords = axisConfig.map((_, i) => ({ x: rScale(level) * Math.cos(angleSlice * i - Math.PI/2), y: rScale(level) * Math.sin(angleSlice * i - Math.PI/2) }));
      svg.append('path').datum([...coords, coords[0]]).attr('d', d3.line<any>().x(d=>d.x).y(d=>d.y)).attr('fill', 'none').attr('stroke', '#334155').attr('stroke-width', 1);
    });

    // Axes
    axisConfig.forEach((axis, i) => {
      const x = rScale(100) * Math.cos(angleSlice * i - Math.PI/2);
      const y = rScale(100) * Math.sin(angleSlice * i - Math.PI/2);
      svg.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x).attr('y2', y).attr('stroke', '#334155');
      svg.append('text').attr('x', x * 1.15).attr('y', y * 1.15).text(axis.l).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#94a3b8').style('font-size', '12px');
    });

    // Data
    const dataCoords = axisConfig.map((axis, i) => ({ x: rScale(skills[axis.k] || 0) * Math.cos(angleSlice * i - Math.PI/2), y: rScale(skills[axis.k] || 0) * Math.sin(angleSlice * i - Math.PI/2) }));
    svg.append('path').datum([...dataCoords, dataCoords[0]]).attr('d', d3.line<any>().x(d=>d.x).y(d=>d.y)).attr('fill', 'rgba(20, 184, 166, 0.2)').attr('stroke', '#14b8a6').attr('stroke-width', 2);
    
    // Points
    dataCoords.forEach(p => svg.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 4).attr('fill', '#14b8a6'));
  }

  // --- AI Wrappers ---
  async askAiTutor(concept: string) {
    this.tutorLoading.set(true); this.tutorConcept.set(concept); this.tutorResponse.set('');
    this.tutorResponse.set(await this.geminiService.explainConcept(concept, this.currentWeekData()?.summary || ''));
    this.tutorLoading.set(false);
  }

  async generateQuestion() {
    this.interviewLoading.set(true); this.showAnswer.set(false); this.interviewQuestion.set('');
    const res = await this.geminiService.generateInterviewQuestion();
    this.interviewQuestion.set(res.question); this.interviewAnswer.set(res.answer);
    this.interviewLoading.set(false);
  }
  toggleAnswer() { this.showAnswer.update(v => !v); }
}