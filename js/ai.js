// js/ai.js
// AI 调用统一封装 —— fetch + 流式 + 错误捕获

import { dbGet } from './db.js';
import { logError, logInfo, logDebug } from './logger.js';

// ── 获取当前 API 配置 ────────────────────────────────────────
async function getConfig() {
  const settings = await dbGet('settings', 'singleton');
  if (!settings?.apiKey) {
    throw new Error('未配置 API Key，请先前往设置页填写');
  }
  return {
    base:      (settings.apiBase || 'https://api.openai.com').replace(/\/$/, ''),
    key:       settings.apiKey,
    model:     settings.selectedModel || 'gpt-4o',
    maxTokens: settings.maxTokens ?? 100000,   // ← 读用户配置，默认 100000
  };
}

// ── 主调用入口 ───────────────────────────────────────────────
export async function callAI({ messages, stream = false, onChunk = null, signal = null }) {
  const cfg = await getConfig();

  const url  = `${cfg.base}/v1/chat/completions`;
  const body = JSON.stringify({
    model:      cfg.model,
    messages,
    max_tokens: cfg.maxTokens,    // ← 使用配置值
    stream,
  });

  logDebug('ai', `Calling ${cfg.model}, stream=${stream}, msgs=${messages.length}, max_tokens=${cfg.maxTokens}`);

  let resp;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.key}`,
      },
      body,
      signal,
    });
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'AI 请求已取消'
      : `网络错误：${err.message}`;
    logError('ai', msg, { stack: err.stack });
    throw new Error(msg);
  }

  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch (_) { /* ignore */ }
    logError('ai', `API error: ${errMsg}`);
    throw new Error(errMsg);
  }

  if (stream) {
    return _handleStream(resp, onChunk);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  logInfo('ai', `Response received, length=${text.length}`);
  return text;
}

async function _handleStream(resp, onChunk) {
  const reader  = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let   full    = '';
  let   buffer  = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json  = JSON.parse(trimmed.slice(6));
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            onChunk?.(delta);
          }
        } catch (_) {
          logDebug('ai', `Stream parse skip: ${trimmed.slice(0, 40)}`);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  logInfo('ai', `Stream complete, total length=${full.length}`);
  return full;
}

// ── 获取可用模型列表 ─────────────────────────────────────────
export async function fetchModels(apiBase, apiKey) {
  const base = (apiBase || '').replace(/\/$/, '');
  if (!base || !apiKey) throw new Error('请填写 Base URL 和 API Key');

  const url = `${base}/v1/models`;
  let resp;
  try {
    resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  } catch (err) {
    throw new Error(`网络错误：${err.message}`);
  }

  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch (_) { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await resp.json();
  const models = (data?.data || data?.models || [])
    .map(m => m.id || m.name || '')
    .filter(Boolean)
    .sort();

  logInfo('ai', `Fetched ${models.length} models from ${base}`);
  return models;
}

// ── 构建 System Prompt ───────────────────────────────────────
export async function buildSystemPrompt({
  rolePrompt    = '',
  statusContext = '',
  promptKeys    = [],
} = {}) {
  const settings = await dbGet('settings', 'singleton');
  const global   = settings?.globalPrompt || '';
  const pc       = settings?.promptConfig || {};

  const pcParts = promptKeys
    .map(k => pc[k] || '')
    .filter(Boolean);

  const parts = [
    global,
    rolePrompt,
    ...pcParts,
    statusContext,
  ].filter(Boolean);

  return parts.join('\n\n');
}

