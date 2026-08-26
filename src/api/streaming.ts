import { DocV1 } from '../types/text';

export interface StreamEvent<T = unknown> {
  type: string;
  data?: T;
}

export interface StreamHandler {
  onDraft?: (payload: any) => void;
  onChunk?: (chunk: string) => void;
  onDoc?: (doc: DocV1) => void;
  onBlockStart?: (blockData: any) => void;
  onBlockDelta?: (blockData: any) => void;
  onBlockEnd?: (blockData: any) => void;
  onEvent?: (event: StreamEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function extractObjects(input: string): { objects: string[]; rest: string } {
  const objects: string[] = [];
  let i = 0;
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  while (i < input.length) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(input.slice(start, i + 1));
        start = -1;
      }
    }
    i += 1;
  }
  const rest = depth === 0 ? '' : start >= 0 ? input.slice(start) : input;
  return { objects, rest };
}

export async function processStream(
  response: Response,
  handler: StreamHandler
): Promise<void> {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const json = JSON.parse(errorText);
      if (json.detail) {
        errorMessage = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
      }
    } catch {}
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  const idToIndex = new Map<string, number>();
  let nextIndex = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      handler.onComplete?.();
      break;
    }

    buffer += value;
    const chunks: string[] = [];
    if (buffer.includes('\n')) {
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (t) chunks.push(t);
      }
    }
    const extracted = extractObjects(buffer);
    if (extracted.objects.length) {
      chunks.push(...extracted.objects.map(s => s.trim()));
      buffer = extracted.rest;
    }

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      if (!trimmed.startsWith('{')) {
        // Plain text / markdown chunk
        handler.onChunk?.(chunk);
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed);

        if (parsed && typeof parsed === 'object' && typeof parsed.op === 'string') {
          const op = parsed.op as string;
          if (op === 'add_block' && parsed.data && typeof parsed.data.id === 'string') {
            const { id, type, meta } = parsed.data as { id: string; type?: string; meta?: any };
            if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
            const block_index = idToIndex.get(id)!;
            const t = (type || 'p').toLowerCase();
            let block: any = { text: '' };
            let block_type_for_event = 'paragraph';
            if (t === 'h1') { block = { type: 'heading', level: 1, text: '', meta }; block_type_for_event = 'heading'; }
            else if (t === 'h2') { block = { type: 'heading', level: 2, text: '', meta }; block_type_for_event = 'heading'; }
            else if (t === 'quote') { block = { type: 'quote', text: '', meta }; block_type_for_event = 'quote'; }
            else if (t === 'hr') { block = { type: 'hr' }; block_type_for_event = 'hr'; }
            else { block = { type: 'paragraph', text: '', meta }; block_type_for_event = 'paragraph'; }

            handler.onBlockStart?.({ block_index, block_type: block_type_for_event, block_id: id, block });
            handler.onEvent?.({ type: 'block_start', data: { block_index, block_type: block_type_for_event, block_id: id } });
            handler.onBlockDelta?.({ block_index, content: block, block: block, delta_type: 'replace' });
            continue;
          }
          if (op === 'append_text' && parsed.data && typeof parsed.data.id === 'string') {
            const { id, text } = parsed.data as { id: string; text: string };
            if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
            const block_index = idToIndex.get(id)!;
            handler.onBlockDelta?.({ block_index, content: { text }, block: { text }, delta_type: 'append' });
            handler.onEvent?.({ type: 'block_delta', data: { block_index } });
            continue;
          }
          if (op === 'end') {
            handler.onComplete?.();
            return;
          }
          continue;
        }

        const event = parsed as StreamEvent;
        switch (event.type) {
          case 'block_start': {
            handler.onBlockStart?.(event.data as any);
            handler.onEvent?.(event);
            break;
          }
          case 'block_delta': {
            handler.onBlockDelta?.(event.data as any);
            handler.onEvent?.(event);
            break;
          }
          case 'block_end': {
            handler.onBlockEnd?.(event.data as any);
            handler.onEvent?.(event);
            break;
          }
          case 'llm_chunk': {
            const chunkText = typeof event.data === 'string' ? event.data : '';
            if (chunkText) {
              handler.onChunk?.(chunkText);
              handler.onDraft?.(event.data as any);
            }
            handler.onEvent?.(event);
            break;
          }
          case 'doc_v1': {
            handler.onDoc?.(event.data as DocV1);
            handler.onEvent?.(event);
            break;
          }
          case 'full_response': {
            const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            handler.onChunk?.(text);
            handler.onEvent?.(event);
            break;
          }
          case 'error': {
            handler.onEvent?.(event);
            const message = typeof event.data === 'string' ? event.data : 'Stream error';
            handler.onError?.(new Error(message));
            break;
          }
          default: {
            handler.onEvent?.(event);
            break;
          }
        }
      } catch {
        // Fallback to plain text chunk if JSON parse fails
        handler.onChunk?.(chunk);
      }
    }
  }
}
