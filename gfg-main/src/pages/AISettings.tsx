import React, { useState, useEffect } from 'react';
import { api, type AIConfig, type AIRules } from '../api';
import { AppShell } from '@/components/AppShell';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Sparkles, Key, Globe, Cpu, CheckCircle2, AlertTriangle, 
  RefreshCw, Save, BookOpen, Layers, Bot, ExternalLink, HelpCircle
} from 'lucide-react';

interface AIProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  getKeyUrl: string;
  badge?: string;
}

const PROVIDERS: AIProviderPreset[] = [
  {
    id: 'nvidia',
    name: 'Nvidia NIM API',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    getKeyUrl: 'https://build.nvidia.com/explore/discover',
    badge: 'Enterprise Performance'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    getKeyUrl: 'https://openrouter.ai/keys',
    badge: '200+ Models'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    getKeyUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-flash',
    getKeyUrl: 'https://aistudio.google.com/apikey'
  },
  {
    id: 'groq',
    name: 'Groq API',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    getKeyUrl: 'https://console.groq.com/keys',
    badge: 'Ultra Fast'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    getKeyUrl: 'https://platform.deepseek.com/api_keys'
  },
  {
    id: 'custom',
    name: 'Custom / Self-Hosted',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3:latest',
    getKeyUrl: '',
    badge: 'Ollama / Local'
  }
];

