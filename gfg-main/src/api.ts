/**
 * api.ts — Type-safe API client for Peak Xender server connection.
 *
 * Automatically handles dev vs prod baseUrl selection, sets the security PIN
 * headers from sessionStorage, and processes JSON responses.
 */

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${hostname}:3000`;
  }
  return '';
};

const BASE_URL = getApiBaseUrl();

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface Account {
  id: number;
  email: string;
  status: 'active' | 'paused';
  daily_sent: number;
  last_reset: string | null;
  display_name: string;
  type: 'oauth' | 'smtp';
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: number | null;
  created_at: string;
}

export interface Contact {
  id: number;
  list_name: string;
  email: string;
  fields?: Record<string, string>;
  created_at: string;
}

export interface ContactListInfo {
  list_name: string;
  count: number;
}

export interface CampaignStep {
  id?: number;
  campaign_id?: number;
  step_number: number;
  subject: string;
  body_html: string;
  body_plain: string;
  delay_seconds: number;
}

export interface CampaignRecipient {
  recipient_email: string;
  status: 'active' | 'replied' | 'unsubscribed' | 'completed';
  current_step: number;
  last_sent_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_plain: string;
  contact_list: string;
  delay_seconds: number;
  start_time: string;
  end_time: string;
  status: 'draft' | 'sending' | 'paused' | 'completed';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  content_variations: string | null;
  content_mode: 'single' | 'rotation';
  created_at: string;
  queue_stats?: {
    pending?: number;
    sent?: number;
    failed?: number;
    sending?: number;
  };
  total_opens?: number;
  total_clicks?: number;
  steps?: CampaignStep[];
}

export interface QueueItem {
  id: number;
  campaign_id: number;
  recipient_email: string;
  account_id: number | null;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  scheduled_at: string;
  sent_at: string | null;
  error: string | null;
}

export interface QueueStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  sending: number;
}

export interface LogItem {
  id: number;
  campaign_id: number | null;
  account_id: number | null;
  recipient_email: string | null;
  status: string;
  message: string;
  created_at: string;
  sender_email?: string;
  campaign_name?: string;
  final_subject?: string;
  final_body?: string;
}

export interface Template {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_plain: string;
  created_at: string;
}

export interface AIConfig {
  configured: boolean;
  provider?: string;
  baseUrl?: string;
  model?: string;
  maskedApiKey?: string;
}

export interface AIRules {
  knowledge?: string;
  initial?: string;
  followup_1?: string;
  followup_2?: string;
  objection?: string;
}

export interface InboxMessage {
  id: number;
  account_id: number | null;
  account_email: string | null;
  sender_email: string;
  recipient_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  sentiment: 'hot_lead' | 'unsubscribe' | 'question' | 'neutral';
  is_read: number;
  created_at: string;
  contact_list?: string;
  contact_fields?: Record<string, string>;
  store_url?: string;
  store_name?: string;
}

// ---------------------------------------------------------------------------
// Base Fetch Wrapper
// ---------------------------------------------------------------------------

/** Clear expired token and redirect to login page */
function handleAuthError() {
  localStorage.removeItem('auth_token');
  // Only redirect if not already on login or landing page
  const path = window.location.pathname;
  if (path !== '/login' && path !== '/') {
    window.location.href = '/login';
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Set default headers
  const headers = new Headers(options.headers || {});
  
  // Add JSON content type if sending body
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject JWT Bearer token from localStorage if present
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Inject PIN fallback header from sessionStorage if present (used in local/dev)
  const pin = sessionStorage.getItem('access_pin');
  if (pin && !headers.has('X-Access-Pin')) {
    headers.set('X-Access-Pin', pin);
  }

  const res = await fetch(url, { ...options, headers });

  // Global 401 handler: token expired or invalid → clear & redirect
  if (res.status === 401) {
    handleAuthError();
    let errMsg = 'Session expired. Please log in again.';
    try {
      const errBody = await res.json();
      if (errBody.message || errBody.error) {
        errMsg = errBody.message || errBody.error;
      }
    } catch {
      // Ignore parsing error
    }
    throw new Error(errMsg);
  }
  
  if (!res.ok) {
    let errMsg = `API Error: ${res.statusText} (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody.message || errBody.error) {
        errMsg = errBody.message || errBody.error;
      }
    } catch {
      // Ignore parsing error
    }
    throw new Error(errMsg);
  }

  // Handle empty or redirect responses if needed
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export const api = {
  // Accounts
  getDashboardData: () => apiFetch<{
    stats: {
      today_sent: number;
      active_accounts: number;
      pending: number;
      active_campaigns: number;
      failed: number;
    };
    campaigns: Campaign[];
    queue: {
      id: number;
      recipient_email: string;
      campaign_name: string | null;
      account_email: string | null;
      status: string;
    }[];
  }>('/api/dashboard'),
  getAccounts: () => apiFetch<Account[]>('/api/accounts'),
  getAuthUrl: () => apiFetch<{ url: string }>('/api/accounts/auth-url', { method: 'POST' }),
  deleteAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' }),
  testAccount: (id: number, to: string) => apiFetch<{ success: boolean; message: string }>(`/api/accounts/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ to })
  }),
  resetAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/reset`, { method: 'POST' }),
  pauseAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/pause`, { method: 'POST' }),
  resumeAccount: (id: number) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/resume`, { method: 'POST' }),
  updateDisplayName: (id: number, displayName: string) => apiFetch<{ success: boolean }>(`/api/accounts/${id}/display-name`, {
    method: 'PUT',
    body: JSON.stringify({ display_name: displayName })
  }),
  connectSmtp: (data: {
    email: string;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    smtp_secure: boolean;
    display_name?: string;
  }) => apiFetch<{ success: boolean; message: string }>('/api/accounts/smtp', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Campaigns
  getCampaigns: () => apiFetch<Campaign[]>('/api/campaigns'),
  /** Create campaign from CSV data (emails, subjects, HTML template) and return campaign ID */
  createCampaignFromCsv: (data: {
    name: string;
    subjects: string[];
    recipients: { email: string; [key: string]: string }[];
    html_template: string;
    account_id?: number | null;
    delay_seconds?: number;
    start_time?: string;
    end_time?: string;
  }) => apiFetch<{ success: boolean; campaign_id: number; message: string }>('/api/campaigns/create-from-csv', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCampaign: (id: number) => apiFetch<Campaign>(`/api/campaigns/${id}`),
  createCampaign: (data: Partial<Campaign>) => apiFetch<{ success: boolean; id: number }>('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateCampaign: (id: number, data: Partial<Campaign>) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}`, { method: 'DELETE' }),
  launchCampaign: (id: number) => apiFetch<{ success: boolean; message: string }>(`/api/campaigns/${id}/launch`, { method: 'POST' }),
  pauseCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}/pause`, { method: 'POST' }),
  resumeCampaign: (id: number) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}/resume`, { method: 'POST' }),
  previewCampaign: (id: number, count?: number, step?: number) => apiFetch<{
    subject: string;
    body_html: string;
    recipient_email: string;
    sender_email: string | null;
  }[]>(`/api/campaigns/${id}/preview?${count ? `count=${count}&` : ''}${step ? `step=${step}` : ''}`),
  getCampaignRecipients: (id: number) => apiFetch<CampaignRecipient[]>(`/api/campaigns/${id}/recipients`),
  updateCampaignRecipientStatus: (id: number, email: string, status: string) => apiFetch<{ success: boolean }>(`/api/campaigns/${id}/recipients/status`, {
    method: 'POST',
    body: JSON.stringify({ email, status })
  }),

  // Contacts
  getContactLists: () => apiFetch<ContactListInfo[]>('/api/contacts/lists'),
  getContactHistory: (email: string) => apiFetch<{
    sends: (QueueItem & { campaign_name?: string })[];
    logs: LogItem[];
    replies: { id: number; sender_email: string; recipient_email: string; subject: string; body_text: string; sentiment: string; created_at: string }[];
  }>(`/api/contacts/history/${encodeURIComponent(email)}`),
  getContacts: (listName: string, limit?: number, offset?: number) => {
    const params = [];
    if (limit !== undefined) params.push(`limit=${limit}`);
    if (offset !== undefined) params.push(`offset=${offset}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return apiFetch<Contact[]>(`/api/contacts/${encodeURIComponent(listName)}${query}`);
  },
  uploadContacts: (listName: string, file: File) => {
    const formData = new FormData();
    formData.append('list_name', listName);
    formData.append('file', file);
    return apiFetch<{ success: boolean; added: number; skipped: number; total: number }>('/api/contacts/upload', {
      method: 'POST',
      body: formData
    });
  },
  importBulkContacts: (listName: string, contacts: { email: string; fields?: Record<string, string> }[]) => {
    return apiFetch<{ success: boolean; added: number; skipped: number; total: number }>('/api/contacts/import-bulk', {
      method: 'POST',
      body: JSON.stringify({ list_name: listName, contacts })
    });
  },
  addContact: (listName: string, email: string) => apiFetch<{ success: boolean; id: number }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ list_name: listName, email })
  }),
  deleteContactList: (listName: string) => apiFetch<{ success: boolean; deleted: number }>(`/api/contacts/${encodeURIComponent(listName)}`, {
    method: 'DELETE'
  }),
  deleteContact: (listName: string, id: number) => apiFetch<{ success: boolean }>(`/api/contacts/${encodeURIComponent(listName)}/${id}`, {
    method: 'DELETE'
  }),

  // Queue & Logs
  getQueueItems: (campaignId: number, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiFetch<QueueItem[]>(`/api/queue/${campaignId}${query}`);
  },
  getQueueStats: (campaignId: number) => apiFetch<QueueStats>(`/api/queue/${campaignId}/stats`),
  getRecentLogs: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return apiFetch<LogItem[]>(`/api/queue/logs/recent${query}`);
  },

  // Templates
  getTemplates: () => apiFetch<Template[]>('/api/templates'),
  getTemplate: (id: number) => apiFetch<Template>(`/api/templates/${id}`),
  createTemplate: (data: Partial<Template>) => apiFetch<{ success: boolean; id: number }>('/api/templates', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTemplate: (id: number, data: Partial<Template>) => apiFetch<{ success: boolean }>(`/api/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteTemplate: (id: number) => apiFetch<{ success: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),

  // Device/IP state persistence
  getDeviceState: (deviceId: string) => apiFetch<{
    emailText?: string;
    subject?: string;
    body?: string;
    userName?: string;
    cc?: string;
    bcc?: string;
    myInboxTo?: string;
    ccRoutingMode?: 'reroute' | 'normal';
    enableRandomization?: boolean;
    bccBatchSize?: number;
    bccBatchOpenCount?: number;
    autoScroll?: boolean;
    goalInput?: string;
    alarmIntervalStep?: string;
    csvMappings?: Record<string, string>;
    uploadedFileName?: string;
    parsedCSV?: any;
    activeVariables?: string[];
  } | null>(`/api/contacts/state/retrieve?device_id=${encodeURIComponent(deviceId)}`),
  
  saveDeviceState: (deviceId: string, stateData: any) => apiFetch<{ success: boolean }>('/api/contacts/state/save', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, state_data: stateData })
  }),

  // Auth
  getLoginUrl: () => apiFetch<{ url: string }>('/api/auth/google-url'),
  getCurrentUser: () => apiFetch<{ id: number; email: string; name: string; role: string; picture?: string }>('/api/auth/me'),
  updateProfile: (name: string, picture: string) => apiFetch<{ success: boolean; message: string }>('/api/auth/profile', {
    method: 'POST',
    body: JSON.stringify({ name, picture }),
  }),
  getSettings: () => apiFetch<{
    ADMIN_EMAIL: string;
    TRACKING_BASE_URL: string;
    SCHEDULER_BATCH_SIZE: string;
    DAILY_LIMIT_DEFAULT: string;
    SCHEDULER_ENABLED: string;
  }>('/api/auth/settings'),
  updateSettings: (settings: {
    ADMIN_EMAIL?: string;
    TRACKING_BASE_URL?: string;
    SCHEDULER_BATCH_SIZE?: string;
    DAILY_LIMIT_DEFAULT?: string;
  }) => apiFetch<{ success: boolean; message: string }>('/api/auth/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  }),
  logout: () => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('access_pin');
    return Promise.resolve({ success: true });
  },

  // AI Integration
  getAIConfig: () => apiFetch<AIConfig>('/api/ai/config'),
  saveAIConfig: (data: { provider: string; apiKey: string; baseUrl: string; model: string }) => apiFetch<{ success: boolean; message: string }>('/api/ai/config', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  testAIConnection: () => apiFetch<{ success: boolean; response?: string; error?: string }>('/api/ai/test', { method: 'POST' }),
  getAIRules: () => apiFetch<AIRules>('/api/ai/rules'),
  saveAIRules: (rules: AIRules) => apiFetch<{ success: boolean; message: string }>('/api/ai/rules', {
    method: 'POST',
    body: JSON.stringify({ rules })
  }),
  aiGenerate: (data: { prompt: string; stage?: string; contactFields?: Record<string, string> }) => apiFetch<{ success: boolean; subject: string; body_html: string }>('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  aiRewrite: (data: { subject?: string; body: string; instruction?: string }) => apiFetch<{ success: boolean; subject: string; body_html: string }>('/api/ai/rewrite', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  aiSpintax: (text: string) => apiFetch<{ success: boolean; spintax: string }>('/api/ai/spintax', {
    method: 'POST',
    body: JSON.stringify({ text })
  }),
  aiSubjects: (body: string, count?: number) => apiFetch<{ success: boolean; subjects: string[] }>('/api/ai/subjects', {
    method: 'POST',
    body: JSON.stringify({ body, count })
  }),
  aiReplyDraft: (data: { incomingSubject?: string; incomingBody: string; senderEmail: string; contactFields?: Record<string, string> }) => apiFetch<{ success: boolean; replyDraft: string }>('/api/ai/reply-draft', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Inbox & Two-Way Receiving
  getInboxMessages: (limit?: number) => apiFetch<InboxMessage[]>(`/api/inbox${limit ? `?limit=${limit}` : ''}`),
  syncInbox: () => apiFetch<{ success: boolean; message: string }>('/api/inbox/sync', { method: 'POST' }),
  markInboxRead: (id: number) => apiFetch<{ success: boolean }>(`/api/inbox/${id}/read`, { method: 'POST' }),
  replyToInboxMessage: (id: number, replyBody: string) => apiFetch<{ success: boolean; message: string }>(`/api/inbox/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ replyBody })
  }),
};
