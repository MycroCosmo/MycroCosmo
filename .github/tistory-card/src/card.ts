import type { Blog, Post } from './rss.js';
import { formatDate } from './rss.js';
import { escapeXml as x, measure, truncate, wrap } from './text.js';
import { FONT_FAMILY, THEMES, type Theme, type ThemeName } from './theme.js';

const W = 495;
const PAD_X = 22;
const RIGHT = W - PAD_X; // 473

function frame(t: Theme, h: number, label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-labelledby="card-title">
<title id="card-title">${x(label)}</title>
<style>text{font-family:${FONT_FAMILY}}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>`;
}

function header(t: Theme, host: string, label: string, right: number): string {
  const labelW = measure(label, 12, true);
  const hostText = truncate(host, right - 38 - labelW - 12, 12);
  return `<circle cx="26" cy="28" r="4" fill="${t.accent}"/>
<text x="38" y="32" font-size="12" fill="${t.muted}">${x(hostText)}</text>
<text x="${right}" y="32" font-size="12" font-weight="600" fill="${t.accent}" text-anchor="end">${x(label)}</text>`;
}

export interface LatestOptions {
  theme: ThemeName;
  /** base64 data URI. null이면 썸네일 칸 없이 글 영역을 넓게 씀 */
  thumbnail: string | null;
}

export function renderLatest(blog: Blog, post: Post, opts: LatestOptions): string {
  const t = THEMES[opts.theme];
  const H = 195;
  const THUMB = 120;
  const hasThumb = Boolean(opts.thumbnail);
  const contentRight = hasThumb ? RIGHT - THUMB - 18 : RIGHT;
  const contentW = contentRight - PAD_X;

  const parts: string[] = [header(t, blog.host, '최신 글', contentRight)];

  // 제목 (최대 2줄)
  const titleLines = wrap(post.title, contentW, 18, 2, true);
  let y = 66;
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="${PAD_X}" y="${y + i * 24}" font-size="18" font-weight="700" fill="${t.title}">${x(line)}</text>`,
    );
  });
  y += (titleLines.length - 1) * 24;

  // 요약 (최대 2줄)
  if (post.summary) {
    const summaryLines = wrap(post.summary, contentW, 13, 2);
    summaryLines.forEach((line, i) => {
      parts.push(
        `<text x="${PAD_X}" y="${y + 25 + i * 19.5}" font-size="13" fill="${t.muted}">${x(line)}</text>`,
      );
    });
  }

  // 하단: 카테고리 칩 + 날짜
  let footerX = PAD_X;
  if (post.category) {
    const chip = truncate(post.category, 140, 12, true);
    const chipW = Math.ceil(measure(chip, 12, true)) + 16;
    parts.push(
      `<rect x="${PAD_X}" y="152" width="${chipW}" height="22" rx="11" fill="${t.chipBg}"/>`,
      `<text x="${PAD_X + 8}" y="167" font-size="12" font-weight="600" fill="${t.accent}">${x(chip)}</text>`,
    );
    footerX += chipW + 8;
  }
  const date = formatDate(post.publishedAt);
  if (date) {
    parts.push(`<text x="${footerX}" y="167" font-size="12" fill="${t.muted}">${date}</text>`);
  }

  // 썸네일
  if (hasThumb) {
    const tx = RIGHT - THUMB;
    const ty = (H - THUMB) / 2;
    parts.push(
      `<clipPath id="thumb-clip"><rect x="${tx}" y="${ty}" width="${THUMB}" height="${THUMB}" rx="8"/></clipPath>`,
      `<rect x="${tx}" y="${ty}" width="${THUMB}" height="${THUMB}" rx="8" fill="${t.thumbBg}"/>`,
      `<image href="${opts.thumbnail}" x="${tx}" y="${ty}" width="${THUMB}" height="${THUMB}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumb-clip)"/>`,
    );
  }

  return frame(t, H, `${blog.title || blog.host} 최신 글: ${post.title}`, parts.join('\n'));
}

export interface ListOptions {
  theme: ThemeName;
  count: number;
}

export function renderList(blog: Blog, posts: Post[], opts: ListOptions): string {
  const t = THEMES[opts.theme];
  const rows = posts.slice(0, opts.count);
  const H = 68 + 40 * rows.length;
  const CAT_W = 64;
  const TITLE_X = PAD_X + CAT_W + 12;
  const DATE_W = 40;
  const titleW = RIGHT - DATE_W - 12 - TITLE_X;

  const parts: string[] = [header(t, blog.host, '최근 글', RIGHT)];
  rows.forEach((post, i) => {
    const top = 48 + 40 * i;
    const base = top + 25;
    parts.push(
      `<line x1="${PAD_X}" y1="${top + 0.5}" x2="${RIGHT}" y2="${top + 0.5}" stroke="${t.divider}"/>`,
    );
    if (post.category) {
      parts.push(
        `<text x="${PAD_X}" y="${base}" font-size="11" font-weight="600" fill="${t.accent}">${x(truncate(post.category, CAT_W, 11, true))}</text>`,
      );
    }
    parts.push(
      `<text x="${TITLE_X}" y="${base}" font-size="14" fill="${t.title}">${x(truncate(post.title, titleW, 14))}</text>`,
      `<text x="${RIGHT}" y="${base}" font-size="12" fill="${t.muted}" text-anchor="end">${formatDate(post.publishedAt, true)}</text>`,
    );
  });

  return frame(t, H, `${blog.title || blog.host} 최근 글 ${rows.length}개`, parts.join('\n'));
}

export function renderMessage(themeName: ThemeName, host: string, message: string, detail: string): string {
  const t = THEMES[themeName];
  const H = 120;
  const body = `${header(t, host, '티스토리 카드', RIGHT)}
<text x="${PAD_X}" y="70" font-size="15" font-weight="700" fill="${t.title}">${x(truncate(message, RIGHT - PAD_X, 15, true))}</text>
<text x="${PAD_X}" y="94" font-size="12" fill="${t.muted}">${x(truncate(detail, RIGHT - PAD_X, 12))}</text>`;
  return frame(t, H, message, body);
}
