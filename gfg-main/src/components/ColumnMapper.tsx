import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { suggestFieldMapping, normalizeHeaderKey, type ParsedCSV } from '@/lib/csvParser';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ColumnMapperProps {
  isOpen: boolean;
  onClose: () => void;
  parsedCSV: ParsedCSV;
  fileName: string;
  onConfirm: (mappings: Record<string, string>) => void;
}

const AVAILABLE_VARIABLES = [
  { value: 'email', label: 'Email Address (Required)', desc: 'Used as recipient email' },
  { value: 'first_name', label: 'First Name ({{first_name}})', desc: 'Recipient\'s first name' },
  { value: 'store_name', label: 'Store Name ({{store_name}})', desc: 'Store/Website name' },
  { value: 'niche', label: 'Niche ({{niche}})', desc: 'Niche/Vertical/Industry' },
  { value: 'pain_point', label: 'Pain Point ({{pain_point}})', desc: 'Customer pain point' },
];

export function ColumnMapper({ isOpen, onClose, parsedCSV, fileName, onConfirm }: ColumnMapperProps) {
  const { headers, rows } = parsedCSV;
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Build dynamic variables from CSV headers that aren't covered by the built-in 5
  const dynamicVariables = useMemo(() => {
    const builtInKeys = new Set(AVAILABLE_VARIABLES.map(v => v.value));
    const dynamics: { value: string; label: string; desc: string }[] = [];
    const seenKeys = new Set<string>();

    for (const header of headers) {
      const builtInMatch = suggestFieldMapping(header);
      if (builtInMatch) continue; // Already covered by a built-in variable

      const key = normalizeHeaderKey(header);
      if (!key || builtInKeys.has(key) || seenKeys.has(key)) continue;
      seenKeys.add(key);

      dynamics.push({
        value: key,
        label: `${header} ({{${key}}})`,
        desc: `Custom field from CSV column "${header}"`,
      });
    }
    return dynamics;
  }, [headers]);

  // Merged list: built-in + dynamic
  const allVariables = useMemo(
    () => [...AVAILABLE_VARIABLES, ...dynamicVariables],
    [dynamicVariables]
  );

  // Auto-map headers when CSV changes
  useEffect(() => {
    if (headers.length > 0) {
      const initial: Record<string, string> = {};
      const usedTargets = new Set<string>();

      headers.forEach(header => {
        const suggestion = suggestFieldMapping(header);
        if (suggestion && !usedTargets.has(suggestion)) {
          initial[header] = suggestion;
          usedTargets.add(suggestion);
        } else {
          // Auto-map custom columns to their own normalized key
          const key = normalizeHeaderKey(header);
          const isDynamic = dynamicVariables.some(d => d.value === key);
          initial[header] = isDynamic ? key : 'skip';
        }
      });
      setMappings(initial);
    }
  }, [headers, dynamicVariables]);

  const handleMappingChange = (header: string, target: string) => {
    // If setting to a target variable that is already mapped elsewhere, clear the previous mapping
    const next = { ...mappings };
    if (target !== 'skip') {
      Object.keys(next).forEach(key => {
        if (next[key] === target) {
          next[key] = 'skip';
        }
      });
    }
    next[header] = target;
    setMappings(next);
  };

  const handleConfirm = () => {
    // Validate that at least one column maps to email
    const emailHeader = Object.keys(mappings).find(key => mappings[key] === 'email');
    if (!emailHeader) {
      toast({
        title: "Mapping Validation Failed",
        description: "You must map at least one CSV column to 'Email Address (Required)'.",
        variant: "destructive"
      });
      return;
    }

    onConfirm(mappings);
    toast({
      title: "CSV Import Success",
      description: `Loaded ${rows.length.toLocaleString()} leads from ${fileName}.`
    });
  };

  // Preview only up to 3 rows
  const previewRows = rows.slice(0, 3);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-background border-border p-6 rounded-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Map CSV Columns — {fileName}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            We found <span className="font-bold text-foreground">{rows.length} leads</span>. Tell us which columns represent your template variables.
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-3 max-h-[60vh] overflow-y-auto pr-1">
          {/* Variable chips display */}
          <div className="bg-primary/[0.03] border border-primary/10 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">Available Substitution Placeholders</h4>
            <p className="text-[10px] text-muted-foreground">
              You can insert these placeholders in your subject and body. They will be auto-replaced for each lead.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allVariables.map(v => (
                <Badge key={v.value} variant="secondary" className={`font-mono text-[9px] px-2 py-0.5 border bg-card/60 ${
                  dynamicVariables.some(d => d.value === v.value)
                    ? 'border-primary/30 text-primary'
                    : 'border-border text-foreground'
                }`}>
                  {`{{${v.value}}}`}
                </Badge>
              ))}
            </div>
          </div>

          {/* Mapping Table */}
          <div className="rounded-xl border border-border/60 overflow-hidden bg-card/20">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="p-3 font-semibold text-muted-foreground w-1/3">CSV Column Header</th>
                  <th className="p-3 font-semibold text-muted-foreground w-1/3">Maps to Variable</th>
                  <th className="p-3 font-semibold text-muted-foreground w-1/3">Sample Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {headers.map(header => {
                  const currentValue = mappings[header] || 'skip';
                  const sampleValue = rows[0]?.[header] || '';

                  return (
                    <tr key={header} className="hover:bg-muted/10">
                      <td className="p-3 font-bold text-foreground truncate max-w-[180px]" title={header}>
                        {header}
                      </td>
                      <td className="p-2">
                        <select
                          value={currentValue}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-md h-8 px-1.5 focus:outline-none text-[11px] font-semibold text-foreground cursor-pointer"
                        >
                          <option value="skip">❌ [ Skip Column ]</option>
                          {allVariables.map(v => (
                            <option key={v.value} value={v.value}>
                              {currentValue === v.value ? '✅ ' : ''}{v.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-[180px]" title={sampleValue}>
                        {sampleValue || <span className="text-muted-foreground/30 italic">empty</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Preview rows section */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">CSV Data Preview (First 3 Rows)</h4>
            <div className="rounded-xl border border-border/40 overflow-hidden overflow-x-auto bg-muted/5 max-w-full">
              <table className="w-full text-[10px] text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    {headers.map(h => (
                      <th key={h} className="p-2 border-r border-border/30 font-bold text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      {headers.map(h => (
                        <td key={h} className="p-2 border-r border-border/20 text-foreground whitespace-nowrap max-w-[150px] truncate">
                          {row[h] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/40 flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Mapping "Email" is required.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="text-xs peak-gradient-bg border-none text-white font-semibold px-4 hover:opacity-90 transition-opacity">
              Confirm &amp; Import Leads
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
