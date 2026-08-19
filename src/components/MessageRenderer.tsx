import React from "react";
import { Doc, DocV1 } from "../types/text";
import { getTextDirection } from '../utils/hebrewUtils';
import { debugLog } from '../utils/debugLogger';

/** 1) Декодирование HTML entities */
function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** 2) Безопасный escape */
/** 1) Безопасный escape */
// @ts-ignore
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}



/** 3) md-lite: декодируем entities, эскейпим, возвращаем React-ноды */
/** 2) Валидация ссылок: разрешаем только https, http, mailto, tel */
function sanitizeHref(href: string): string | null {
  try {
    const url = new URL(href, "http://localhost"); // base для относительных (мы не используем относительные)
    const allowed = ["http:", "https:", "mailto:", "tel:"];
    if (!allowed.includes(url.protocol)) return null;
    return href;
  } catch {
    // Если URL не распарсился — отклоняем
    return null;
  }
}

/** 3) md-lite: декодируем entities, эскейпим, возвращаем React-ноды */
function renderMdLite(text: string): React.ReactNode[] {
  if (!text) return [];

  // Сначала декодируем entities
  let t = decodeHtml(text);



  // Иначе рендерим как md (уже декодирован, не нужно повторно эскейпить)

  // Ссылки [text](url) -> <a>
  // Делаем в несколько проходов: вырезаем ссылки, собираем ноды
  const nodes: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(t)) !== null) {
    const before = t.slice(lastIndex, m.index);
    if (before) nodes.push(<span key={`t-${lastIndex}`}>{before}</span>);

    const label = m[1];
    const hrefRaw = m[2];
    const safeHref = sanitizeHref(hrefRaw);
    if (safeHref) {
      nodes.push(
        <a
          key={`a-${m.index}`}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 underline-offset-2 hover:underline focus:underline"
        >
          {label}
        </a>
      );
    } else {
      // Если ссылка невалидна, вывести как простой текст
      nodes.push(<span key={`bad-${m.index}`}>[{label}]({hrefRaw})</span>);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < t.length) nodes.push(<span key={`t-end`}>{t.slice(lastIndex)}</span>);

  // Теперь inline code `` -> <code>
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (typeof node === "string" || (React.isValidElement(node) && typeof node.props.children === "string")) {
      const raw = typeof node === "string" ? node : (node.props.children as string);
      const parts: React.ReactNode[] = [];
      const codeRegex = /`([^`]+)`/g;
      let j = 0;
      let cm: RegExpExecArray | null;
      while ((cm = codeRegex.exec(raw)) !== null) {
        const before = raw.slice(j, cm.index);
        if (before) parts.push(before);
        parts.push(
          <code key={`c-${i}-${cm.index}`} className="bg-muted px-1 rounded text-[0.95em]" dir="ltr">
            {cm[1]}
          </code>
        );
        j = cm.index + cm[0].length;
      }
      if (j < raw.length) parts.push(raw.slice(j));
      nodes[i] = React.isValidElement(node) ? React.cloneElement(node, {}, parts) : (parts as any);
    }
  }

  // Затем **bold** и *italic* — применяем к простым текстовым участкам
  function applyStrongEm(child: React.ReactNode, keyPrefix: string): React.ReactNode {
    if (typeof child !== "string") return child;
    let rest = child;

    // Сначала bold
    const strongRegex = /\*\*(.+?)\*\*/g;
    let si = 0;
    let sm: RegExpExecArray | null;
    const strongParts: React.ReactNode[] = [];
    while ((sm = strongRegex.exec(rest)) !== null) {
      const before = rest.slice(si, sm.index);
      if (before) strongParts.push(before);
      strongParts.push(<strong key={`${keyPrefix}-b-${sm.index}`}>{sm[1]}</strong>);
      si = sm.index + sm[0].length;
    }
    if (si < rest.length) strongParts.push(rest.slice(si));

    // Затем italic
    const finalParts: React.ReactNode[] = [];
    const italicRegex = /\*(.+?)\*/g;
    strongParts.forEach((p, idx) => {
      if (typeof p !== "string") return finalParts.push(p);
      let ii = 0;
      let im: RegExpExecArray | null;
      while ((im = italicRegex.exec(p)) !== null) {
        const before = p.slice(ii, im.index);
        if (before) finalParts.push(before);
        finalParts.push(<em key={`${keyPrefix}-i-${idx}-${im.index}`}>{im[1]}</em>);
        ii = im.index + im[0].length;
      }
      if (ii < p.length) finalParts.push(p.slice(ii));
    });

    return finalParts.length ? finalParts : child;
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n === "string") nodes[i] = applyStrongEm(n, `n-${i}`);
    else if (React.isValidElement(n)) {
      const kids = React.Children.toArray(n.props.children).map((k, idx) =>
        applyStrongEm(k as React.ReactNode, `k-${i}-${idx}`)
      );
      nodes[i] = React.cloneElement(n, {}, kids);
    }
  }

  return processXmlInNodes(nodes, 'xml');
}

/** 3.5) Парсинг кастомных XML-тегов: <ref tref="...">, <persn>, <person>, <concept>, <term> */
function applyCustomXmlTags(child: React.ReactNode, keyPrefix: string): React.ReactNode {
  if (typeof child !== "string") return child;
  if (!child || !child.includes("<")) return child;

  const tagRegex = /<(ref|persn|person|concept|term)(?:\s+tref=["']([^"']+)["'])?(?:\s*\/>|>([\s\S]*?)<\/\1>)/gi;

  const result: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(child)) !== null) {
    const before = child.slice(lastIdx, match.index);
    if (before) result.push(before);

    const tagType = match[1].toLowerCase();
    const trefAttr = match[2];
    const innerContent = match[3] ?? trefAttr ?? '';

    if (tagType === 'ref') {
      const targetRef = trefAttr || innerContent;
      result.push(
        <span
          key={`${keyPrefix}-ref-${match.index}`}
          onClick={(e) => {
            e.stopPropagation();
            if (targetRef) {
              window.dispatchEvent(new CustomEvent('study-navigate-ref', { detail: targetRef }));
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-mono font-semibold cursor-pointer hover:bg-amber-500/20 transition-all select-none"
          title={`Перейти к: ${targetRef}`}
        >
          📖 {innerContent}
        </span>
      );
    } else if (tagType === 'persn' || tagType === 'person') {
      result.push(
        <span
          key={`${keyPrefix}-persn-${match.index}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-xs font-semibold select-none"
        >
          👤 {innerContent}
        </span>
      );
    } else if (tagType === 'concept') {
      result.push(
        <span
          key={`${keyPrefix}-concept-${match.index}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-xs font-semibold select-none"
        >
          💡 {innerContent}
        </span>
      );
    } else if (tagType === 'term') {
      result.push(
        <span
          key={`${keyPrefix}-term-${match.index}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold select-none"
        >
          🏷️ {innerContent}
        </span>
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < child.length) {
    result.push(child.slice(lastIdx));
  }

  return result.length > 0 ? (result.length === 1 ? result[0] : result) : child;
}

function processXmlInNodes(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (typeof n === "string") {
      const res = applyCustomXmlTags(n, `${keyPrefix}-${i}`);
      if (Array.isArray(res)) result.push(...res);
      else result.push(res);
    } else if (React.isValidElement(n)) {
      const children = React.Children.toArray((n.props as any).children);
      const newChildren = processXmlInNodes(children, `${keyPrefix}-${i}`);
      result.push(React.cloneElement(n, { key: n.key || `${keyPrefix}-${i}` }, newChildren));
    } else {
      result.push(n);
    }
  });
  return result;
}

