import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../ui/button';
import BookshelfPanel from '../../BookshelfPanel';

interface BookshelfDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSide: 'left' | 'right';
  currentDafRef: string;
  onSelectCommentator: (side: 'left' | 'right', commentatorName: string) => void;
}

export const BookshelfDrawer: React.FC<BookshelfDrawerProps> = ({
  isOpen,
  onClose,
  activeSide,
  currentDafRef,
  onSelectCommentator,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-background h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h3 className="font-bold text-sm">Выбор комментатора ({activeSide === 'left' ? 'Левая колонка' : 'Правая колонка'})</h3>
            <p className="text-xs text-muted-foreground">Нажмите на автора для загрузки в колонку</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <BookshelfPanel
            sessionId="default"
            currentRef={currentDafRef}
            onItemClick={(item: any) => {
              const refStr = item.ref || item.key || item.baseRef || '';
              const refParts = refStr.split(' on ');
              const refCommentator = refParts.length > 1 ? refParts[0].trim() : '';
              const commentatorName = 
                item.metadata?.commentator || 
                item.commentator || 
                item.parsed?.commentator || 
                refCommentator || 
                item.collectiveTitle?.en || 
                item.title || 
                item.category;
              if (commentatorName) {
                onSelectCommentator(activeSide, commentatorName);
                onClose();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
