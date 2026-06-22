/**
 * api.ts — Type-safe API client for Peak Xender server connection.
 *
 * Automatically handles dev vs prod baseUrl selection, sets the security PIN
 * headers from sessionStorage, and processes JSON responses.
 */

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

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

// ---------------------------------------------------------------------------
// Base Fetch Wrapper
// ---------------------------------------------------------------------------

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

  const res = await fetch(url, { ...options, headers });
  
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
  getContacts: (listName: string) => apiFetch<Contact[]>(`/api/contacts/${encodeURIComponent(listName)}`),
  uploadContacts: (listName: string, file: File) => {
    const formData = new FormData();
    formData.append('list_name', listName);
    formData.append('file', file);
    return apiFetch<{ success: boolean; added: number; skipped: number; total: number }>('/api/contacts/upload', {
      method: 'POST',
      body: formData
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
};
