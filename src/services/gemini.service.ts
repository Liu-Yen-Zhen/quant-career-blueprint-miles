import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private apiKey = signal<string>(localStorage.getItem('gemini_api_key') || '');

  constructor() {
    this.initAI();
  }

  setApiKey(key: string) {
    localStorage.setItem('gemini_api_key', key);
    this.apiKey.set(key);
    this.initAI();
  }

  getApiKey() {
    return this.apiKey();
  }

  hasKey(): boolean {
    return !!this.apiKey();
  }

  private initAI() {
    const key = this.apiKey();
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    } else {
      this.ai = null;
    }
  }

  async explainConcept(concept: string, context: string): Promise<string> {
    if (!this.ai) return '請先點擊右上角設定您的 Google Gemini API Key。';

    const model = 'gemini-2.5-flash';
    const prompt = `
      你是一位資深的量化交易導師 (Quant Researcher Mentor)。
      請向一位具備理工背景的學生解釋以下概念：
      
      概念：${concept}
      背景脈絡：${context}
      
      要求：
      1. 解釋清晰簡潔，使用繁體中文。
      2. 如果有數學公式，請用 LaTeX 格式表示（例如 $E=mc^2$）。
      3. 強調這個概念在「高頻交易」或「造市策略」中的實際應用。
      4. 控制在 300 字以內。
    `;

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      return response.text || '無法生成解釋，請稍後再試。';
    } catch (error) {
      console.error('Gemini API Error:', error);
      return 'AI 服務發生錯誤。請檢查 API Key 是否正確或額度是否足夠。';
    }
  }

  async generateInterviewQuestion(): Promise<{ question: string; answer: string }> {
    if (!this.ai) return { question: '請先設定 API Key', answer: '' };

    const model = 'gemini-2.5-flash';
    const prompt = `
      生成一道頂尖量化對沖基金（如 Jane Street, Citadel）的面試題目。
      題目類型可以是：概率論、統計學、數學謎題 (Brain Teaser) 或 演算法設計。
      
      請以 JSON 格式回傳，格式如下：
      {
        "question": "題目內容...",
        "answer": "詳細解答與推導過程..."
      }
      
      請確保內容使用繁體中文。
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text || '{}';
      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        question: '生成題目失敗，請檢查 API Key。',
        answer: '無解答。'
      };
    }
  }
}