/** 4) Вспомогательные классы для callout в тёмной теме */
function calloutClass(variant?: string): string {
  const base = "mb-4 rounded-xl border px-4 py-3";
  switch (variant) {
    case "info":
      return `${base} border-sky-700 bg-sky-950/40`;
    case "warn":
      return `${base} border-amber-700 bg-amber-950/40`;
    case "success":
      return `${base} border-emerald-700 bg-emerald-950/40`;
    case "danger":
      return `${base} border-rose-700 bg-rose-950/40`;
    default:
      return `${base} border-border bg-muted/50`;
  }
}

interface MessageRendererProps {
  doc: Doc | DocV1;
}

interface StudyChatDoc {
  // Old format
  doc_version?: string;
  explanation?: {
    paragraphs: string[];
    quotes?: Array<{
      text: string;
      explanation?: string;
      source?: string;
      context?: string;
    }>;
    terms?: Array<{
      term: string;
      definition: string;
    }>;
  };
  // New format
  doc?: {
    version: string;
    content: Array<{
      type: 'paragraph' | 'quote' | 'term';
      text?: string;
      term?: string;
      definition?: string;
    }>;
  };
  // Direct format (current Study Chat output)
  version?: string;
  content?: Array<{
    type: 'paragraph' | 'quote' | 'term';
    text?: string;
    term?: string;
    definition?: string;
  }>;
  // Raw format (legacy Study Chat output)
  paragraph?: string;
  quote?: string;
  term?: {
    term: string;
    definition: string;
  };
}

