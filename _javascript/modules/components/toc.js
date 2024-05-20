export function toc(onClick) {
  if (document.querySelector('main h2, main h3')) {
    // see: https://github.com/tscanlin/tocbot#usage
    tocbot.init({
      tocSelector: '#toc',
      contentSelector: '.content',
      ignoreSelector: '[data-toc-skip]',
      headingSelector: 'h2, h3, h4',
      orderedList: false,
      scrollSmooth: false,
      onClick: onClick
    });

    document.getElementById('toc-wrapper').classList.remove('d-none');
  }
}
