/**
 * 티스토리 RSS를 읽어 README용 카드 SVG를 만들고, README의 카드 영역을 갱신한다.
 *
 *   npx tsx generate.ts --name 0and24 --out ../../assets/tistory --readme ../../README.md \
 *     --base-url https://raw.githubusercontent.com/<owner>/<repo>/<branch>/assets/tistory
 *   (오프라인 테스트) --feed fixtures/sample.xml [--thumb-file thumb.jpg]
 *
 * 레이아웃: 왼쪽에 최신 글 카드(align=left로 띄움), 오른쪽에 이전 글을 한 줄씩 이미지로 쌓는다.
 * 한 줄이 이미지 한 장이라 줄마다 해당 글 링크를 걸 수 있다.
 * 화면이 좁으면 오른쪽 줄들이 카드 아래로 자연스럽게 내려간다.
 *
 * RSS를 못 읽으면 기존 카드를 그대로 두고 실패로 끝낸다(에러 카드로 덮어쓰지 않음).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { renderLatest, renderListHeader, renderRow, setCardWidth } from './src/card.js';
import { toDataUri } from './src/image.js';
import { fetchBlog, isValidName, parseFeed, type Blog } from './src/rss.js';
import { escapeXml } from './src/text.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const name = arg('name') ?? '';
const outDir = arg('out') ?? 'out';
const readmePath = arg('readme');
const feedPath = arg('feed');
const thumbFile = arg('thumb-file');
/** README에서 쓸 이미지 주소의 앞부분. 없으면 README 기준 상대 경로 */
const baseUrl = arg('base-url')?.replace(/\/+$/, '');
/**
 * 카드 너비. 프로필 README 본문 폭이 약 830px라
 * 최신 글 카드(400 + 여백 20) + 목록(400) = 820px가 되도록 기본 400
 */
const cardWidth = Math.min(495, Math.max(360, Number(arg('width')) || 400));
setCardWidth(cardWidth);
/** 오른쪽에 보여줄 이전 글 개수 */
const more = Math.min(5, Math.max(1, Number(arg('more')) || 4));

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
const older = blog.posts.slice(1, 1 + more);
const thumbnail = thumbFile
  ? `data:image/${extname(thumbFile).slice(1).replace('jpg', 'jpeg')};base64,${readFileSync(thumbFile).toString('base64')}`
  : await toDataUri(latest.imageUrl);
console.log(`최신 글: ${latest.title} (썸네일 ${thumbnail ? '있음' : '없음'}), 이전 글 ${older.length}개`);

// 오른쪽 목록(헤더 36 + 줄당 44 + 이미지 사이 틈)과 왼쪽 카드 높이를 비슷하게 맞춘다
const latestHeight = older.length ? 36 + 44 * older.length + 4 * older.length : 195;

const files: Record<string, string> = {};
for (const theme of ['light', 'dark'] as const) {
  files[`latest-${theme}.svg`] = renderLatest(blog, latest, { theme, thumbnail, height: latestHeight });
  if (older.length) files[`older-header-${theme}.svg`] = renderListHeader(theme, blog.host, '이전 글');
  older.forEach((post, i) => {
    files[`older-${i + 1}-${theme}.svg`] = renderRow(theme, post);
  });
}

mkdirSync(outDir, { recursive: true });
// 이전 버전에서 쓰던 파일이나 줄어든 목록의 남는 파일 정리
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.svg') && !(file in files)) unlinkSync(join(outDir, file));
}
for (const [file, svg] of Object.entries(files)) {
  writeFileSync(join(outDir, file), svg);
}

if (readmePath && existsSync(readmePath)) {
  const START = '<!-- TISTORY-CARD:START -->';
  const END = '<!-- TISTORY-CARD:END -->';
  const readme = readFileSync(readmePath, 'utf8');
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s < 0 || e < s) {
    console.error(`README에 ${START} / ${END} 표시가 없어 링크는 갱신하지 않았어요.`);
  } else {
    const base = baseUrl ?? relative(dirname(readmePath), outDir).split('\\').join('/');
    // 이미지 내용이 바뀌면 주소도 바뀌게 해서 GitHub 이미지 캐시를 바로 갱신
    const src = (file: string) => {
      const v = createHash('sha1').update(files[file]).digest('hex').slice(0, 8);
      return `${base}/${file}?v=${v}`;
    };
    const blogUrl = `https://${blog.host}`;
    const safeUrl = (u: string) => (/^https:\/\/[a-z0-9.-]+\//i.test(u) ? u : blogUrl);
    const picture = (stem: string, alt: string, attrs = '') =>
      `<picture><source media="(prefers-color-scheme: dark)" srcset="${src(`${stem}-dark.svg`)}"><img src="${src(`${stem}-light.svg`)}" alt="${escapeXml(alt)}"${attrs}></picture>`;

    const lines = [
      START,
      `<a href="${escapeXml(safeUrl(latest.link))}">${picture('latest', `최신 글: ${latest.title}`, ` width="${cardWidth}" align="left"`)}</a>`,
    ];
    if (older.length) {
      lines.push(`<a href="${blogUrl}">${picture('older-header', '이전 글', ` width="${cardWidth}"`)}</a><br>`);
      older.forEach((post, i) => {
        lines.push(
          `<a href="${escapeXml(safeUrl(post.link))}">${picture(`older-${i + 1}`, post.title, ` width="${cardWidth}"`)}</a><br>`,
        );
      });
    }
    lines.push('<br clear="left">', END);
    writeFileSync(readmePath, readme.slice(0, s) + lines.join('\n') + readme.slice(e + END.length));
  }
}
