/**
 * routes/ai.js — Universal OpenAI-compatible AI API router for Peak Xender.
 *
 * Supports 10+ providers (OpenRouter, Nvidia NIM, OpenAI, Gemini, Groq, DeepSeek, Together, Ollama, etc.)
 * by communicating with standard OpenAI-compatible `/v1/chat/completions` endpoints.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const logger = require('../logger');

// Simple symmetric obfuscation/encryption helper for API keys stored in DB
const SECRET_SALT = process.env.JWT_SECRET || 'peakxender-ai-key-salt';
function encryptKey(key) {
  if (!key) return '';
  const buf = Buffer.from(key, 'utf-8');
  const saltBuf = Buffer.from(SECRET_SALT, 'utf-8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ saltBuf[i % saltBuf.length];
  }
  return 'ENC:' + out.toString('hex');
}

function decryptKey(encKey) {
  if (!encKey) return '';
  if (!encKey.startsWith('ENC:')) return encKey; // Fallback plain text if legacy
  const hexStr = encKey.slice(4);
  const buf = Buffer.from(hexStr, 'hex');
  const saltBuf = Buffer.from(SECRET_SALT, 'utf-8');
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ saltBuf[i % saltBuf.length];
  }
  return out.toString('utf-8');
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

/** Helper: Fetch active AI configuration from DB */
async function getActiveAIConfig() {
  const db = await getDb();
  const row = await db.prepare('SELECT * FROM ai_config ORDER BY id DESC LIMIT 1').get();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    provider: row.provider,
    apiKey: decryptKey(row.api_key_encrypted),
    baseUrl: row.base_url.replace(/\/+$/, ''), // strip trailing slash
    model: row.model,
  };
}

