import React, { useState, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Button } from '../../../ui/button';
import { SageHighlight } from '../../types/highlight';

interface SageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  sages: SageHighlight[];
  onLinkSage: (sageSlug: string) => void;
  onCreateNewSageClick: () => void;
}

export const SageSearchModal: React.FC<SageSearchModalProps> = ({
  isOpen,
  onClose,
  selectedText,
  sages,
  onLinkSage,
  onCreateNewSageClick,
}) => {
  const [sageSearchQuery, setSageSearchQuery] = useState('');

  const filteredSages = useMemo(() => {
    if (!sageSearchQuery.trim()) return sages;
    const q = sageSearchQuery.toLowerCase();
    return sages.filter(s =>
      (s.name_he && s.name_he.toLowerCase().includes(q)) ||
      (s.name_ru && s.name_ru.toLowerCase().includes(q)) ||
      (s.slug && s.slug.toLowerCase().includes(q))
    );
  }, [sages, sageSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-md w-full p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-bold text-sm">Связать текст «{selectedText}» с мудрецом</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 opacity-50" />
          <input
            type="text"
            value={sageSearchQuery}
            onChange={(e) => setSageSearchQuery(e.target.value)}
            placeholder="Поиск мудреца (имя, slug)..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
          {filteredSages.length > 0 ? (
            filteredSages.map(s => (
              <button
                key={s.slug}
                onClick={() => onLinkSage(s.slug)}
                className="flex items-center justify-between p-2 rounded-md hover:bg-primary/10 text-right transition-colors text-xs"
              >
                <span className="font-bold">{s.name_he || s.slug}</span>
                <span className="text-[10px] opacity-60 font-sans">{s.name_ru || s.period}</span>
              </button>
            ))
          ) : (
            <div className="text-center py-4 text-xs opacity-60">Мудрецы не найдены</div>
          )}
        </div>

        <div className="border-t border-border pt-2 flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={onCreateNewSageClick}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Создать нового мудреца</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
};
