import { generateId, type ReferenceAuthor, type ReferenceSource } from '@qiuai/shared';

interface CrossrefMessageAuthor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  affiliation?: Array<{ name?: string }>;
}

interface CrossrefMessage {
  DOI?: string;
  type?: string;
  title?: string[];
  subtitle?: string[];
  author?: CrossrefMessageAuthor[];
  editor?: CrossrefMessageAuthor[];
  issued?: { 'date-parts'?: number[][] };
  publisher?: string;
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  URL?: string;
  ISSN?: string[];
  ISBN?: string[];
  language?: string;
  abstract?: string;
  subject?: string[];
}

function mapAuthor(author: CrossrefMessageAuthor): ReferenceAuthor {
  return {
    family: author.family,
    given: author.given,
    literal: author.name,
    orcid: author.ORCID?.replace('https://orcid.org/', ''),
    affiliation: author.affiliation?.map((item) => item.name).filter(Boolean).join('; '),
  };
}

function mapCrossrefType(type?: string): ReferenceSource['type'] {
  switch (type) {
    case 'journal-article':
      return 'journal-article';
    case 'proceedings-article':
      return 'conference-paper';
    case 'dissertation':
      return 'thesis';
    case 'book':
      return 'book';
    case 'book-chapter':
      return 'book-chapter';
    case 'report':
      return 'report';
    case 'standard':
      return 'standard';
    case 'dataset':
      return 'dataset';
    default:
      return 'other';
  }
}

function extractYear(message: CrossrefMessage): string | undefined {
  const year = message.issued?.['date-parts']?.[0]?.[0];
  return typeof year === 'number' ? String(year) : undefined;
}

function stripJatsTags(input?: string): string | undefined {
  if (!input) return undefined;
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class CrossrefService {
  async importByDoi(rawDoi: string): Promise<ReferenceSource> {
    const doi = rawDoi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    if (!doi) {
      throw new Error('DOI 不能为空');
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': `QiuAI-Editor/0.1 (mailto:${process.env.CROSSREF_CONTACT_EMAIL || 'support@example.com'})`,
    };

    if (process.env.CROSSREF_CONTACT_EMAIL) {
      headers['mailto'] = process.env.CROSSREF_CONTACT_EMAIL;
    }

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Crossref 查询失败: ${response.status}`);
    }

    const payload = (await response.json()) as { message?: CrossrefMessage };
    const message = payload.message;

    if (!message?.title?.[0]) {
      throw new Error('Crossref 未返回有效文献元数据');
    }

    const now = new Date().toISOString();

    return {
      id: generateId(),
      type: mapCrossrefType(message.type),
      title: message.title[0],
      subtitle: message.subtitle?.[0],
      authors: (message.author ?? []).map(mapAuthor),
      editors: (message.editor ?? []).map(mapAuthor),
      year: extractYear(message),
      issuedDate: message.issued?.['date-parts']?.[0]?.join('-'),
      publisher: message.publisher,
      containerTitle: message['container-title']?.[0],
      volume: message.volume,
      issue: message.issue,
      pages: message.page,
      doi: message.DOI,
      url: message.URL,
      isbn: message.ISBN?.[0],
      issn: message.ISSN?.[0],
      language: message.language,
      abstract: stripJatsTags(message.abstract),
      keywords: message.subject ?? [],
      sourceProvider: 'crossref',
      sourceRaw: payload as Record<string, unknown>,
      localAttachmentIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const crossrefService = new CrossrefService();
