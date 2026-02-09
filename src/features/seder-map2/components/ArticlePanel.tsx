import { useEffect, useMemo, useRef } from 'react';
import { Edit3, Eye, Save, ChevronRight } from 'lucide-react';
import styles from '../SederMap2.module.css';
import Markdown from '@/features/seder-map/components/Markdown';

type Props = {
  nodeId: string | null;
  titleRu: string;
  titleHe: string;
  fallbackTitleRu: string;
  fallbackTitleHe: string;
  textRu: string;
  textHe: string;
  mode: 'ru' | 'he';
  editing: boolean;
  canEdit: boolean;
  onModeChange: (mode: 'ru' | 'he') => void;
  onEditToggle: () => void;
  onSave: () => void;
  onChange: (patch: { textRu?: string; textHe?: string }) => void;
  onLinkClick: (nodeId: string) => void;
  breadcrumbs: Array<{ id: string; title: string }>;
  onBreadcrumbClick: (nodeId: string) => void;
};

const linkPattern = /\[\[node:([a-f0-9-]{8,})\|([^\]]+)\]\]/gi;

function transformLinks(content: string) {
  return content.replace(linkPattern, (_m, id, label) => `[${label}](node:${id})`);
}

export default function ArticlePanel({
  nodeId,
  titleRu,
  titleHe,
  fallbackTitleRu,
  fallbackTitleHe,
  textRu,
  textHe,
  mode,
  editing,
  canEdit,
  onModeChange,
  onEditToggle,
  onSave,
  onChange,
  onLinkClick,
  breadcrumbs,
  onBreadcrumbClick,
}: Props) {
  const content = mode === 'ru' ? textRu : textHe;
  const rendered = useMemo(() => transformLinks(content || ''), [content]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPlaceholderRu = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    return !trimmed || trimmed === 'новый узел' || trimmed === 'new node';
  };
  const isPlaceholderHe = (value: string) => !value.trim();

  const displayTitle = mode === 'ru'
    ? (!isPlaceholderRu(titleRu) ? titleRu : (fallbackTitleRu || 'Без названия'))
    : (!isPlaceholderHe(titleHe) ? titleHe : (fallbackTitleHe || 'ללא כותרת'));

  useEffect(() => {
    if (!editing || !textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [content, editing]);

  return (
    <div
      className={styles.articlePanel}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.articleHeader}>
        <div className={styles.langTabs}>
          <button
            type="button"
            className={`${styles.langTab} ${mode === 'ru' ? styles.activeTab : ''}`}
            onClick={() => onModeChange('ru')}
          >
            RU
          </button>
          <button
            type="button"
            className={`${styles.langTab} ${mode === 'he' ? styles.activeTab : ''}`}
            onClick={() => onModeChange('he')}
          >
            HE
          </button>
        </div>
        <div className={styles.actionsRow}>
          {canEdit ? (
            <>
              <button
                type="button"
                className={styles.iconButton}
                onClick={onEditToggle}
                title={editing ? 'Предпросмотр' : 'Редактировать'}
              >
                {editing ? <Eye size={18} /> : <Edit3 size={18} />}
              </button>
              {editing ? (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.saveButton}`}
                  onClick={onSave}
                  disabled={!nodeId}
                  title="Сохранить"
                >
                  <Save size={18} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {breadcrumbs.length ? (
        <div className={styles.articleBreadcrumbs}>
          {breadcrumbs.map((b, idx) => (
            <div key={`${b.id}-${idx}`} className={styles.breadcrumbItem}>
              <button type="button" onClick={() => onBreadcrumbClick(b.id)}>
                {b.title || b.id}
              </button>
              {idx < breadcrumbs.length - 1 ? <ChevronRight size={12} className={styles.breadcrumbSep} /> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.scroller}>
        <div className={styles.articleContainer}>
          <h1 className={styles.heroTitle} dir={mode === 'he' ? 'rtl' : 'ltr'}>
            {displayTitle}
          </h1>
          <div
            className={styles.articleBody}
            dir={mode === 'he' ? 'rtl' : 'ltr'}
            onClick={(e) => {
              const target = e.target as HTMLElement | null;
              if (!target) return;
              const link = target.closest('a') as HTMLAnchorElement | null;
              if (!link) return;
              const href = link.getAttribute('href') || '';
              if (href.startsWith('node:')) {
                e.preventDefault();
                onLinkClick(href.slice(5));
              }
            }}
          >
            {editing ? (
              <textarea
                ref={textareaRef}
                className={styles.articleEditor}
                value={content}
                placeholder="Начните писать здесь..."
                onChange={(e) => onChange(mode === 'ru' ? { textRu: e.target.value } : { textHe: e.target.value })}
                spellCheck={false}
              />
            ) : (
              <Markdown className={styles.markdownContent} content={rendered || '*Нет описания*'} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
