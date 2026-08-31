export const GOOGLE_SCHOLAR_RESULTS_HTML = `
  <!doctype html>
  <html>
    <head></head>
    <body>
      <div id="gs_res_ccl_mid">
        <div class="gs_r" data-rp="0" data-cid="conference-result">
          <div class="gs_ri">
            <h3 class="gs_rt">
              <a href="https://example.org/attention">Attention Is All You Need</a>
            </h3>
            <div class="gs_a">
              A Vaswani, N Shazeer, N Parmar - Advances in Neural Information Processing Systems, 2017 - proceedings.neurips.cc
            </div>
          </div>
        </div>

        <div class="gs_r gs_or gs_scl" data-rp="1" data-aid="journal-result">
          <div class="gs_ri">
            <h3 class="gs_rt">
              <span class="gs_ctc">[PDF]&nbsp;</span>
              <a href="https://example.org/journal">A Journal Article</a>
            </h3>
            <div class="gs_a">J Smith, Q Zhang - Journal of Useful Results, 2024 - Elsevier</div>
          </div>
        </div>

        <div class="gs_r gs_or gs_scl" data-rp="2" data-cid="citation-result">
          <div class="gs_ri">
            <h3 class="gs_rt">
              <span class="gs_ctu">[CITATION]</span> A Classic Paper
            </h3>
            <div class="gs_a">A Researcher - 1999 - example.edu</div>
          </div>
        </div>

        <div class="gs_r gs_or gs_scl" data-rp="3">
          <div class="gs_ri">
            <h3 class="gs_rt">
              <a href="https://example.org/spacing">
                A     Title
                With   Irregular Whitespace
              </a>
            </h3>
            <div class="gs_a">
              First Author,&nbsp;&nbsp;Second Author   -   Example Conference, 2022   -   ACM
            </div>
          </div>
        </div>

        <div class="gs_r gs_or gs_scl" data-rp="4">
          <div class="gs_ri">
            <h3 class="gs_rt"><a href="https://example.org/preprint">A Preprint</a></h3>
            <div class="gs_a">A Writer - repository.example.org</div>
          </div>
        </div>

        <div class="gs_r gs_or gs_scl" data-rp="5">
          <div class="gs_ri">
            <h3 class="gs_rt"><a href="https://example.org/truncated">A Truncated Source</a></h3>
            <div class="gs_a">A Writer - …International Conference on Examples, 2021 - ACM</div>
          </div>
        </div>
      </div>
    </body>
  </html>
`;
