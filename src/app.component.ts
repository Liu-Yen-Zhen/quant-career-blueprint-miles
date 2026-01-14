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
    { id: 1, name: '第一階段：量化基石與計算思維', weeks: [1, 2, 3], color: 'text-cyan-400', border: 'border-cyan-400' },
    { id: 2, name: '第二階段：數據工程與事件驅動', weeks: [4, 5, 6], color: 'text-emerald-400', border: 'border-emerald-400' },
    { id: 3, name: '第三階段：策略開發與機器學習', weeks: [7, 8, 9, 10], color: 'text-purple-400', border: 'border-purple-400' },
    { id: 4, name: '第四階段：專題產出與職涯衝刺', weeks: [11, 12], color: 'text-rose-400', border: 'border-rose-400' }
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

  // Map of Week ID to detailed daily schedule
  detailedSchedule: { [key: number]: DailyTask[] } = {
    1: [
      { day_id: "W1D1", title: "機率論、貝氏定理與大數法則", am: { topic: "機率論基礎與貝氏推論", tasks: ["研讀貝氏定理公式 $P(A|B)$", "推導隨機變數期望值與方差", "解題：Heard on the Street 機率前 5 題"] }, pm: { topic: "Python 高性能運算：NumPy", tasks: ["實作向量化運算 (Vectorization)", "撰寫 NumPy Broadcasting 練習", "計算資產報酬率協方差矩陣"] }, night: { topic: "LeetCode: Array 專題", tasks: ["Two Sum", "Best Time to Buy and Sell Stock", "Product of Array Except Self"] }, yushi_focus: "優式重視代碼效率。確保 NumPy 運算不含 Python 原生迴圈，並能解釋信噪比 (SNR)。" },
      { day_id: "W1D2", title: "分佈特徵：肥尾與偏度", am: { topic: "機率分佈的市場映射", tasks: ["比較 Normal vs Log-normal 分佈", "學習 Jarque-Bera Test 檢定", "研讀泊松分佈與訂單到達率"] }, pm: { topic: "Pandas：數據清洗與記憶體優化", tasks: ["實作數據降位存儲 (float64->32)", "撰寫自定義 Rolling 加速器", "清洗 Tick Data 異常值"] }, night: { topic: "LeetCode: Array 專題", tasks: ["Maximum Subarray", "3Sum", "Rotate Image"] }, yushi_focus: "理解泊松分佈 $\\lambda$ 如何對應到 HFT 的掛單時間，並關注肥尾效應 (Fat Tails)。" },
      { day_id: "W1D3", title: "時間序列基礎與平穩性", am: { topic: "平穩性檢定理論", tasks: ["研讀 ADF Test 與 KPSS Test", "理解隨機漫步 (Random Walk)", "幾何機率問題練習"] }, pm: { topic: "視覺化：Plotly 互動式圖表", tasks: ["開發動態指標 Dash 預型", "繪製相關性熱力圖", "實作 Volume Profile 圖表"] }, night: { topic: "LeetCode: Hash Table", tasks: ["Group Anagrams", "Longest Consecutive Sequence"] }, yushi_focus: "回測時需嚴格過濾前視偏誤 (Look-ahead Bias) 與倖存者偏差。" },
      { day_id: "W1D4", title: "線性代數：PCA 與降維", am: { topic: "PCA 在因子解釋力的應用", tasks: ["推導 SVD 分解", "理解 PCA 與穩定狀態計算", "腦力激盪：經典面試題衝刺"] }, pm: { topic: "高性能：Numba JIT 加速", tasks: ["使用 @njit 優化 Black-Scholes", "比較 Python/NumPy/Numba 效能", "實作簡單的 Cython 編譯"] }, night: { topic: "LeetCode: Sliding Window", tasks: ["Longest Substring", "Longest Repeating Replacement"] }, yushi_focus: "優式重視代碼性能。利用 Numba 將運算加速至毫秒等級。" },
      { day_id: "W1D5", title: "面試思維與本週總結", am: { topic: "凱利公式與勝率估算", tasks: ["推導 Kelly Criterion", "分析聖彼得堡悖論", "整理數學推導筆記"] }, pm: { topic: "數據存儲：Parquet 與 HDF5", tasks: ["測試 CSV/Parquet 讀寫速度", "建立本地量化資料庫雛型", "封裝 Data Loader 類別"] }, night: { topic: "週複習與 Medium 產出", tasks: ["重刷本週錯題", "撰寫 Medium 學習總結：量化面試機率直覺"] }, yushi_focus: "展現良好的技術文檔能力，這代表你能與團隊高效溝通研究結果。" }
    ],
    2: [
      { day_id: "W2D1", title: "訂單簿 (LOB) 基本理論", am: { topic: "L1/L2/L3 數據差異", tasks: ["理解買賣價差 (Spread) 形成", "研讀 LOB 快照結構", "泊松過程下的訂單到達率"] }, pm: { topic: "實作 LOB 模擬器", tasks: ["建立 OrderBook 類別", "實作 add/cancel order 邏輯", "優化限價單隊列排序"] }, night: { topic: "LeetCode: Two Pointers", tasks: ["Container With Most Water", "Trapping Rain Water"] }, yushi_focus: "解釋 Bid-Ask Spread 形成原因與滑價 (Slippage)。" },
      { day_id: "W2D2", title: "撮合引擎與 Maker/Taker", am: { topic: "撮合引擎邏輯", tasks: ["價格/時間優先原則 (FIFO)", "理解 Maker 與 Taker 費率差異", "計算訂單流失 (Attrition)"] }, pm: { topic: "WebSocket 數據實戰", tasks: ["串接 Binance/Shioaji API", "實作斷線重連機制", "存儲實時 Tick 數據"] }, night: { topic: "LeetCode: Stack", tasks: ["Valid Parentheses", "Daily Temperatures"] }, yushi_focus: "理解 TAIFEX 與加密貨幣市場的撮合機制差異。" },
      { day_id: "W2D3", title: "資訊不對稱與毒性流量", am: { topic: "VPIN 與知情交易者", tasks: ["學習 VPIN 指標原理", "理解逆向選擇風險 (Adverse Selection)", "分析做市商存貨風險"] }, pm: { topic: "指標實作：OFI 與 VPIN", tasks: ["實作 Order Flow Imbalance (OFI)", "撰寫 VPIN 計算腳本", "測試指標與價格變動相關性"] }, night: { topic: "LeetCode: Binary Search", tasks: ["Search in Rotated Sorted Array", "Median of Two Sorted Arrays"] }, yushi_focus: "OFI 是 HFT 中最強的短期預測指標之一。" },
      { day_id: "W2D4", title: "市場衝擊與滑價模型", am: { topic: "Almgren-Chriss 模型", tasks: ["學習平方根法則 (Square Root Law)", "理解永久 vs 暫時性衝擊", "計算滑價成本模型"] }, pm: { topic: "模擬撮合：成交機率", tasks: ["實作限價單成交機率估算", "模擬訂單在隊列中的位置", "測試不同波動下的滑價"] }, night: { topic: "LeetCode: Linked List", tasks: ["Reverse Linked List", "Merge k Sorted Lists"] }, yushi_focus: "回測時若忽略衝擊成本，策略將嚴重失真。" },
      { day_id: "W2D5", title: "微結構專題與 Asyncio", am: { topic: "微結構面試題總整理", tasks: ["分析交易所延遲 (Latency) 來源", "解釋冰山訂單 (Iceberg)", "整理 LOB 數據結構筆記"] }, pm: { topic: "系統優化：Asyncio 並發", tasks: ["數據獲取改為異步架構", "實作 Producer-Consumer 模式", "優化 LOB 更新延遲"] }, night: { topic: "Medium 產出", tasks: ["發布文章：微秒級戰場：LOB 訂單簿動力學"] }, yushi_focus: "優化代碼路徑，將特徵計算延遲降低至微秒等級。" }
    ],
    3: [
      { day_id: "W3D1", title: "經典動能策略", am: { topic: "時序與橫截面動能", tasks: ["研讀報酬率自相關性", "學習因子正規化 (Z-score)", "理解市場無效率性"] }, pm: { topic: "實作動能與突破策略", tasks: ["開發 Donchian Channel 策略", "計算移動窗口波幅", "加入 ATR 停損機制"] }, night: { topic: "LeetCode: Trees", tasks: ["Max Depth of Binary Tree", "Invert Binary Tree"] }, yushi_focus: "除了報酬率，優式更看重最大回撤 (MDD) 與夏普比率。" },
      { day_id: "W3D2", title: "均值回歸理論", am: { topic: "OU 過程與統計套利", tasks: ["學習 Ornstein-Uhlenbeck 過程", "理解協整 (Cointegration) 檢定", "研究價差均值回歸原理"] }, pm: { topic: "實作 Pairs Trading", tasks: ["篩選相關性資產對", "計算 Spread 的 Z-score", "執行門檻觸發回測"] }, night: { topic: "LeetCode: Trees", tasks: ["Validate Binary Search Tree", "LCA of BST"] }, yushi_focus: "Pairs Trading 是自營商的經典策略，需注意 Regime Shift 風險。" },
      { day_id: "W3D3", title: "期現套利與資金費率", am: { topic: "期貨基差 (Basis) 變動", tasks: ["理解 Basis 形成與收斂", "計算加密貨幣資金費率 (Funding Rate)", "三角套利機會分析"] }, pm: { topic: "資金費率套利模擬", tasks: ["串接期現價差數據", "計算持倉成本與獲利空間", "模擬資金費率轉折點"] }, night: { topic: "LeetCode: Tries", tasks: ["Implement Trie", "Word Search II"] }, yushi_focus: "Binance 資金費率是特有的 Alpha 來源。" },
      { day_id: "W3D4", title: "因子分析與評估", am: { topic: "IC 與因子衰減", tasks: ["學習 Information Coefficient (IC)", "理解因子周轉率與擁擠度", "分析因子解釋力"] }, pm: { topic: "實作因子回測框架", tasks: ["撰寫分層回測 (Quantile Analysis)", "計算因子累積收益", "分析因子在不同市況表現"] }, night: { topic: "LeetCode: Heap", tasks: ["Kth Largest Element", "Top K Frequent Elements"] }, yushi_focus: "確保因子回測包含手續費與滑價，避免過度擬合。" },
      { day_id: "W3D5", title: "策略組合與優化", am: { topic: "風險平價與最小方差", tasks: ["理解等權 vs 風險平價權重", "推導馬可維茲組合優化", "整理策略邏輯至 GitHub"] }, pm: { topic: "優化：因子相關性過濾", tasks: ["執行因子相關性矩陣分析", "剔除高相關冗餘因子", "合併多因子信號"] }, night: { topic: "Medium 產出", tasks: ["發布文章：從動能到套利：我的 Alpha 研究日誌"] }, yushi_focus: "優式尋找有紀律的交易員，嚴格的驗證流程展現了你的紀律。" }
    ],
    4: [
       { day_id: "W4D1", title: "回測引擎架構設計", am: { topic: "向量化 vs 事件驅動", tasks: ["設計 Event Loop 流程圖", "規劃 DataHandler 組件", "理解引擎延遲模擬"] }, pm: { topic: "實作基礎 Event Queue", tasks: ["建立事件隊列基類", "實作 MarketEvent 與 SignalEvent", "封裝數據餵送類別"] }, night: { topic: "LeetCode: Backtracking", tasks: ["Subsets", "Combination Sum"] }, yushi_focus: "引擎必須能模擬逐筆撮合 (Tick-by-Tick) 以符合 HFT 需求。" },
       { day_id: "W4D2", title: "策略與組合管理", am: { topic: "Strategy 與 Portfolio 接口", tasks: ["設計持倉追蹤邏輯", "計算 Unrealized PnL", "定義訂單狀態機"] }, pm: { topic: "實作持倉管理系統", tasks: ["處理 SignalEvent 轉為 Order", "更新帳戶現金與保證金", "實作訂單追蹤器"] }, night: { topic: "LeetCode: Backtracking", tasks: ["Word Search", "Permutations"] }, yushi_focus: "狀態機 (State Machine) 是處理高頻掛單與撤單確認的關鍵。" },
       { day_id: "W4D3", title: "執行處理組件 (Execution)", am: { topic: "成交邏輯與滑價模型", tasks: ["模擬成交邏輯 (FillEvent)", "整合滑價與手續費模型", "處理限價單撮合細節"] }, pm: { topic: "實作模擬交易撮合器", tasks: ["撰寫 ExecutionHandler", "整合滑價概率模型", "處理部分成交與取消訂單"] }, night: { topic: "LeetCode: Graphs", tasks: ["Number of Islands", "Clone Graph"] }, yushi_focus: "模擬真實的隊列位置 (Queue Position) 對限價單成交至關重要。" },
       { day_id: "W4D4", title: "績效評估指標", am: { topic: "Sharpe, Sortino, MDD", tasks: ["實作核心風險指標算法", "理解水中時間 (Time Underwater)", "定義交易日誌分析方法"] }, pm: { topic: "實作績效報告生成器", tasks: ["繪製權益曲線 (Equity Curve)", "生成交易統計摘要", "實作月度報酬分佈圖"] }, night: { topic: "LeetCode: Graphs", tasks: ["Course Schedule", "Pacific Atlantic Water Flow"] }, yushi_focus: "穩定的 Alpha 曲線比單次暴利更有價值。" },
       { day_id: "W4D5", title: "偏誤檢查與系統整合", am: { topic: "識別回測陷阱", tasks: ["檢查前視偏誤與倖存者偏差", "模擬歷史數據延遲影響", "進行回測-實盤一致性分析"] }, pm: { topic: "系統整合測試", tasks: ["運行 W3 策略於新引擎", "比較向量化與事件驅動差異", "優化引擎執行速度"] }, night: { topic: "Medium 產出", tasks: ["發布文章：從零開始：我的事件驅動回測引擎設計"] }, yushi_focus: "NautilusTrader 框架提供了良好的參考架構。" }
    ],
    5: [
        { day_id: "W5D1", title: "造市商模型：A-S 模型", am: { topic: "Avellaneda-Stoikov 論文", tasks: ["推導最優買賣報價位置", "理解庫存風險參數 $\\gamma$", "分析 Spread 與波幅關係"] }, pm: { topic: "實作 A-S 造市算法", tasks: ["根據庫存水平調整報價 Skew", "模擬訂單被撮合的過程", "測試不同風險厭惡下的表現"] }, night: { topic: "LeetCode: DP", tasks: ["Climbing Stairs", "Coin Change"] }, yushi_focus: "當存貨偏多且市場毒性高時，需自動增加 $\\gamma$ 以擴大 Spread。" },
        { day_id: "W5D2", title: "延遲 (Latency) 的影響", am: { topic: "Tick-to-Trade 延遲", tasks: ["理解網路 vs 處理延遲", "學習主機共置 (Colocation)", "延遲套利原理分析"] }, pm: { topic: "優化：Cython 封裝", tasks: ["使用 Cython 封裝計算密集函數", "實作高效能循環緩衝區", "優化數據解析速度"] }, night: { topic: "LeetCode: DP", tasks: ["Longest Palindromic Substring", "Word Break"] }, yushi_focus: "在板橋機房 (TAIFEX) 或東京節點 (Binance) 部署以降低延遲。" },
        { day_id: "W5D3", title: "流動性回扣與頻率競爭", am: { topic: "Maker-Taker 費率機制", tasks: ["理解流動性回報 (Rebate)", "分析 HFT 如何利用 Rebate 獲利", "研究訂單優先權競爭"] }, pm: { topic: "實作 Rebate 捕捉策略", tasks: ["加入掛單獎勵計算邏輯", "測試不同交易所費率表現", "分析成交質量與回報"] }, night: { topic: "LeetCode: DP", tasks: ["Longest Increasing Subsequence", "Palindromic Substrings"] }, yushi_focus: "HFT 的利潤往往來自 Rebate，精確計算費率是核心。" },
        { day_id: "W5D4", title: "HFT 風控機制", am: { topic: "秒級風險斷路器", tasks: ["防止訂單自我成交 (Self-trade)", "設計單筆交易規模限制", "研究胖手指 (Fat Finger) 防範"] }, pm: { topic: "實作風控過濾層", tasks: ["在 Execution 前加入風控檢查", "模擬極端行情自動撤單", "撰寫風控觸發日誌系統"] }, night: { topic: "LeetCode: Greedy", tasks: ["Maximum Subarray", "Jump Game"] }, yushi_focus: "風險控管是自營部交易員的生命線。" },
        { day_id: "W5D5", title: "HFT 專題總結與壓測", am: { topic: "HFT 獲利來源分析", tasks: ["分析 HFT 獲利來源 (Edge)", "整理延遲優化 Checkbox", "準備微結構相關面試題"] }, pm: { topic: "壓力測試：行情回放", tasks: ["加載極端行情數據 (Flash Crash)", "測試系統高負載穩定性", "優化熱點路徑 (Hot Path)"] }, night: { topic: "Medium 產出", tasks: ["發布文章：做市商的藝術：實戰 Avellaneda-Stoikov 模型"] }, yushi_focus: "面試題預判：如何優化數據傳輸後的序列化延遲？" }
    ],
    6: [
      { day_id: "W6D1", title: "高效數據存儲架構", am: { topic: "Parquet vs Feather 深度對比", tasks: ["學習數據分塊 (Chunking) 處理", "理解記憶體映射 (mmap) 讀取", "研究列式存儲優勢"] }, pm: { topic: "實作高性能讀取器", tasks: ["封裝多執行緒數據加載", "優化數據類別壓縮 (Category)", "測試 TB 級數據檢索速度"] }, night: { topic: "LeetCode: Intervals", tasks: ["Insert Interval", "Merge Intervals"] }, yushi_focus: "捨棄 CSV，改用 Parquet 以節省 50% 以上記憶體。" },
      { day_id: "W6D2", title: "Python 並行計算進階", am: { topic: "Multiprocessing vs Threading", tasks: ["學習 Shared Memory 通訊機制", "了解 Ray 框架基礎", "研究 GIL 的影響與避開"] }, pm: { topic: "實作多進程回測加速", tasks: ["將回測任務分配至不同核心", "實作並行參數掃描工具", "測試加速比 (Speedup Ratio)"] }, night: { topic: "LeetCode: Intervals", tasks: ["Non-overlapping Intervals", "Meeting Rooms II"] }, yushi_focus: "將參數量化掃描時間從數天降至數分鐘。" },
      { day_id: "W6D3", title: "網路通訊優化", am: { topic: "UDP vs TCP 選擇", tasks: ["學習 ZeroMQ 消息機制", "理解二進制消息協議", "研究傳輸層延遲"] }, pm: { topic: "實作內部消息總線", tasks: ["使用 ZeroMQ 建立組件通訊", "定義高效二進制消息格式", "測試組件間通訊延遲"] }, night: { topic: "LeetCode: Linked List", tasks: ["Remove Nth Node", "Reorder List"] }, yushi_focus: "理解從「市場數據」到「策略執行」的完整延遲路徑。" },
      { day_id: "W6D4", title: "C++ 與 Python 混合編程", am: { topic: "Pybind11 基礎", tasks: ["學習數據交換機制", "防止 Python 垃圾回收干擾", "研究 STL 容器應用"] }, pm: { topic: "實作 C++ 指標計算組件", tasks: ["用 Pybind11 封裝核心算法", "測試 C++ 指標計算速度", "整合至現有 Python 框架"] }, night: { topic: "LeetCode: Heap", tasks: ["Find Median from Data Stream"] }, yushi_focus: "優式重視代碼效率，能撰寫 C++ 加速組件是巨大加分項。" },
      { day_id: "W6D5", title: "性能調優總結", am: { topic: "Profile 工具使用", tasks: ["學習使用 cProfile 定位瓶頸", "分析 CPU 緩存命中率", "整理效能優化 Checkbox"] }, pm: { topic: "全面 Profile 與優化", tasks: ["執行 cProfile 並繪製火焰圖", "重構效能最差的 10% 函數", "撰寫性能基準測試報告"] }, night: { topic: "Medium 產出", tasks: ["發布文章：將交易系統加速 100 倍：Python 高效優化實戰"] }, yushi_focus: "優化代碼不僅是為了速度，更是為了在高負載下的系統穩定性。" }
    ],
    7: [
       { day_id: "W7D1", title: "金融標籤法 (Labeling)", am: { topic: "三重屏障法 (Triple Barrier)", tasks: ["研讀 Triple Barrier Method 原理", "理解固定時間窗標籤缺點", "學習 Meta-Labeling 概念"] }, pm: { topic: "實作三重屏障標籤", tasks: ["撰寫動態波動率屏障腳本", "生成買/賣/無信號標籤", "視覺化標籤分佈"] }, night: { topic: "LeetCode: Binary Search", tasks: ["Find Minimum in Rotated Array"] }, yushi_focus: "將風險管理直接融入 ML 模型的訓練目標中。" },
       { day_id: "W7D2", title: "特徵工程：分數差分", am: { topic: "平穩性與記憶性的矛盾", tasks: ["學習 Fractional Differentiation (FracDiff)", "理解 ADF 檢定與平穩性", "計算權重窗口長度"] }, pm: { topic: "實作 FracDiff 特徵轉換", tasks: ["撰寫固定權重差分函數", "執行 ADF 檢定驗證平穩性", "保留原始序列記憶性特徵"] }, night: { topic: "LeetCode: Binary Search", tasks: ["Koko Eating Bananas"] }, yushi_focus: "特徵工程比模型更重要，思考如何量化市場情緒。" },
       { day_id: "W7D3", title: "微結構特徵開發", am: { topic: "OFI 與買賣壓力", tasks: ["研讀訂單流不平衡度 (OFI)", "理解買賣壓力集中度", "開發自相關性特徵"] }, pm: { topic: "實作 HFT 特徵提取器", tasks: ["從 Tick 數據提取微結構因子", "執行因子相關性熱力圖分析", "計算因子重要性初步評估"] }, night: { topic: "LeetCode: Sliding Window", tasks: ["Minimum Window Substring"] }, yushi_focus: "OFI、VPIN 是 HFT 中最具預測力的特徵。" },
       { day_id: "W7D4", title: "特徵選擇與降維", am: { topic: "過擬合與特徵共線性", tasks: ["學習遞歸特徵消除 (RFE)", "理解 UMAP/t-SNE 降維", "分析因子擁擠度"] }, pm: { topic: "實作特徵篩選 Pipeline", tasks: ["使用隨機森林評估特徵強度", "剔除高度相關特徵", "執行 PCA 主成分因子化"] }, night: { topic: "LeetCode: Stack", tasks: ["Evaluate Reverse Polish Notation"] }, yushi_focus: "解釋為何樹模型在金融數據上通常優於神經網絡。" },
       { day_id: "W7D5", title: "特徵工程總結與存儲", am: { topic: "防止 Look-ahead 專題", tasks: ["撰寫特徵字典文件", "分析特徵穩定性與漂移", "面試題：如何防止 Look-ahead"] }, pm: { topic: "構建特徵存儲系統", tasks: ["實作 Feature Store 讀寫接口", "處理時序對齊 (Point-in-time)", "生成訓練用特徵矩陣"] }, night: { topic: "Medium 產出", tasks: ["發布文章：金融特徵工程：三重屏障法與分數差分實戰"] }, yushi_focus: "良好的特徵存儲系統能讓策略研究效率提升數倍。" }
    ],
    8: [
        { day_id: "W8D1", title: "金融交叉驗證法", am: { topic: "Purged K-Fold 原理", tasks: ["研讀 Purging 與 Embargo 概念", "分析時序數據洩漏問題", "理解金融交叉驗證特殊性"] }, pm: { topic: "實作 Purged K-Fold", tasks: ["撰寫時間序列分割函數", "加入清洗間隔防樣本重疊", "建立模型驗證標準流程"] }, night: { topic: "LeetCode: DP", tasks: ["Longest Common Subsequence"] }, yushi_focus: "數據洩漏 (Data Leakage) 是金融 ML 失敗的第一主因。" },
        { day_id: "W8D2", title: "梯度提升樹 (GBDT) 應用", am: { topic: "XGBoost 與 LightGBM", tasks: ["理解分類不平衡處理", "學習自定義損失函數", "研究樹模型參數調優"] }, pm: { topic: "訓練 XGBoost 預測模型", tasks: ["執行超參數調優 (Hyperparameter)", "繪製 PR 曲線與 ROC 曲線", "實作權重調整處理不平衡"] }, night: { topic: "LeetCode: DP", tasks: ["Edit Distance"] }, yushi_focus: "XGBoost 是處理表格型金融數據的王者。" },
        { day_id: "W8D3", title: "神經網路：RNN 與 LSTM", am: { topic: "序列數據處理模型", tasks: ["理解梯度消失與爆炸問題", "研讀 TCN 卷積網絡優勢", "研究 LSTM 序列預測"] }, pm: { topic: "實作 LSTM 價格預測", tasks: ["搭建 PyTorch 模型架構", "實作序列數據窗口生成器", "訓練並監控 Loss 曲線"] }, night: { topic: "LeetCode: Trees", tasks: ["Binary Tree Maximum Path Sum"] }, yushi_focus: "這是加分項，若基礎不穩應優先精通 XGBoost。" },
        { day_id: "W8D4", title: "模型集成與 Alpha 整合", am: { topic: "Stacking 與 Meta-Labeling", tasks: ["學習模型集成策略", "研讀 Meta-Labeling 實戰", "研究模型權重分配"] }, pm: { topic: "實作二階段模型過濾", tasks: ["階段一：方向預測模型", "階段二：信心度過濾模型", "回測整合後的表現提升"] }, night: { topic: "LeetCode: Graphs", tasks: ["Longest Consecutive Sequence"] }, yushi_focus: "Meta-Labeling 能顯著提升策略的夏普比率。" },
        { day_id: "W8D5", title: "模型驗證與穩定性分析", am: { topic: "模型評估指標筆記", tasks: ["分析過擬合原因與對策", "解釋模型預測信號", "準備 ML 面試專題"] }, pm: { topic: "模型穩定性測試", tasks: ["執行 Out-of-sample 測試", "分析模型在不同年份表現", "撰寫模型回測報告"] }, night: { topic: "Medium 產出", tasks: ["發布文章：機器學習在量化中的應用：Purged K-Fold 與 XGBoost"] }, yushi_focus: "優式資本重視模型的可解釋性與邏輯合理性。" }
    ],
    9: [
      { day_id: "W9D1", title: "強化學習基礎理論", am: { topic: "MDP 與 Reward 設計", tasks: ["理解馬可夫決策過程", "學習 Epsilon-greedy 策略", "研讀強化學習在交易中的定位"] }, pm: { topic: "實作造市環境 (Gym)", tasks: ["定義 Action 與 State 空間", "設計 PnL 驅動的 Reward 函數", "搭建基礎訓練循環"] }, night: { topic: "LeetCode: Bit Manipulation", tasks: ["Number of 1 Bits", "Counting Bits"] }, yushi_focus: "除了追求利潤，必須懲罰庫存積壓和過度交易。" },
      { day_id: "W9D2", title: "深度強化學習 (DQN)", am: { topic: "DQN 與穩定性原理", tasks: ["理解 Experience Replay", "研讀 Target Network 原理", "分析神經網絡近似 Q 函數"] }, pm: { topic: "訓練 DQN 造市 Agent", tasks: ["整合神經網路至 RL 框架", "記錄訓練過程中的 Reward 變化", "觀察 Agent 報價行為演化"] }, night: { topic: "LeetCode: Math", tasks: ["Happy Number", "Plus One"] }, yushi_focus: "訓練 Agent 學會當庫存偏多時，自動積極降價拋售。" },
      { day_id: "W9D3", title: "最優執行算法", am: { topic: "VWAP 與 TWAP 原理", tasks: ["理解成交量分配拆單", "研讀 IS (Implementation Shortfall)", "研究訂單拆分策略"] }, pm: { topic: "實作 VWAP 執行器", tasks: ["根據成交量分佈拆單", "模擬動態調整訂單頻率", "計算執行缺口 (Slippage)"] }, night: { topic: "LeetCode: Array", tasks: ["Product of Array Except Self"] }, yushi_focus: "RL 在決策執行 (Execution) 上具有巨大優勢。" },
      { day_id: "W9D4", title: "RL 應用與 SOR 優化", am: { topic: "智能訂單路由 (SOR)", tasks: ["學習跨交易所流動性掃描", "減少市場衝擊的方法", "研究 RL 優化執行路徑"] }, pm: { topic: "實作簡易 SOR 邏輯", tasks: ["模擬多交易所 LOB 數據", "設計路由選擇模型", "測試滑價優化百分比"] }, night: { topic: "LeetCode: Backtracking", tasks: ["Generate Parentheses"] }, yushi_focus: "分析 HFT 如何在多個交易所間分配流動性。" },
      { day_id: "W9D5", title: "執行策略總結與整合", am: { topic: "執行策略面試專題", tasks: ["整理執行算法優化指標", "如何衡量執行品質", "分析 HFT 降低衝擊手段"] }, pm: { topic: "系統回測：端到端整合", tasks: ["將 RL 造市與執行整合", "執行長週期壓力測試", "生成最終績效對比報告"] }, night: { topic: "Medium 產出", tasks: ["發布文章：強化學習：打造智能造市與最優執行系統"] }, yushi_focus: "展示你對「速度」以外的優勢（如預測訂單流）的利用。" }
    ],
    10: [
       { day_id: "W10D1", title: "風險度量理論", am: { topic: "VaR 與 CVaR 計算", tasks: ["理解 Value at Risk (VaR)", "學習預期尾部損失 (CVaR)", "分析風險分解與貢獻"] }, pm: { topic: "實作 VaR 計算工具", tasks: ["計算歷史模擬與正態 VaR", "執行回溯測試 (Backtest VaR)", "繪製風險指標趨勢圖"] }, night: { topic: "LeetCode: Matrix", tasks: ["Set Matrix Zeroes", "Spiral Matrix"] }, yushi_focus: "優式重視風險控管。面試題：如何處理爆倉？" },
       { day_id: "W10D2", title: "資金管理與部位縮放", am: { topic: "凱利公式進階應用", tasks: ["理解凱利公式在多策略下應用", "固定風險縮放模型", "研究部位控制邏輯"] }, pm: { topic: "實作動態部位規模器", tasks: ["根據波幅調整最大部位", "實作槓桿控制與平倉邏輯", "測試資金管理對 MDD 影響"] }, night: { topic: "LeetCode: String", tasks: ["Longest Palindromic Substring"] }, yushi_focus: "活下來比賺大錢更重要。嚴格的風險控制是生存之本。" },
       { day_id: "W10D3", title: "保證金與清算機制", am: { topic: "期貨保證金計算", tasks: ["理解維持保證金與強平", "分析加密貨幣保證金細節", "研究跨資產抵押邏輯"] }, pm: { topic: "模擬強平與爆倉場景", tasks: ["實作保證金占用更新", "模擬極端波動強平警報", "計算系統安全邊際"] }, night: { topic: "LeetCode: Heap", tasks: ["Merge k Sorted Lists"] }, yushi_focus: "理解 Binance 的強平機制與保險基金角色。" },
       { day_id: "W10D4", title: "壓力測試 (Stress Testing)", am: { topic: "蒙地卡羅與極端場景", tasks: ["蒙地卡羅模擬極端行情", "回放歷史劇變場景 (2020)", "分析系統相關性崩潰"] }, pm: { topic: "執行蒙地卡羅壓測", tasks: ["生成 10,000 種路徑模擬", "找出 99% 信心崩潰點", "撰寫極端場景應對報告"] }, night: { topic: "LeetCode: Graphs", tasks: ["Word Ladder"] }, yushi_focus: "展現你的抗壓性與對系統邊際情況的深刻理解。" },
       { day_id: "W10D5", title: "風險管理總結與整合", am: { topic: "風險控管面試專題", tasks: ["整理風控斷路器 Checkbox", "分析系統異常重啟處理", "建立量化風險筆記"] }, pm: { topic: "最終風控模組整合", tasks: ["將 VaR 與保證金監控整合", "測試實時風控反應延遲", "生成全系統風控報表"] }, night: { topic: "Medium 產出", tasks: ["發布文章：生存法則：量化交易中的風險管理與壓力測試"] }, yushi_focus: "風險管理是所有策略的底座。" }
    ],
    11: [
      { day_id: "W11D1", title: "專題架構最後修訂", am: { topic: "整合 1-10 週組件", tasks: ["數據、回測、實盤接口對齊", "整合 Docker 容器環境", "優化專題 GitHub 結構"] }, pm: { topic: "實時數據同構實作", tasks: ["統一回測與實盤代碼邏輯", "實作數據回放測試工具", "驗證數據一致性"] }, night: { topic: "LeetCode: 精選 Hard", tasks: ["Sliding Window Maximum"] }, yushi_focus: "展示 Backtest-to-Live 的代碼一致性。" },
      { day_id: "W11D2", title: "造市模型細節調優", am: { topic: "A-S 模型參數優化", tasks: ["優化 $\\gamma$ 回饋機制", "動態滑價參數調整", "特徵穩定性檢查"] }, pm: { topic: "全天候模擬盤運行", tasks: ["運行 Paper Trading 測試", "記錄 PnL 與滑價差異", "比對回測與模擬盤表現"] }, night: { topic: "LeetCode: 精選 Hard", tasks: ["Sudoku Solver"] }, yushi_focus: "這份專案是你進入優式的入場券，務必追求完美。" },
      { day_id: "W11D3", title: "自動化部署與監控", am: { topic: "代碼審查與文檔完善", tasks: ["撰寫 README 與系統手冊", "完善 API 文檔", "重構低效能代碼段"] }, pm: { topic: "部署與日誌系統", tasks: ["使用 Docker 部署系統", "實作 Prometheus/Grafana 監控", "建立異常報警機制"] }, night: { topic: "LeetCode: 精選 Hard", tasks: ["Longest Valid Parentheses"] }, yushi_focus: "專業的工程實踐能力（如 Docker, Monitoring）是巨大加分。" },
      { day_id: "W11D4", title: "面試簡報與展示準備", am: { topic: "製作專題展示投影片", tasks: ["準備系統架構圖 (System Diagram)", "演練解釋 Edge (優勢)", "準備績效數據報表"] }, pm: { topic: "最後效能基準測試", tasks: ["執行端到端延遲測試", "生成性能對比圖表", "完善績效分析報告"] }, night: { topic: "LeetCode: 精選 Hard", tasks: ["N-Queens"] }, yushi_focus: "專注於解釋你解決了什麼具體的技術難點（如延遲優化）。" },
      { day_id: "W11D5", title: "專題總結與回顧", am: { topic: "整理學習日誌摘要", tasks: ["分析專題不足與改進方向", "上傳最終版本至 GitHub", "撰寫專案解說文檔"] }, pm: { topic: "模擬專案展示 (Demo)", tasks: ["錄製專案解說影片", "演練技術問答 (QA)", "檢查代碼註解正確性"] }, night: { topic: "LeetCode 衝刺", tasks: ["複習所有錯題"] }, yushi_focus: "完成此專題，證明你有在自營交易行業生存的決心。" }
    ],
    12: [
       { day_id: "W12D1", title: "JD 解析與個人經歷", am: { topic: "優式資本 JD 深度解析", tasks: ["分析公司偏好與文化", "準備經歷 STAR 描述", "精煉 3 分鐘自我介紹"] }, pm: { topic: "量化算法大補帖", tasks: ["複習所有排序與搜尋算法", "重點複習 DP 與圖論", "手寫代碼白板練習"] }, night: { topic: "機率題衝刺", tasks: ["複習綠皮書機率精選 50 題"] }, yushi_focus: "優式看重實作，面試時強調你的 Python 高效能經驗。" },
       { day_id: "W12D2", title: "技術面試專題複習", am: { topic: "市場微結構複習", tasks: ["複習 LOB 與延遲問題", "演練如何優化延遲", "解釋 HFT 影響市場案例"] }, pm: { topic: "機器學習面試複習", tasks: ["複習過擬合與特徵選擇", "準備模型可解釋性問答", "金融數據特殊處理問答"] }, night: { topic: "機率題衝刺", tasks: ["期望值與隨機漫步專題"] }, yushi_focus: "針對 JD 的關鍵字（如 HFT, Python）進行針對性回憶。" },
       { day_id: "W12D3", title: "行為面試與專案追問", am: { topic: "行為面試準備", tasks: ["準備壓力、失敗、衝突故事", "回答為什麼做 Quant", "職業目標規劃 (3-5年)"] }, pm: { topic: "專案細節追問準備", tasks: ["深入準備遇到的 Bug 解決過程", "如何處理系統異常重啟", "解釋資金管理決策依據"] }, night: { topic: "隨機過程複習", tasks: ["馬可夫鏈與泊松過程精選"] }, yushi_focus: "展現你的反脆弱性與從失敗中學習的能力。" },
       { day_id: "W12D4", title: "模擬全流程面試", am: { topic: "全流程模擬面試", tasks: ["演練算法 -> 專案 -> 行為", "記錄分析表達不足處", "優化先結論後細節邏輯"] }, pm: { topic: "履歷最後校對投遞", tasks: ["確保包含 12 週成果", "校對 GitHub 連結", "送出應徵申請"] }, night: { topic: "心態調整", tasks: ["整理筆記心智圖"] }, yushi_focus: "保持冷靜與自信，這是優秀交易員的特質。" },
       { day_id: "W12D5", title: "最後總整理與任務達成", am: { topic: "面試 Checkbox 複習", tasks: ["確保隨時可展示簡報代碼", "總結學習歷程與感謝", "複習關鍵數學公式"] }, pm: { topic: "社群連結與反饋", tasks: ["整理面試反饋 (如有)", "保持市場關注", "參與討論群組交流"] }, night: { topic: "任務達成！慶祝", tasks: ["計畫 100% 完成！"] }, yushi_focus: "交易是一場馬拉松，這 12 週只是開始。" }
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
