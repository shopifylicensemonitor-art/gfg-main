import { useState, useMemo, useCallback, useId } from 'react';
import { suggestFieldMapping, extractEmailsAndUrlsFromCell, type ParsedCSV } from '@/lib/csvParser';
import { Search, AlertCircle, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileSpreadsheet, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface CSVPreviewProps {
  parsedCSV: ParsedCSV;
  fileName: string;
  mappings?: Record<string, string>;
  onClearPreview?: () => void;
}

export function CSVPreview({ parsedCSV, fileName, mappings = {}, onClearPreview }: CSVPreviewProps) {
  const { headers, rows } = parsedCSV;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const uid = useId();
  const bodyId = `csv-preview-body-${uid}`;
  const itemsPerPage = 10;

  // 1. Identify which CSV column key maps to 'email'
  const emailColKey = useMemo(() => {
    const keyFromMappings = Object.keys(mappings).find(k => mappings[k] === 'email');
    if (keyFromMappings) return keyFromMappings;

    let found = headers.find(h => suggestFieldMapping(h) === 'email');
    if (!found) {
      found = headers.find(h => h.toLowerCase().includes('email'));
    }
    return found || headers[0] || '';
  }, [headers, mappings]);

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // Helper to validate email cell content
  const validateEmailInRow = useCallback((row: Record<string, string>) => {
    const rawVal = row[emailColKey]?.trim() || '';
    if (!rawVal) return { isValid: false, emailStr: '' };
    const { emails } = extractEmailsAndUrlsFromCell(rawVal);
    if (emails.length === 0) return { isValid: false, emailStr: rawVal };
    const isValid = emailRegex.test(emails[0]);
    return { isValid, emailStr: emails[0] };
  }, [emailColKey, emailRegex]);

  // 2. Classify rows based on email presence/validity
  const rowsWithStats = useMemo(() => {
    return rows.map((row, index) => {
      const { isValid, emailStr } = validateEmailInRow(row);
      return {
        row,
        index: index + 1,
        emailVal: emailStr || row[emailColKey] || '',
        isValidEmail: isValid && emailStr !== '',
        hasEmail: emailStr !== ''
      };
    });
  }, [rows, emailColKey, validateEmailInRow]);

  // Compute counts for the segmented tab badges
  const counts = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    rowsWithStats.forEach(r => {
      if (r.isValidEmail) valid++;
      else invalid++;
    });
    return { all: rows.length, valid, invalid };
  }, [rowsWithStats, rows.length]);

  // 3. Search and Status Filtering
  const filteredRows = useMemo(() => {
    let result = rowsWithStats;

    // Filter by status tab
    if (statusFilter === 'valid') {
      result = result.filter(r => r.isValidEmail);
    } else if (statusFilter === 'invalid') {
      result = result.filter(r => !r.isValidEmail);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        return Object.values(r.row).some(val => val.toLowerCase().includes(q));
      });
    }

    return result;
  }, [rowsWithStats, statusFilter, searchQuery]);

  const validRows = useMemo(() => rowsWithStats.filter(r => r.isValidEmail), [rowsWithStats]);

  const toggleSelectAll = useCallback(() => {
    const validIndexes = validRows.map(r => r.index);
    const allSelected = validIndexes.every(idx => selectedIndices.has(idx));
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(validIndexes));
    }
  }, [validRows, selectedIndices]);

  // 4. Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  
  // Adjust current page if filters shrink total pages
  const activePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, activePage]);

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-4 sm:p-5 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-primary/20">
      {/* Top Header Collapsible Card Bar */}
      <div className="flex items-center justify-between gap-3 select-none">
        <button
          type="button"
          onClick={() => setIsCollapsed(prev => !prev)}
          className="flex items-center gap-3 text-left focus:outline-none flex-1 group cursor-pointer"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-foreground tracking-tight">
                CSV Data Inspector
              </h3>
              {fileName && (
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 font-semibold">
                  {fileName}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5 bg-primary/10 text-primary border-none">
                {rows.length} Leads
              </Badge>
              {counts.valid > 0 && (
                <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
                  {counts.valid} Valid Emails
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isCollapsed ? 'Click card to expand CSV data preview & mapped columns' : 'Explore CSV columns, mapped field values, and target emails.'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {onClearPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClearPreview();
              }}
              className="h-8 text-[10px] px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl flex items-center gap-1 font-bold uppercase tracking-wider transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Unload CSV</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="h-8 w-8 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title={isCollapsed ? 'Expand CSV Inspector' : 'Collapse CSV Inspector'}
            aria-label={isCollapsed ? 'Expand CSV Inspector' : 'Collapse CSV Inspector'}
            aria-expanded={!isCollapsed}
            aria-controls={bodyId}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-primary animate-bounce-slow" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Content Body */}
      {!isCollapsed && (
        <div id={bodyId} className="space-y-4 pt-3 border-t border-border/30 animate-in fade-in slide-in-from-top-2 duration-200">

      {/* Search & Segments Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 pl-8 pr-3 text-[11px] rounded-lg bg-background/50 border-muted"
          />
        </div>

        {/* Segmented Filter */}
        <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/20 self-start sm:self-auto gap-0.5">
          <Button
            variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-7 text-[10px] px-2.5 rounded-md flex items-center gap-1.5 font-medium ${
              statusFilter === 'all' ? 'text-primary bg-secondary' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            All Rows
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-normal text-muted-foreground/70 border-muted/50">{counts.all}</Badge>
          </Button>

          <Button
            variant={statusFilter === 'valid' ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-7 text-[10px] px-2.5 rounded-md flex items-center gap-1.5 font-medium ${
              statusFilter === 'valid' ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setStatusFilter('valid');
              setCurrentPage(1);
            }}
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            With Email
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-normal text-emerald-500/80 border-emerald-500/20">{counts.valid}</Badge>
          </Button>

          <Button
            variant={statusFilter === 'invalid' ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-7 text-[10px] px-2.5 rounded-md flex items-center gap-1.5 font-medium ${
              statusFilter === 'invalid' ? 'text-rose-500 bg-rose-500/10' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setStatusFilter('invalid');
              setCurrentPage(1);
            }}
          >
            <XCircle className="h-3 w-3 text-rose-500" />
            No Email
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-normal text-rose-500/80 border-rose-500/20">{counts.invalid}</Badge>
          </Button>
        </div>
      </div>

      {/* Main Table Preview */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-card/20 max-w-full overflow-x-auto scrollbar-thin">
        <div className="bg-muted/20 px-3 py-1.5 border-b border-border/30 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIndices.size > 0 && selectedIndices.size === counts.valid}
              onChange={toggleSelectAll}
              className="rounded border-muted text-primary focus:ring-primary/20 cursor-pointer"
            />
            <span className="font-mono text-muted-foreground">
              {selectedIndices.size > 0 ? `${selectedIndices.size} selected` : 'Select All Valid Emails'}
            </span>
          </div>
          {selectedIndices.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIndices(new Set())}
              className="h-5 text-[9px] px-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            >
              Clear Selection
            </Button>
          )}
        </div>
        <table className="w-full text-[11px] text-left border-collapse font-sans min-w-[600px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="p-2.5 font-semibold text-muted-foreground w-8 text-center">
                <input
                  type="checkbox"
                  checked={selectedIndices.size > 0 && selectedIndices.size === counts.valid}
                  onChange={toggleSelectAll}
                  className="rounded border-muted text-primary focus:ring-primary/20 cursor-pointer"
                />
              </th>
              <th className="p-2.5 font-semibold text-muted-foreground w-10 text-center">Row</th>
              <th className="p-2.5 font-semibold text-muted-foreground w-48">Recipient Email</th>
              {headers.map(h => {
                const mappedTag = mappings[h] && mappings[h] !== 'skip' && mappings[h] !== 'email' ? `{{${mappings[h]}}}` : `{{${h}}}`;
                return (
                  <th
                    key={h}
                    onClick={() => {
                      navigator.clipboard.writeText(mappedTag);
                      toast({ title: 'Copied Variable', description: `Copied ${mappedTag} to clipboard!` });
                    }}
                    className="p-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-primary transition-colors group"
                    title={`Click to copy ${mappedTag}`}
                  >
                    <span className="flex items-center gap-1">
                      {h}
                      <span className="text-[9px] opacity-0 group-hover:opacity-100 text-primary">📋</span>
                    </span>
                    <span className="block text-[8px] text-primary font-mono lowercase font-normal mt-0.5">
                      {mappedTag}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {paginatedRows.length > 0 ? (
              paginatedRows.map(({ row, index, emailVal, isValidEmail, hasEmail }) => {
                const isSelected = selectedIndices.has(index);
                return (
                  <tr key={index} className={`hover:bg-muted/10 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIndices(prev => {
                            const next = new Set(prev);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          });
                        }}
                        className="rounded border-muted text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground/60 font-mono">
                      {index}
                    </td>
                  <td className="p-2">
                    {hasEmail ? (
                      <div className="flex items-center gap-1.5">
                        {isValidEmail ? (
                          <Badge variant="outline" className="text-[8px] h-4.5 px-1 bg-emerald-500/5 border-emerald-500/25 text-emerald-500 flex items-center gap-0.5 select-none font-bold uppercase tracking-wide">
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] h-4.5 px-1 bg-rose-500/5 border-rose-500/25 text-rose-500 flex items-center gap-0.5 select-none font-bold uppercase tracking-wide">
                            <XCircle className="h-2.5 w-2.5 shrink-0" />
                            Format Error
                          </Badge>
                        )}
                        <span className={`font-mono truncate max-w-[150px] ${isValidEmail ? 'text-foreground' : 'text-rose-500 font-semibold'}`}>
                          {emailVal}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px] h-4.5 px-1 bg-rose-500/5 border-rose-500/25 text-rose-500 flex items-center gap-0.5 select-none font-bold uppercase tracking-wide">
                          <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                          Missing
                        </Badge>
                        <span className="italic text-muted-foreground/30 font-serif text-[10px]">not mapped</span>
                      </div>
                    )}
                  </td>
                  {headers.map(h => {
                    const cellVal = row[h] || '';
                    return (
                      <td key={h} className="p-2.5 text-muted-foreground truncate max-w-[140px]" title={cellVal}>
                        {cellVal || <span className="text-muted-foreground/20 italic font-mono text-[9px]">empty</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : (
              <tr>
                <td colSpan={headers.length + 2} className="p-8 text-center text-muted-foreground italic text-xs">
                  No records match your filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
          <span>
            Showing page <strong className="text-foreground">{activePage}</strong> of <strong className="text-foreground">{totalPages}</strong> ({filteredRows.length} total matched)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg border-border/60 hover:bg-muted"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-lg border-border/60 hover:bg-muted"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
