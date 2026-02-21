import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="glass-card flex items-center gap-2 rounded-2xl p-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
      <Search className="ml-3 h-5 w-5 text-primary/60" />
      <Input
        type="text"
        placeholder="Search emails globally..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