/** Helper: Call the configured AI completions endpoint */
async function callAI(messages, systemOverride = null) {
  const config = await getActiveAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('AI Provider is not configured yet. Please configure your API key in AI Settings.');
  }

  // Fetch AI Rules & Knowledge Base context to append to system instructions
  const db = await getDb();
  const rulesRows = await db.prepare('SELECT rule_type, content FROM ai_rules').all();
  let rulesContext = '';
  if (rulesRows && rulesRows.length > 0) {
    rulesContext = '\n\n=== BRAND KNOWLEDGE BASE & OUTREACH RULES ===\n' +
      rulesRows.map(r => `[${r.rule_type.toUpperCase()}]: ${r.content}`).join('\n');
  }

  const defaultSystem = 'You are Peak Xender AI, an elite cold email outreach assistant and high-converting copywriter.' + rulesContext;
  const systemPrompt = systemOverride ? systemOverride + rulesContext : defaultSystem;

  let baseUrl = (config.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/') && !baseUrl.endsWith('/chat/completions')) {
    baseUrl = `${baseUrl}/v1`;
  }
  const endpointUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const res = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      ...(config.provider === 'openrouter' ? { 'HTTP-Referer': 'https://send.peakconix.site', 'X-Title': 'Peak Xender' } : {})
    },
    body: JSON.stringify({
      model: config.model || 'openai/gpt-4o-mini',
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1500,
    })
  });

  if (!res.ok) {
    let errText = await res.text();
    try {
      const parsed = JSON.parse(errText);
      errText = parsed.error?.message || parsed.message || errText;
    } catch (_) {}
    throw new Error(`AI API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response.');
  }
  return content.trim();
}

// ---------------------------------------------------------------------------
// Configuration Routes
// ---------------------------------------------------------------------------

/** GET /api/ai/config — Retrieve current AI config (masked key) */
router.get('/config', async (_req, res) => {
  try {
    const config = await getActiveAIConfig();
    if (!config) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      maskedApiKey: maskKey(config.apiKey),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/config — Save/update AI provider config */
router.post('/config', async (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'API Key is required.' });
  }

  try {
    const db = await getDb();
    const cleanBaseUrl = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const cleanModel = model || 'openai/gpt-4o-mini';
    const encKey = encryptKey(apiKey.trim());

    const existing = await db.prepare('SELECT id FROM ai_config ORDER BY id DESC LIMIT 1').get();
    if (existing) {
      await db.prepare('UPDATE ai_config SET provider = ?, api_key_encrypted = ?, base_url = ?, model = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(provider || 'custom', encKey, cleanBaseUrl, cleanModel, existing.id);
    } else {
      await db.prepare('INSERT INTO ai_config (provider, api_key_encrypted, base_url, model) VALUES (?, ?, ?, ?)')
        .run(provider || 'custom', encKey, cleanBaseUrl, cleanModel);
    }

    res.json({ success: true, message: 'AI Provider settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/test — Test the AI connection */
router.post('/test', async (_req, res) => {
  try {
    const response = await callAI([
      { role: 'user', content: 'Say "Peak Xender AI connection test successful!"' }
    ]);
    res.json({ success: true, response });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI Stage Rules & Knowledge Base Routes
// ---------------------------------------------------------------------------

/** GET /api/ai/rules — Get all AI stage rules */
router.get('/rules', async (_req, res) => {
  try {
    const db = await getDb();
    const rules = await db.prepare('SELECT rule_type, content FROM ai_rules').all();
    const rulesMap = {};
    rules.forEach(r => { rulesMap[r.rule_type] = r.content; });
    res.json(rulesMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/rules — Save or update AI stage rules */
router.post('/rules', async (req, res) => {
  const { rules } = req.body;
  if (!rules || typeof rules !== 'object') {
    return res.status(400).json({ error: 'Rules object is required.' });
  }

  try {
    const db = await getDb();
    for (const [ruleType, content] of Object.entries(rules)) {
      const existing = await db.prepare('SELECT id FROM ai_rules WHERE rule_type = ?').get(ruleType);
      if (existing) {
        await db.prepare('UPDATE ai_rules SET content = ?, updated_at = datetime(\'now\') WHERE rule_type = ?')
          .run(String(content || ''), ruleType);
      } else {
        await db.prepare('INSERT INTO ai_rules (rule_type, content) VALUES (?, ?)')
          .run(ruleType, String(content || ''));
      }
    }
    res.json({ success: true, message: 'AI Rules updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI Features (Generator, Rewriter, Spintax, Subjects, Reply Draft)
// ---------------------------------------------------------------------------

/** POST /api/ai/generate — Generate email content from a prompt */
router.post('/generate', async (req, res) => {
  const { prompt, stage = 'initial', contactFields = {} } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

  try {
    const contextStr = Object.keys(contactFields).length > 0 
      ? `\nProspect Variables available: ${Object.keys(contactFields).map(k => `{${k}}`).join(', ')}` 
      : '';

    const text = await callAI([
      { 
        role: 'user', 
        content: `Write a high-converting cold email for stage "${stage}".\nPrompt/Goal: ${prompt}${contextStr}\nFormat the output as JSON with keys "subject" and "body_html". Do not include markdown code block backticks.` 
      }
    ]);

    let result = { subject: 'Outreach Request', body_html: text };
    try {
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      result = JSON.parse(cleanJsonStr);
    } catch (_) {}

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/rewrite — Rewrite or improve existing email copy */
router.post('/rewrite', async (req, res) => {
  const { subject, body, instruction = 'Improve readability, deliverability, and urgency' } = req.body;
  if (!body) return res.status(400).json({ error: 'Email body is required.' });

  try {
    const text = await callAI([
      {
        role: 'user',
        content: `Rewrite and polish this cold email copy to maximize response rates.\nInstruction: ${instruction}\nOriginal Subject: ${subject || ''}\nOriginal Body:\n${body}\n\nReturn JSON with keys "subject" and "body_html". Do not use code block formatting.`
      }
    ]);

    let result = { subject: subject || 'Polished Outreach', body_html: text };
    try {
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      result = JSON.parse(cleanJsonStr);
    } catch (_) {}

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/spintax — Convert flat text to spintax format {hi|hello|hey} */
router.post('/spintax', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required.' });

  try {
    const spintaxText = await callAI([
      {
        role: 'user',
        content: `Convert the following email copy into high-deliverability Spintax format using {option1|option2|option3} syntax for key greetings, phrases, and verbs. Preserve any variable tags like {store_name} or {first_name}.\n\nOriginal Text:\n${text}`
      }
    ]);
    res.json({ success: true, spintax: spintaxText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/subjects — Generate subject line variants for A/B testing */
router.post('/subjects', async (req, res) => {
  const { body, count = 5 } = req.body;
  if (!body) return res.status(400).json({ error: 'Email body context is required.' });

  try {
    const text = await callAI([
      {
        role: 'user',
        content: `Generate ${count} punchy, high-open-rate cold email subject lines based on this email body:\n${body}\n\nReturn JSON as an array of strings under key "subjects".`
      }
    ]);

    let subjects = [];
    try {
      const cleanJsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      subjects = parsed.subjects || parsed;
    } catch (_) {
      subjects = text.split('\n').filter(Boolean).map(s => s.replace(/^\d+\.\s*/, '').trim());
    }

    res.json({ success: true, subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/reply-draft — Generate AI response to an incoming prospect reply */
router.post('/reply-draft', async (req, res) => {
  const { incomingSubject, incomingBody, senderEmail, contactFields = {} } = req.body;
  if (!incomingBody) return res.status(400).json({ error: 'Incoming email body is required.' });

  try {
    const dossierStr = Object.entries(contactFields).map(([k, v]) => `${k}: ${v}`).join(', ');

    const draft = await callAI([
      {
        role: 'user',
        content: `A prospect (${senderEmail}) replied to your email campaign.\nProspect Details: ${dossierStr}\nSubject: ${incomingSubject || ''}\nMessage Body:\n${incomingBody}\n\nWrite a friendly, professional, and conversion-focused reply addressing their message according to our AI Stage Rules.`
      }
    ]);

    res.json({ success: true, replyDraft: draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
