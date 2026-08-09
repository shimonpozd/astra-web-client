import { apiRequest } from './client';

export async function getSederMap(): Promise<any> {
  return apiRequest<any>('/seder/map');
}

export async function getSederNode(nodeId: string): Promise<any> {
  return apiRequest<any>(`/seder/node/${encodeURIComponent(nodeId)}`);
}

export async function getSederArticle(articleId: string): Promise<any> {
  return apiRequest<any>(`/seder/article/${encodeURIComponent(articleId)}`);
}

export async function updateSederArticle(articleId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/article/${encodeURIComponent(articleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getSederArticleSegments(articleId: string): Promise<any> {
  return apiRequest<any>(`/seder/article/${encodeURIComponent(articleId)}/segments`);
}

export async function createSederArticle(payload: any): Promise<any> {
  return apiRequest<any>('/seder/article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createSederSegments(articleId: string, payload: any[]): Promise<any> {
  return apiRequest<any>(`/seder/article/${encodeURIComponent(articleId)}/segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSederSegment(segmentId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/segment/${encodeURIComponent(segmentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getSederSegmentVersions(segmentId: string): Promise<any> {
  return apiRequest<any>(`/seder/segment/${encodeURIComponent(segmentId)}/versions`);
}

export async function restoreSederSegmentVersion(segmentId: string, versionId: string): Promise<any> {
  return apiRequest<any>(`/seder/segment/${encodeURIComponent(segmentId)}/restore/${encodeURIComponent(versionId)}`, {
    method: 'POST',
  });
}

export async function upsertSederSegmentLinks(segmentId: string, links: any[]): Promise<any> {
  return apiRequest<any>(`/seder/segment/${encodeURIComponent(segmentId)}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(links),
  });
}

export async function getSederDefinitions(): Promise<any> {
  return apiRequest<any>('/seder/definitions');
}

export async function getSederDefinitionInstances(definitionId: string): Promise<any> {
  return apiRequest<any>(`/seder/definition/${encodeURIComponent(definitionId)}/instances`);
}

export async function getSederLayouts(): Promise<any> {
  return apiRequest<any>('/seder/layouts');
}

export async function getSederDomains(): Promise<any> {
  return apiRequest<any>('/seder/domains');
}

export async function createSederLayout(payload: any): Promise<any> {
  return apiRequest<any>('/seder/layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSederLayout(layoutId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/layouts/${encodeURIComponent(layoutId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSederDomain(domainId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/domains/${encodeURIComponent(domainId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createSederDomain(payload: any): Promise<any> {
  return apiRequest<any>('/seder/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSederDomain(domainId: string): Promise<any> {
  return apiRequest<any>(`/seder/domains/${encodeURIComponent(domainId)}`, {
    method: 'DELETE',
  });
}

export async function createSederEdge(payload: any): Promise<any> {
  return apiRequest<any>('/seder/edge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSederEdge(edgeId: string): Promise<any> {
  return apiRequest<any>(`/seder/edge/${encodeURIComponent(edgeId)}`, {
    method: 'DELETE',
  });
}

export async function updateSederNode(nodeId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/node/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createSederNode(payload: any): Promise<any> {
  return apiRequest<any>('/seder/node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSederNode(nodeId: string): Promise<any> {
  return apiRequest<any>(`/seder/node/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });
}

export async function createSederNote(payload: any): Promise<any> {
  return apiRequest<any>('/seder/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateSederNote(noteId: string, payload: any): Promise<any> {
  return apiRequest<any>(`/seder/note/${encodeURIComponent(noteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSederNote(noteId: string): Promise<any> {
  return apiRequest<any>(`/seder/note/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
}
