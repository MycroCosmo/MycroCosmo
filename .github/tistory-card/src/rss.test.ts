import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFeed } from './rss.js';
import { renderLatest, renderRow } from './card.js';

test('Tistory text entities decode before SVG layout and remain safely escaped', () => {
  const blog = parseFeed(`<rss><channel>
    <title>개발&amp;middot;AI</title>
    <item><title>HTTP&amp;middot;쿠키&amp;middot;JWT</title>
      <link>https://example.tistory.com/1?a=1&amp;b=2</link>
      <category>분류/개발&amp;middot;IT</category>
      <description>&lt;p&gt;본문&amp;middot;요약&lt;/p&gt;</description></item>
    <item><title>A &amp;amp; B &amp;lt;C&amp;gt; &amp;#183; &amp;#xB7;</title></item>
    <item><title>일반 제목 · 그대로</title></item>
  </channel></rss>`, 'example');
  assert.equal(blog.title, '개발·AI');
  const post = blog.posts[0];
  assert.equal(post.title, 'HTTP·쿠키·JWT');
  assert.equal(post.category, '개발·IT');
  assert.equal(post.summary, '본문·요약');
  assert.equal(post.link, 'https://example.tistory.com/1?a=1&b=2');
  assert.equal(blog.posts[1].title, 'A & B <C> · ·');
  assert.equal(blog.posts[2].title, '일반 제목 · 그대로');
  for (const theme of ['light', 'dark'] as const) {
    const latest = renderLatest(blog, post, { theme, thumbnail: null, height: 228 });
    assert.ok(latest.includes('HTTP·쿠키·JWT'));
    assert.ok(latest.includes('개발·IT'));
    assert.ok(!latest.includes('&amp;middot;'));
    assert.ok(renderRow(theme, blog.posts[1]).includes('A &amp; B &lt;C&gt; · ·'));
  }
});
