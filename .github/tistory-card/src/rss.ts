import { XMLParser } from 'fast-xml-parser';
import { decodeEntities, htmlToText } from './text.js';

export interface Post {
  title: string;
  link: string;
  summary: string;
  category: string;
  /** 본문의 첫 이미지 URL (없으면 null) */
  imageUrl: string | null;
  publishedAt: Date | null;
}

export interface Blog {
  name: string;
  title: string;
  host: string;
  posts: Post[];
}

export class BlogNotFoundError extends Error {}

/** 티스토리 블로그 아이디: 영문·숫자·하이픈 */
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/i;

export function isValidName(name: string): boolean {
  return NAME_RE.test(name);
}

const parser = new XMLParser({
  ignoreAttributes: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (tagName) => tagName === 'item' || tagName === 'category',
});

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return str((v as Record<string, unknown>)['#text']);
  }
  return '';
}

function firstImage(html: string): string | null {
  const m = html.match(/<img\b[^>]*?\ssrc=["']([^"']+)["']/i);
  if (!m) return null;
  const url = decodeEntities(m[1]).trim();
  return /^https?:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : null;
}

/** "개발/Spring" 같은 계층 카테고리는 마지막 칸만 */
function shortCategory(raw: string): string {
  const parts = raw.split('/').map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function parseFeed(xml: string, name: string): Blog {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) throw new BlogNotFoundError('RSS 형식이 아닙니다');

  const items: unknown[] = Array.isArray(channel.item) ? channel.item : [];
  const posts: Post[] = items.map((raw) => {
    const it = raw as Record<string, unknown>;
    const html = str(it.description);
    const categories = Array.isArray(it.category) ? it.category.map(str) : [];
    const date = new Date(str(it.pubDate));
    return {
      title: decodeEntities(str(it.title)).trim() || '(제목 없음)',
      link: str(it.link),
      summary: htmlToText(html),
      category: shortCategory(categories[0] ?? ''),
      imageUrl: firstImage(html),
      publishedAt: Number.isNaN(date.getTime()) ? null : date,
    };
  });

  return {
    name,
    title: decodeEntities(str(channel.title)).trim(),
    host: `${name}.tistory.com`,
    posts,
  };
}

export async function fetchBlog(name: string): Promise<Blog> {
  const res = await fetch(`https://${name}.tistory.com/rss`, {
    headers: { 'User-Agent': 'tistory-readme-card', Accept: 'application/rss+xml, application/xml, text/xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new BlogNotFoundError(`RSS 응답 ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, name);
}

/** 한국 시간 기준 날짜 */
export function formatDate(d: Date | null, short = false): string {
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return short ? `${get('month')}.${get('day')}` : `${get('year')}.${get('month')}.${get('day')}`;
}
