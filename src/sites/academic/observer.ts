/** Throttled (not trailing-only) so continuously updating pages cannot starve rendering. */
export function watchAcademicPage(document: Document, render: () => void): () => void {
  const view = document.defaultView!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const observer = new view.MutationObserver(() => {
    if (!stopped && timer === undefined) timer = setTimeout(refresh, 150);
  });
  function refresh(): void {
    timer = undefined;
    if (stopped) return;
    // Do not observe the tags we create ourselves, avoiding redraw loops.
    observer.disconnect();
    try { render(); } finally {
      if (!stopped) observer.observe(document.documentElement, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ['content', 'href', 'class', 'style', 'hidden', 'aria-hidden', 'data-key', 'data-id'],
      });
    }
  }
  refresh();
  return () => {
    stopped = true;
    clearTimeout(timer);
    observer.disconnect();
  };
}
