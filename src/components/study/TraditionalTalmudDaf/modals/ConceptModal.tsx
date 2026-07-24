import React, { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Button } from '../../../ui/button';
import { cn } from '../../../../lib/utils';
import { ConceptHighlight } from '../../types/highlight';

interface ConceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  concepts: ConceptHighlight[];
  onLinkConcept: (conceptSlug: string) => void;
  onSaveConcept: (termHe: string, pattern: string, summary: string) => void;
}

export const ConceptModal: React.FC<ConceptModalProps> = ({
  isOpen,
  onClose,
  selectedText = '',
  concepts,
  onLinkConcept,
  onSaveConcept,
}) => {
  const [conceptMode, setConceptMode] = useState<'create' | 'link'>('create');
  const [conceptSearchQuery, setConceptSearchQuery] = useState('');
  const [conceptTermHe, setConceptTermHe] = useState(selectedText);
  const [conceptPattern, setConceptPattern] = useState(selectedText);
  const [conceptSummary, setConceptSummary] = useState('');

  useEffect(() => {
    setConceptTermHe(selectedText);
    setConceptPattern(selectedText);
  }, [selectedText]);

  const filteredConcepts = useMemo(() => {
    if (!conceptSearchQuery.trim()) return concepts;
    const q = conceptSearchQuery.toLowerCase();
    return concepts.filter(c =>
      (c.term_he && c.term_he.toLowerCase().includes(q)) ||
      (c.slug && c.slug.toLowerCase().includes(q))
    );
  }, [concepts, conceptSearchQuery]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!conceptTermHe.trim() || !conceptPattern.trim()) return;
    onSaveConcept(conceptTermHe.trim(), conceptPattern.trim(), conceptSummary.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-md w-full p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-bold text-sm">Фраза / Понятие: «{selectedText}»</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex bg-muted/40 p-1 rounded-lg gap-1 text-xs font-medium">
          <button
            className={cn("flex-1 py-1 rounded transition-all", conceptMode === 'create' ? "bg-background text-foreground shadow-sm font-bold" : "opacity-60 hover:opacity-100")}
            onClick={() => setConceptMode('create')}
          >
            + Новое понятие с описанием
          </button>
          <button
            className={cn("flex-1 py-1 rounded transition-all", conceptMode === 'link' ? "bg-background text-foreground shadow-sm font-bold" : "opacity-60 hover:opacity-100")}
            onClick={() => setConceptMode('link')}
          >
            Связать с существующим
          </button>
        </div>

        {conceptMode === 'link' ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 opacity-50" />
              <input
                type="text"
                value={conceptSearchQuery}
                onChange={(e) => setConceptSearchQuery(e.target.value)}
                placeholder="Поиск существующего понятия..."
                className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
              {filteredConcepts.length > 0 ? (
                filteredConcepts.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => onLinkConcept(c.slug)}
                    className="flex flex-col p-2 rounded-md hover:bg-primary/10 text-right transition-colors text-xs"
                  >
                    <span className="font-bold">{c.term_he || c.slug}</span>
                    {c.short_summary_html && (
                      <span
                        className="text-[10px] opacity-60 font-sans line-clamp-1"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.short_summary_html) }}
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-xs opacity-60">Понятия не найдены</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 text-xs">
            <label className="font-medium">Название понятия / выражения:</label>
            <input
              type="text"
              value={conceptTermHe}
              onChange={(e) => setConceptTermHe(e.target.value)}
              className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
              dir="rtl"
            />

            <label className="font-medium flex items-center justify-between">
              <span>Шаблон совпадения (с [WILD]):</span>
              <button
                type="button"
                className="text-primary hover:underline text-[10px]"
                onClick={() => setConceptPattern(prev => `${prev} [WILD]`)}
              >
                + Вставить [WILD]
              </button>
            </label>
            <input
              type="text"
              value={conceptPattern}
              onChange={(e) => setConceptPattern(e.target.value)}
              placeholder="Пример: ואזל [WILD] לטעמיה"
              className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
              dir="rtl"
            />

            <label className="font-medium">Описание / определение фразы (выводится в всплывающей карточке):</label>
            <textarea
              value={conceptSummary}
              onChange={(e) => setConceptSummary(e.target.value)}
              placeholder="Введите описание, разбор или комментарий к этой фразе..."
              rows={3}
              className="bg-muted/30 border border-border rounded px-2 py-1.5 text-xs resize-none"
            />

            <span className="text-[10px] opacity-60">Токен [WILD] совпадает с 1-3 переменными еврейскими словами с огласовками.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>
            Отмена
          </Button>
          {conceptMode === 'create' && (
            <Button size="sm" className="text-xs font-bold" onClick={handleSave}>
              Сохранить фразу и описание
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