function NewFormatStudyChatRenderer({ content }: { 
  content: Array<{
    type: 'paragraph' | 'quote' | 'term';
    text?: string;
    term?: string;
    definition?: string;
  }>;
}) {
  const paragraphs: string[] = [];
  const quotes: Array<{text: string}> = [];
  const terms: Array<{term: string; definition: string}> = [];

  // Group content by type
  content.forEach(item => {
    switch (item.type) {
      case 'paragraph':
        if (item.text) paragraphs.push(item.text);
        break;
      case 'quote':
        if (item.text) quotes.push({text: item.text});
        break;
      case 'term':
        if (item.term && item.definition) terms.push({term: item.term, definition: item.definition});
        break;
    }
  });

  return (
    <div className="space-y-6">
      {/* Main explanation paragraphs */}
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="leading-relaxed text-sm text-foreground" dir={getTextDirection(paragraph)}>
            {renderMdLite(paragraph)}
          </p>
        ))}
      </div>
      
      {/* Quotes section */}
      {quotes.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-600">"</span>
            </span>
            Ключевые цитаты
          </h3>
          <div className="space-y-4">
            {quotes.map((quote, index) => (
                     <div key={index} className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg p-4 border border-amber-200/30 dark:border-amber-800/30 shadow-sm force-system-font">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-white">"</span>
                  </div>
                  <blockquote className="text-sm italic text-gray-700 dark:text-gray-300 leading-relaxed flex-1" dir={getTextDirection(quote.text)}>
                    {renderMdLite(quote.text)}
                  </blockquote>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Terms section */}
      {terms.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">?</span>
            </span>
            Ключевые термины
          </h3>
          <div className="space-y-3">
            {terms.map((term, index) => (
              <div key={index} className="term">
                <div className="term-title" dir={getTextDirection(term.term)}>
                  {renderMdLite(term.term)}
                </div>
                <div className="term-definition" dir={getTextDirection(term.definition)}>
                  {renderMdLite(term.definition)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RawFormatStudyChatRenderer({ doc }: { doc: StudyChatDoc }) {
  const paragraphs: string[] = [];
  const quotes: string[] = [];
  const terms: Array<{term: string; definition: string}> = [];

  // Extract all paragraphs
  Object.keys(doc).forEach(key => {
    if (key === 'paragraph' && doc[key]) {
      paragraphs.push(doc[key] as string);
    }
  });

  // Extract all quotes
  Object.keys(doc).forEach(key => {
    if (key === 'quote' && doc[key]) {
      quotes.push(doc[key] as string);
    }
  });

  // Extract all terms
  Object.keys(doc).forEach(key => {
    if (key === 'term' && doc[key] && typeof doc[key] === 'object') {
      const term = doc[key] as {term: string; definition: string};
      if (term.term && term.definition) {
        terms.push(term);
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Main explanation paragraphs */}
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="leading-relaxed text-sm text-foreground" dir={getTextDirection(paragraph)}>
            {renderMdLite(paragraph)}
          </p>
        ))}
      </div>
      
      {/* Quotes section */}
      {quotes.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Key Quotes</h3>
          <div className="space-y-4">
            {quotes.map((quote, index) => (
              <div key={index} className="border-l-4 border-primary/30 pl-4 bg-muted/30 rounded-r-md p-3">
                <blockquote className="text-sm italic text-foreground mb-3 leading-relaxed" dir={getTextDirection(quote)}>
                  "{quote}"
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Terms section */}
      {terms.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">?</span>
            </span>
            Ключевые термины
          </h3>
          <div className="space-y-3">
            {terms.map((term, index) => (
              <div key={index} className="term">
                <div className="term-title" dir={getTextDirection(term.term)}>
                  {term.term}
                </div>
                <div className="term-definition" dir={getTextDirection(term.definition)}>
                  {term.definition}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StudyChatRenderer({ doc }: { doc: StudyChatDoc }) {
  // Handle raw format (current Study Chat output)
  if (doc.paragraph || doc.quote || doc.term) {
    return <RawFormatStudyChatRenderer doc={doc} />;
  }

  // Handle new format with doc.content
  if (doc.doc && doc.doc.content) {
    return <NewFormatStudyChatRenderer content={doc.doc.content} />;
  }

  // Handle direct format with version and content
  if (doc.version === 'doc.v1' && doc.content) {
    return <NewFormatStudyChatRenderer content={doc.content} />;
  }

  // Handle old format with explanation
  if (doc.explanation) {
    return (
      <div dir="auto" style={{ unicodeBidi: "plaintext" }} className="space-y-6">
        {/* Main explanation paragraphs */}
        <div className="space-y-4">
          {doc.explanation.paragraphs.map((paragraph, index) => (
            <p key={index} className="leading-relaxed text-sm text-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      
        {/* Quotes section */}
        {doc.explanation.quotes && doc.explanation.quotes.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-600">"</span>
              </span>
              Ключевые цитаты
            </h3>
            <div className="space-y-4">
              {doc.explanation.quotes.map((quote, index) => (
                     <div key={index} className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg p-4 border border-amber-200/30 dark:border-amber-800/30 shadow-sm force-system-font">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center mt-0.5">
                      <span className="text-xs font-bold text-white">"</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <blockquote className="text-sm italic text-gray-700 dark:text-gray-300 leading-relaxed mb-3" dir={getTextDirection(quote.text)}>
                        {quote.text}
                      </blockquote>
                      {quote.source && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
                          — {quote.source}
                        </p>
                      )}
                      {quote.context && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium bg-gray-100 dark:bg-gray-800 rounded px-2 py-1">
                          Контекст: {quote.context}
                        </p>
                      )}
                      {quote.explanation && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                          {quote.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Terms section */}
        {doc.explanation.terms && doc.explanation.terms.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">?</span>
              </span>
              Ключевые термины
            </h3>
            <div className="space-y-3">
              {doc.explanation.terms.map((term, index) => (
                <div key={index} className="term">
                  <div className="term-title">
                    {term.term}
                  </div>
                  <div className="term-definition">
                    {term.definition}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for unknown format
  return <div>Unknown Study Chat format</div>;
}

export function MessageRenderer({ doc }: MessageRendererProps) {
  // Debug: Log the document structure
  debugLog('🔍 MessageRenderer received doc:', doc);
  debugLog('🔍 Doc type:', typeof doc);
  debugLog('🔍 Doc keys:', Object.keys(doc));
  
  // Handle Study Chat format (old: doc_version + explanation, new: doc.content, direct format, raw format)
  if (((doc as any).doc_version === 'v1' && (doc as any).explanation) ||
      ((doc as any).doc && (doc as any).doc.version === 'v1' && (doc as any).doc.content) ||
      ((doc as any).version === 'doc.v1' && (doc as any).content) ||
      ((doc as any).paragraph || (doc as any).quote || (doc as any).term)) {
    debugLog('🎯 Using StudyChatRenderer for:', doc);
    return (
      <div className="doc">
        <StudyChatRenderer doc={doc as any} />
      </div>
    );
  }

  return (
    <div className="doc">
      {doc.blocks.map((rawBlock, index) => {
        // Handle cases where block data is nested inside a `data` property
        const block = (rawBlock as any).data ? { ...rawBlock, ...(rawBlock as any).data } : rawBlock;
        switch (block.type) {
          case "heading": {
            const lvl = Math.min(6, Math.max(1, Number(block.level) || 2));
            const HeadingTag = `h${lvl}` as keyof JSX.IntrinsicElements;
            return (
              <HeadingTag
                key={index}
                className="mt-6 mb-2 font-semibold tracking-tight"
                lang={block.lang}
                dir={block.dir || "auto"}
              >
                {block.text}
              </HeadingTag>
            );
          }

          case "paragraph": {
            const t = typeof block.text === "string" ? block.text : String(block.text ?? "");
            const paragraphs = t.split(/\n\n+/).filter(Boolean);
            if (paragraphs.length <= 1) {
              return (
                <p key={index} lang={block.lang} dir={block.dir || "auto"}>
                  {renderMdLite(t)}
                </p>
              );
            }
            return (
              <React.Fragment key={index}>
                {paragraphs.map((pText, pIdx) => (
                  <p key={`${index}-${pIdx}`} lang={block.lang} dir={block.dir || "auto"}>
                    {renderMdLite(pText)}
                  </p>
                ))}
              </React.Fragment>
            );
          }

          case "quote": {
            const t = typeof block.text === "string" ? block.text : String(block.text ?? "");
            return (
              <blockquote key={index} lang={block.lang} dir={block.dir || "auto"}>
                {renderMdLite(t)}
                {block.source && (
                  <cite className="block mt-2 text-sm text-neutral-400 not-italic">— {block.source}</cite>
                )}
              </blockquote>
            );
          }

          case "list":
            return block.ordered ? (
              <ol key={index}>
                {block.items?.map((item: string, itemIndex: number) => {
                  const itemText = typeof item === "string" ? item : String(item ?? "");
                  return (
                    <li key={itemIndex} dir={getTextDirection(itemText)}>
                      {renderMdLite(itemText)}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <ul key={index}>
                {block.items?.map((item: string, itemIndex: number) => {
                  const itemText = typeof item === "string" ? item : String(item ?? "");
                  return (
                    <li key={itemIndex} dir={getTextDirection(itemText)}>
                      {renderMdLite(itemText)}
                    </li>
                  );
                })}
              </ul>
            );

          case "term":
            debugLog('🔍 Term block data:', block);
            debugLog('🔍 Available keys:', Object.keys(block));
            debugLog('🔍 Block values:', {
              he: block.he,
              text: block.text,
              term: block.term,
              ru: block.ru,
              definition: block.definition,
              en: block.en
            });
            
            // Show empty terms for debugging - we need to see what's happening
            const hasContent = block.he || block.text || block.term || block.ru || block.definition || block.en;
            if (!hasContent) {
              debugLog('⚠️ Empty term block - showing for debugging');
              return (
                <div key={index} className="bg-red-100 border border-red-300 rounded p-2 text-red-800 text-sm">
                  <strong>DEBUG: Empty Term Block</strong>
                  <pre>{JSON.stringify(block, null, 2)}</pre>
                </div>
              );
            }
            
            const termText = block.he || block.text || block.term || 'Термин не найден';
            const definitionText = block.ru || block.definition || block.en || 'Определение не найдено';
            
            return (
              <div key={index} className="term">
                <div className="term-title" dir={getTextDirection(termText)}>
                  {termText}
                </div>
                <div className="term-definition" dir={getTextDirection(definitionText)}>
                  {definitionText}
                </div>
              </div>
            );

          case "callout":
            const calloutText = block.text || "";
            return (
              <div key={index} className={calloutClass(block.variant)} dir={getTextDirection(calloutText)}>
                {renderMdLite(calloutText)}
              </div>
            );

          case "action":
            return (
              <button
                key={index}
                className="rounded-2xl px-4 py-2 border border-border hover:bg-accent"
                onClick={() => window.dispatchEvent(new CustomEvent("doc-action", { detail: block }))}
              >
                {block.label}
              </button>
            );

          case "code":
            return (
              <pre key={index}>
                <code lang={block.lang}>{block.code}</code>
              </pre>
            );

          case "hr":
            return <hr key={index} />;

          case "image":
            return (
              <figure key={index}>
                <img src={block.url} alt={block.alt || ""} loading="lazy" decoding="async" />
                {block.caption && <figcaption>{renderMdLite(block.caption)}</figcaption>}
              </figure>
            );

          case "table":
            return (
              <table key={index}>
                {block.headers && block.headers.length > 0 && (
                  <thead>
                    <tr>
                      {block.headers.map((header: string, i: number) => (
                        <th key={i}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {block.rows?.map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex}>
                      {row.map((cell: string, cellIndex: number) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );

          default:
            // Явно показываем неизвестные блоки в Dev
            if (process.env.NODE_ENV !== "production") {
              return (
                <div key={index} className="mb-4 rounded-xl border border-amber-700 bg-amber-950/20 px-3 py-2 text-sm">
                  Unsupported block <code>{String((block as any)?.type || "unknown")}</code>
                </div>
              );
            }
            return null;
        }
      })}
    </div>
  );
}