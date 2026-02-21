import { useState, useEffect } from 'react';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const TEMPLATES_KEY = 'bulk-email-templates';

export function useTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch {
        localStorage.removeItem(TEMPLATES_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }, [templates]);

  const saveTemplate = (name: string, subject: string, body: string) => {
    const newTemplate: EmailTemplate = {
      id: `template-${Date.now()}`,
      name,
      subject,
      body,
    };
    setTemplates((prev) => [...prev, newTemplate]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return { templates, saveTemplate, deleteTemplate };
}
