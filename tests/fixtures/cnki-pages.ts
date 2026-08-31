export const CNKI_RESULTS_HTML = `
  <!doctype html>
  <html>
    <head></head>
    <body>
      <table class="result-table-list">
        <tbody>
          <tr data-key="cnki-neurips">
            <td class="seq">1</td>
            <td class="name">
              <a class="fz14" href="/kcms2/article/abstract?id=neurips">
                Attention Is All You Need
              </a>
            </td>
            <td class="author">A Vaswani; N Shazeer; N Parmar</td>
            <td class="source">
              <a>Advances in Neural Information Processing Systems</a>
            </td>
            <td class="date">2017-12-01</td>
            <td class="data">会议</td>
          </tr>
          <tr data-key="cnki-journal">
            <td class="seq">2</td>
            <td class="name">
              <a class="fz14" href="/kcms2/article/abstract?id=journal">
                面向大模型的知识组织方法研究
              </a>
            </td>
            <td class="author">张三; 李四</td>
            <td class="source"><a>情报科学</a></td>
            <td class="date">2025-06-15</td>
            <td class="data">期刊</td>
          </tr>
          <tr data-key="cnki-truncated">
            <td class="seq">3</td>
            <td class="name">
              <a class="fz14" href="/kcms2/article/abstract?id=truncated">
                A Truncated Conference Paper
              </a>
            </td>
            <td class="author">A Author</td>
            <td class="source">…International Conference on Examples</td>
            <td class="date">2024</td>
            <td class="data">会议</td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
`;

export const CNKI_DETAIL_HTML = `
  <!doctype html>
  <html>
    <head>
      <meta name="citation_title" content="Attention Is All You Need">
      <meta name="citation_author" content="Ashish Vaswani">
      <meta name="citation_author" content="Noam Shazeer">
      <meta
        name="citation_conference_title"
        content="Advances in Neural Information Processing Systems"
      >
      <meta name="citation_publication_date" content="2017/12/01">
      <meta name="citation_public_url" content="https://kns.cnki.net/kcms2/article/abstract?id=neurips">
    </head>
    <body>
      <div class="wx-tit">
        <h1>Attention Is All You Need</h1>
        <div class="author">Ashish Vaswani; Noam Shazeer</div>
      </div>
    </body>
  </html>
`;
