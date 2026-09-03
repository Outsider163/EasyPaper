/** Synthetic content with the structure observed on googlescholar.pro search
 * results (2026-09-03). No downloaded page scripts, ads or user search history. */
export const SCHOLAR_PRO_RESULTS_HTML = `<!doctype html>
<html><head></head><body class="search-results-page">
  <h1>学术搜索</h1>
  <div class="search-results">
    <div class="ad-links-container"><a>Nature</a><a>Science</a></div>
    <div class="card" data-test-id="journal"><div class="card-body"><div class="card-main-content">
      <h3 class="card-title"><a href="https://example.test/paper">A Journal Paper</a>
        <button class="translate-btn" data-title="A Journal Paper">翻译</button>
        <div class="translation-result">翻译后的论文题名</div>
      </h3>
      <div class="journal-metrics-container" data-title="A Journal Paper"><span>网站原有 IF 99.9</span></div>
      <div class="card-meta">A Author, B Author&nbsp;- Science, 2015 - science.org</div>
      <div class="card-text">An abstract mentioning Nature and other journals.</div>
      <div class="card-actions"><button>引用</button></div>
    </div><div class="card-side-links"><a href="https://example.test/paper.pdf">PDF</a></div></div></div>
    <div class="card" data-test-id="book"><div class="card-body"><div class="card-main-content">
      <h3 class="card-title"><a href="https://books.google.com/example">A Book</a><button class="translate-btn">翻译</button></h3>
      <div class="journal-metrics-container"></div>
      <div class="card-meta">C Author - 2021 , books.google.com</div>
    </div></div></div>
    <div class="card" data-test-id="truncated"><div class="card-body"><div class="card-main-content">
      <h3 class="card-title"><a href="https://example.test/truncated">A Truncated Paper</a></h3>
      <div class="card-meta">D Author - Nature meth…, 2025 - example.test</div>
    </div></div></div>
    <div class="card" data-test-id="conference"><div class="card-body"><div class="card-main-content">
      <h3 class="card-title">[引用] A Conference Paper<button class="translate-btn">翻译</button><div class="translation-result">另一题名</div></h3>
      <div class="card-meta">E Author - Advances in Neural Information Processing Systems, 2024 - proceedings.neurips.cc</div>
    </div></div></div>
  </div>
</body></html>`;
