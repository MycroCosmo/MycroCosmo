/**
 * GitHub README의 <img>로 불러온 SVG는 외부 이미지를 읽지 못한다.
 * 그래서 썸네일을 서버에서 받아 base64 data URI로 SVG 안에 넣는다.
 */

// 임의 URL을 대신 요청하지 않도록(SSRF 방지) 티스토리·카카오 이미지 서버만 허용
const ALLOWED_HOST = /(^|\.)(daumcdn\.net|kakaocdn\.net|tistory\.com)$/i;
const MAX_BYTES = 400 * 1024;

function allowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** 카카오 이미지 서버의 리사이즈 기능으로 240x240 크롭본을 먼저 시도 */
function thumbCandidates(url: string): string[] {
  return [`https://img1.daumcdn.net/thumb/C240x240/?fname=${encodeURIComponent(url)}`, url];
}

async function download(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(type)) return null;
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function toDataUri(url: string | null): Promise<string | null> {
  if (!url || !allowed(url)) return null;
  for (const candidate of thumbCandidates(url)) {
    const data = await download(candidate);
    if (data) return data;
  }
  return null;
}
