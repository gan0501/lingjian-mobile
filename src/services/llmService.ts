import api from './api';
import { ModelType } from '@/stores';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: ModelType;
  stream?: boolean;
}

export interface BidWriterRequest {
  project_name: string;
  project_type: string;
  requirements?: string;
  word_count?: number;
  model?: ModelType;
}

export const llmApi = {
  chat: (data: ChatRequest) =>
    api.post('/api/llm/chat', data),

  chatStream: async function* (data: ChatRequest): AsyncGenerator<string> {
    const response = await fetch(`${api.defaults.baseURL}/api/llm/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.defaults.headers.common['Authorization']}`,
      },
      body: JSON.stringify({ ...data, stream: true }),
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  },

  bidWriter: (data: BidWriterRequest) =>
    api.post('/api/llm/bid-writer', data),

  bidWriterStream: async function* (data: BidWriterRequest): AsyncGenerator<string> {
    const response = await fetch(`${api.defaults.baseURL}/api/llm/bid-writer/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.defaults.headers.common['Authorization']}`,
      },
      body: JSON.stringify({ ...data, stream: true }),
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  },

  pileCompare: (data: { pile_ids: string[]; criteria?: Record<string, any> }) =>
    api.post('/api/llm/pile-compare', data),
};
