/**
 * ラインナップページHTMLから商品エントリを抽出する（純粋関数）。
 *
 * 期待するDOM構造（2026-08時点）:
 *   <ul class="lineupList">
 *     <li class="mix ...">
 *       <a href="bx01.html">
 *         <img src="_image/BX01_list.png" alt="BX-01">
 *         <b>BX-01<span>ドランソード3-60F</span></b>
 *         <p class="category"><span>スターター</span></p>
 *       </a>
 *     </li>
 *   ...
 *
 * 構造が変わって1件も抽出できない場合、呼び出し側は「サイト構造変更」として
 * エラー終了する（誤って全件消えたと解釈しない）。
 */
import * as cheerio from 'cheerio';

const CODE_RE = /^(BX|UX|CX)-[0-9]{2,3}$/;

/**
 * @param {string} html
 * @returns {{code: string, name: string, category: string, slug: string}[]}
 */
export function extractLineupEntries(html) {
  const $ = cheerio.load(html);
  const entries = [];

  $('ul.lineupList li').each((_, li) => {
    const $li = $(li);
    const $a = $li.find('a[href]').first();
    const href = ($a.attr('href') ?? '').trim();

    const $b = $li.find('b').first();
    if ($b.length === 0) return;

    // <b>BX-01<span>ドランソード3-60F</span></b>
    const name = $b
      .find('span')
      .first()
      .text()
      .replace(/\s+/g, '');
    const code = $b
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim();

    const category = $li.find('p.category span').first().text().trim();

    if (!CODE_RE.test(code) || !name) return;
    // 外部リンク（購入ページ等）ではなく詳細ページの相対リンクのみ
    const slug = /^[\w.-]+\.html$/.test(href) ? href : null;
    if (!slug) return;

    entries.push({ code, name, category, slug });
  });

  return entries;
}