export default function AISettings() {
  const [activeTab, setActiveTab] = useState<'connection' | 'rules'>('connection');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Connection State
  const [selectedProvider, setSelectedProvider] = useState<string>('openrouter');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('https://openrouter.ai/api/v1');
  const [model, setModel] = useState<string>('openai/gpt-4o-mini');
  const [maskedKey, setMaskedKey] = useState<string>('');

  // AI Rules State
  const [rules, setRules] = useState<AIRules>({
    knowledge: '',
    initial: '',
    followup_1: '',
    followup_2: '',
    objection: ''
  });
  const [savingRules, setSavingRules] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [config, rulesData] = await Promise.all([
        api.getAIConfig().catch(() => ({ configured: false })),
        api.getAIRules().catch(() => ({}))
      ]);

      if (config && config.configured) {
        setSelectedProvider(config.provider || 'custom');
        setBaseUrl(config.baseUrl || 'https://openrouter.ai/api/v1');
        setModel(config.model || 'openai/gpt-4o-mini');
        setMaskedKey(config.maskedApiKey || '');
      }

      setRules({
        knowledge: rulesData.knowledge || '',
        initial: rulesData.initial || '',
        followup_1: rulesData.followup_1 || '',
        followup_2: rulesData.followup_2 || '',
        objection: rulesData.objection || ''
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error loading settings', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: AIProviderPreset) => {
    setSelectedProvider(preset.id);
    setBaseUrl(preset.baseUrl);
    setModel(preset.defaultModel);
    setTestResult(null);
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey && !maskedKey) {
      toast({ variant: 'destructive', title: 'API Key Required', description: 'Please enter a valid API key for your chosen provider.' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveAIConfig({
        provider: selectedProvider,
        apiKey: apiKey || maskedKey, // Fallback if unmodified
        baseUrl,
        model
      });
      toast({ title: 'AI Configuration Saved', description: res.message });
      setApiKey('');
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (apiKey) {
        await api.saveAIConfig({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          baseUrl,
          model
        });
        setApiKey('');
      }
      const res = await api.testAIConnection();
      if (res.success) {
        setTestResult({ success: true, message: res.response || 'Connection verified successfully!' });
        toast({ title: 'AI Connection Verified', description: 'AI responded cleanly to test prompt.' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed.' });
      }
      loadData();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const res = await api.saveAIRules(rules);
      toast({ title: 'AI Rules Saved', description: res.message });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to Save Rules', description: err.message });
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <AppShell>
      <SEO title="AI Settings & Rules | Peak Xender" description="Configure AI providers and automated outreach stage rules." />
      
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              <h1 className="text-2xl font-extrabold tracking-tight">AI Settings & Autonomous Rules</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Connect any OpenAI-compatible AI API (Nvidia NIM, OpenRouter, OpenAI, Gemini, Groq, DeepSeek) and set your outreach SOP guidelines.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('connection')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'connection' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              API Connections
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'rules' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Outreach Rules & SOPs
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading AI Configuration...</span>
          </div>
        ) : activeTab === 'connection' ? (
          /* TAB 1: API Connection & Provider Hub */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Presets Column */}
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Supported AI Providers
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select a preset to auto-configure server URLs and default models.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {PROVIDERS.map((preset) => {
                    const isSelected = selectedProvider === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 font-semibold'
                            : 'border-border hover:border-muted-foreground/40 bg-card'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{preset.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                            {preset.baseUrl}
                          </div>
                        </div>
                        {preset.badge && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-primary/40 text-primary">
                            {preset.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Config Form Column */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Provider Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure server endpoints and API key. Keys are encrypted server-side and never exposed to the client.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleSaveConnection} className="space-y-5">
                    {/* API Key */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-primary" />
                          API Key
                        </span>
                        {PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl && (
                          <a
                            href={PROVIDERS.find(p => p.id === selectedProvider)?.getKeyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline flex items-center gap-1"
                          >
                            Get Key <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </label>
                      <Input
                        type="password"
                        placeholder={maskedKey ? `Configured (${maskedKey}) — Paste new key to update` : 'Paste your API key here...'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Base / Server URL */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        Server / Base URL
                      </label>
                      <Input
                        type="text"
                        placeholder="https://openrouter.ai/api/v1"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Must point to an OpenAI-compatible `/v1` base endpoint.
                      </p>
                    </div>

                    {/* Model Selector / Custom String */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-primary" />
                        Model Identifier String
                      </label>
                      <Input
                        type="text"
                        placeholder="meta/llama-3.3-70b-instruct or gpt-4o-mini"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Type any custom model string supported by your provider (e.g. <code className="bg-muted px-1 rounded">meta/llama-3.3-70b-instruct</code>, <code className="bg-muted px-1 rounded">gpt-4o-mini</code>, <code className="bg-muted px-1 rounded">deepseek-chat</code>).
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-border">
                      <Button type="submit" disabled={saving} className="font-semibold text-xs gap-1.5">
                        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Configuration
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="text-xs gap-1.5"
                      >
                        {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                        Test Connection
                      </Button>
                    </div>
                  </form>

                  {/* Test Result Display */}
                  {testResult && (
                    <div className={`mt-4 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 border-destructive/30 text-destructive'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <div>
                        <div className="font-bold">{testResult.success ? 'Connection Successful!' : 'Connection Failed'}</div>
                        <div className="mt-0.5 text-[11px] opacity-90">{testResult.message}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* TAB 2: AI Rules & SOP Roadmap Engine */
          <div className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Knowledge Base & Campaign Stage Guidelines
                </CardTitle>
                <CardDescription>
                  Train your AI assistant on your company offer, brand voice, and stage-by-stage follow-up roadmaps. The AI will strictly follow these guidelines when writing copy and drafting replies.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSaveRules} className="space-y-6">
                  {/* Knowledge Base */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      1. Brand Knowledge Base & Offer Context
                    </label>
                    <Textarea
                      rows={3}
                      placeholder="Describe your company, main value proposition, key offer, target audience, and pricing/demo URLs..."
                      value={rules.knowledge || ''}
                      onChange={(e) => setRules({ ...rules, knowledge: e.target.value })}
                      className="text-xs font-sans"
                    />
                  </div>

                  {/* Initial Outreach SOP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      2. Initial Cold Email Stage Rule
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Keep under 100 words, start with a personalized compliment about {store_name}, focus on low-friction CTA (asking for opinion or feedback)."
                      value={rules.initial || ''}
                      onChange={(e) => setRules({ ...rules, initial: e.target.value })}
                      className="text-xs font-sans"
                    />
                  </div>

                  {/* Follow-up 1 SOP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      3. First Follow-Up Stage Rule
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Send 2-3 days after initial. Provide a short 1-line case study or social proof angle. Do not sound pushy."
                      value={rules.followup_1 || ''}
                      onChange={(e) => setRules({ ...rules, followup_1: e.target.value })}
                      className="text-xs font-sans"
                    />
                  </div>

                  {/* Follow-up 2 SOP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      4. Second / Breakup Follow-Up Stage Rule
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Final push. Friendly permission to close the file. Ask if now is a bad time."
                      value={rules.followup_2 || ''}
                      onChange={(e) => setRules({ ...rules, followup_2: e.target.value })}
                      className="text-xs font-sans"
                    />
                  </div>

                  {/* Objection Handling SOP */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                      5. Objection & Inquiry Handling Guidelines
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. If prospect asks for pricing, explain ROI first. If prospect says not interested, thank them gracefully and ask if we can check back in Q4."
                      value={rules.objection || ''}
                      onChange={(e) => setRules({ ...rules, objection: e.target.value })}
                      className="text-xs font-sans"
                    />
                  </div>

                  <div className="pt-3 border-t border-border">
                    <Button type="submit" disabled={savingRules} className="font-semibold text-xs gap-1.5">
                      {savingRules ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save AI Rules & SOPs
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
