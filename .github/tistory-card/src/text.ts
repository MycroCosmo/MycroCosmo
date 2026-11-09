/**
 * SVG는 자동 줄바꿈이 없어서, 글자 폭을 어림해 직접 줄을 나눈다.
 * 실제 폰트는 보는 사람 환경에 따라 다르므로 넉넉하게(살짝 넓게) 잡는다.
 */

/** 글자 하나의 폭을 em 단위로 어림 */
function charEm(ch: string, bold: boolean): number {
  const code = ch.codePointAt(0) ?? 0;
  let w: number;
  if (
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
    (code >= 0x1100 && code <= 0x11ff) || // 한글 자모
    (code >= 0x3130 && code <= 0x318f) || // 호환 자모
    (code >= 0x4e00 && code <= 0x9fff) || // 한자
    (code >= 0x3040 && code <= 0x30ff) || // 가나
    (code >= 0xff00 && code <= 0xffef) // 전각
  ) {
    w = 0.95;
  } else if (ch === ' ') {
    w = 0.3;
  } else if (/[A-Z]/.test(ch)) {
    w = 0.62;
  } else if (/[mwMW@%]/.test(ch)) {
    w = 0.85;
  } else if (/[a-z0-9]/.test(ch)) {
    w = 0.52;
  } else if (/[.,:;'"!|ilj]/.test(ch)) {
    w = 0.3;
  } else if (code > 0x2000) {
    w = 1.0; // 이모지·기호 등
  } else {
    w = 0.5;
  }
  return bold ? w * 1.05 : w;
}

export function measure(text: string, fontSize: number, bold = false): number {
  let total = 0;
  for (const ch of text) total += charEm(ch, bold);
  return total * fontSize;
}

const ELLIPSIS = '…';

/** 한 줄에 맞게 자르고 넘치면 말줄임표 */
export function truncate(text: string, maxWidth: number, fontSize: number, bold = false): string {
  if (measure(text, fontSize, bold) <= maxWidth) return text;
  const limit = maxWidth - measure(ELLIPSIS, fontSize, bold);
  let out = '';
  let w = 0;
  for (const ch of text) {
    const cw = charEm(ch, bold) * fontSize;
    if (w + cw > limit) break;
    out += ch;
    w += cw;
  }
  return out.trimEnd() + ELLIPSIS;
}

/**
 * 최대 maxLines 줄로 나눈다. 띄어쓰기 단위로 끊고,
 * 한 단어가 한 줄보다 길면 글자 단위로 끊는다. 마지막 줄이 넘치면 말줄임표.
 */
export function wrap(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  bold = false,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const fits = (s: string) => measure(s, fontSize, bold) <= maxWidth;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
      if (lines.length === maxLines) {
        // 남은 텍스트를 마지막 줄에 붙여 말줄임 처리
        const rest = words.slice(i).join(' ');
        lines[maxLines - 1] = truncate(`${lines[maxLines - 1]} ${rest}`, maxWidth, fontSize, bold);
        return lines;
      }
    }
    // 단어 자체가 한 줄보다 긴 경우: 글자 단위로 쪼갬
    let piece = '';
    for (const ch of word) {
      if (fits(piece + ch)) {
        piece += ch;
      } else {
        lines.push(piece);
        piece = ch;
        if (lines.length === maxLines) {
          const rest = [piece, ...words.slice(i + 1)].join(' ');
          lines[maxLines - 1] = truncate(`${lines[maxLines - 1]}${rest}`, maxWidth, fontSize, bold);
          return lines;
        }
      }
    }
    current = piece;
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const n = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

/** HTML 본문에서 텍스트만 뽑아 공백 정리 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|h\d|li|blockquote)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}
