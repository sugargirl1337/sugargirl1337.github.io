/* КОВЁР landing: entrance ladder and scrolled header. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  /* Entrance ladder once fonts are ready; a timeout guards against a stalled font request. */
  const enter = () => { void document.body.offsetWidth; document.body.classList.add('is-in'); };
  Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]).then(enter);
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-in'); reveal.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach(section => reveal.observe(section));

  /* Header turns ash once the hero has scrolled away. */
  const top = $('.top');
  new IntersectionObserver(([entry]) => top.classList.toggle('is-scrolled', !entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' }).observe($('.hero'));
})();
