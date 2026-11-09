/**
 * 티스토리 RSS를 읽어 README용 카드 SVG를 만들고, README의 카드 영역을 갱신한다.
 *
 *   npx tsx generate.ts --name 0and24 --out ../../assets/tistory --readme ../../README.md
 *   (오프라인 테스트) --feed fixtures/sample.xml
 *
 * RSS를 못 읽으면 기존 카드를 그대로 두고 실패로 끝낸다(에러 카드로 덮어쓰지 않음).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { renderLatest } from './src/card.js';
import { toDataUri } from './src/image.js';
import { fetchBlog, formatDate, isValidName, parseFeed, type Blog } from './src/rss.js';
import { escapeXml } from './src/text.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = arg('name') ?? '';
const outDir = arg('out') ?? 'out';
const readmePath = arg('readme');
const feedPath = arg('feed');
/** README에서 쓸 이미지 주소의 앞부분. 없으면 README 기준 상대 경로 */
const baseUrl = arg('base-url')?.replace(/\/+$/, '');
/** 카드 아래 텍스트 목록에 보여줄 이전 글 개수 */
const more = Math.min(10, Math.max(0, Number(arg('more') ?? 4)));

if (!isValidName(name)) {
  console.error(`블로그 아이디가 올바르지 않아요: "${name}"`);
  process.exit(1);
}

let blog: Blog;
try {
  blog = feedPath ? parseFeed(readFileSync(feedPath, 'utf8'), name) : await fetchBlog(name);
} catch (err) {
  console.error('RSS를 읽지 못했어요. 기존 카드를 유지합니다.', err);
  process.exit(1);
}

if (blog.posts.length === 0) {
  console.error('공개된 글이 없어요. 기존 카드를 유지합니다.');
  process.exit(1);
}

const latest = blog.posts[0];
const thumbnail = await toDataUri(latest.imageUrl);
console.log(`최신 글: ${latest.title} (썸네일 ${thumbnail ? '있음' : '없음'})`);

mkdirSync(outDir, { recursive: true });
const files: Record<string, string> = {};
for (const theme of ['light', 'dark'] as const) {
  files[`latest-${theme}.svg`] = renderLatest(blog, latest, { theme, thumbnail });
}
for (const [file, svg] of Object.entries(files)) {
  writeFileSync(join(outDir, file), svg);
}

if (readmePath) {
  const START = '<!-- TISTORY-CARD:START -->';
  const END = '<!-- TISTORY-CARD:END -->';
  const readme = readFileSync(readmePath, 'utf8');
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s < 0 || e < s) {
    console.error(`README에 ${START} / ${END} 표시가 없어 링크는 갱신하지 않았어요.`);
  } else {
    const base = baseUrl ?? relative(dirname(readmePath), outDir).split('\\').join('/');
    // 카드 내용이 바뀌면 주소도 바뀌게 해서 GitHub 이미지 캐시를 바로 갱신
    const src = (file: string) => {
      const v = createHash('sha1').update(files[file]).digest('hex').slice(0, 8);
      return `${base}/${file}?v=${v}`;
    };
    const blogUrl = `https://${blog.host}`;
    const safeUrl = (u: string) => (/^https:\/\/[a-z0-9.-]+\//i.test(u) ? u : blogUrl);
    const picture = (kind: string, alt: string) =>
      `<picture><source media="(prefers-color-scheme: dark)" srcset="${src(`${kind}-dark.svg`)}"><img src="${src(`${kind}-light.svg`)}" alt="${escapeXml(alt)}" width="495"></picture>`;
    // 최신 글은 카드, 이전 글은 GitHub 기본 글씨의 링크 목록(각각 클릭 가능, 높이 절약)
    const rest = blog.posts.slice(1, 1 + more).map(
      (p) =>
        `  <li><a href="${escapeXml(safeUrl(p.link))}">${escapeXml(p.title)}</a> <sub>${formatDate(p.publishedAt, true)}</sub></li>`,
    );
    const block = [
      START,
      `<a href="${escapeXml(safeUrl(latest.link))}">${picture('latest', `최신 글: ${latest.title}`)}</a>`,
      ...(rest.length ? ['', '<ul>', ...rest, '</ul>'] : []),
      END,
    ].join('\n');
    writeFileSync(readmePath, readme.slice(0, s) + block + readme.slice(e + END.length));
  }
}
