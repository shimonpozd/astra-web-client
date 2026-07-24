import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../ui/button';

interface CreateSageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onCreateAndLink: (name: string, period: string, periodRu: string) => void;
}

export const CreateSageModal: React.FC<CreateSageModalProps> = ({
  isOpen,
  onClose,
  initialName = '',
  onCreateAndLink,
}) => {
  const [newSageName, setNewSageName] = useState(initialName);
  const [newSagePeriod, setNewSagePeriod] = useState('amoraim');
  const [newSagePeriodRu, setNewSagePeriodRu] = useState('Амораим');

  useEffect(() => {
    setNewSageName(initialName);
  }, [initialName]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!newSageName.trim()) return;
    onCreateAndLink(newSageName.trim(), newSagePeriod, newSagePeriodRu);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-sm w-full p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-bold text-sm">Создание карточки мудреца</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <label className="font-medium">Имя на иврите / slug:</label>
          <input
            type="text"
            value={newSageName}
            onChange={(e) => setNewSageName(e.target.value)}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
            dir="rtl"
          />

          <label className="font-medium">Эпоха (Period):</label>
          <select
            value={newSagePeriod}
            onChange={(e) => {
              setNewSagePeriod(e.target.value);
              setNewSagePeriodRu(e.target.options[e.target.selectedIndex].text);
            }}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
          >
            <option value="amoraim">Амораим</option>
            <option value="tannaim">Таннаим</option>
            <option value="zugot">Зугот</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" className="text-xs font-bold" onClick={handleSubmit}>
            Создать и связать
          </Button>
        </div>
      </div>
    </div>
  );
};
