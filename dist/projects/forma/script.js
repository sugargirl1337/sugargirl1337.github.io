/* FORMA landing: menu with photo preview, live schedule and booking form. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TZ = 'Europe/Moscow';
  const NBSP = ' ';
  const money = n => n.toLocaleString('ru-RU') + NBSP + '₽';
  const minutes = n => [Math.floor(n / 60) ? Math.floor(n / 60) + NBSP + 'ч' : '', n % 60 ? n % 60 + NBSP + 'мин' : ''].filter(Boolean).join(' ');
  const dayTime = day => Date.parse(day + 'T12:00:00+03:00') / 1000;
  const isoDay = seconds => new Date(seconds * 1000 + 10800000).toISOString().slice(0, 10);
  const dateText = (seconds, options) => new Date(seconds * 1000).toLocaleDateString('ru-RU', { timeZone: TZ, ...options });
  const clock = seconds => new Date(seconds * 1000).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const sunday = day => new Date(day + 'T12:00:00+03:00').getUTCDay() === 0;
  const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
  const scrollTo = target => target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  const state = { catalog: null, today: '', selected: [], day: '', slot: null, slots: [], requestKey: '', busy: false, controller: null };

  /* Entrance ladder once fonts are ready; a timeout guards against a stalled font request.
     No requestAnimationFrame here: it never fires in a background tab, which would leave the page invisible. */
  const enter = () => { void document.body.offsetWidth; document.body.classList.add('is-in'); };
  Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]).then(enter);
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); reveal.unobserve(entry.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal]').forEach(section => reveal.observe(section));

  /* Header turns solid once the hero has scrolled away; the dock steps aside while the booking section is on screen. */
  const top = $('.top');
  new IntersectionObserver(([entry]) => top.classList.toggle('is-scrolled', !entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' }).observe($('.hero'));
  new IntersectionObserver(([entry]) => $('#dock').classList.toggle('is-away', entry.isIntersecting), { threshold: 0.05 }).observe($('#booking'));

  /* Menu: hovering, touching or focusing a row shows that service's photo in the sticky panel. */
  const rows = $$('.menu__row');
  const visuals = $$('.menu__visual img');
  const current = $('#menu-current');
  const titleOf = row => $('.menu__title', row).firstChild.textContent;
  let previewed = 'hair';
  function preview(row) {
    const id = row.dataset.id;
    if (id === previewed) return;
    previewed = id;
    visuals.forEach(img => img.classList.toggle('is-active', img.dataset.id === id));
    current.textContent = titleOf(row);
  }
  rows.forEach(row => {
    row.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') preview(row); });
    row.addEventListener('pointerdown', () => preview(row));
    $('input', row).addEventListener('focus', () => preview(row));
  });

  /* Selection drives the dock, the chips and the visit summary. */
  const dock = $('#dock');
  const dockText = $('#dock-text');
  const chips = $('#chips');
  const panelRows = $('#panel-rows');
  const service = id => state.catalog?.services.find(s => s.id === id) || { id, title: titleOf($('.menu__row[data-id="' + id + '"]')), price: 0, duration: 0 };
  function toggle(id, on) {
    state.selected = on ? [...new Set([...state.selected, id])] : state.selected.filter(x => x !== id);
    state.slot = null; state.requestKey = '';
    sync();
  }
  rows.forEach(row => { const box = $('input', row); box.addEventListener('change', () => toggle(row.dataset.id, box.checked)); });
  function sync() {
    const chosen = state.selected.map(service);
    const duration = chosen.reduce((n, s) => n + s.duration, 0);
    const price = chosen.reduce((n, s) => n + s.price, 0);
    rows.forEach(row => { const on = state.selected.includes(row.dataset.id); row.classList.toggle('is-selected', on); $('input', row).checked = on; });
    dock.classList.toggle('is-visible', chosen.length > 0 && $('#done').hidden);
    dockText.textContent = chosen.length ? `${chosen.length} ${plural(chosen.length, 'услуга', 'услуги', 'услуг')} / ${minutes(duration)} / от ${money(price)}` : '';
    chips.replaceChildren();
    if (!chosen.length) chips.innerHTML = '<p class="hint">Пока ничего не выбрано — <a href="#services">отметьте услуги в меню</a>.</p>';
    chosen.forEach(s => {
      const chip = document.createElement('span'); chip.className = 'chip';
      const label = document.createElement('span'); label.textContent = s.title;
      const remove = document.createElement('button'); remove.type = 'button'; remove.setAttribute('aria-label', `Убрать: ${s.title}`);
      remove.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      remove.addEventListener('click', () => toggle(s.id, false));
      chip.append(label, remove); chips.append(chip);
    });
    panelRows.replaceChildren();
    if (!chosen.length) panelRows.innerHTML = '<div><dt>Услуги</dt><dd>не выбраны</dd></div>';
    chosen.forEach(s => { const row = document.createElement('div'); row.innerHTML = `<dt></dt><dd></dd>`; $('dt', row).textContent = s.title; $('dd', row).textContent = 'от ' + money(s.price); panelRows.append(row); });
    $('#panel-duration').textContent = duration ? minutes(duration) : '—';
    $('#panel-total').textContent = price ? 'от ' + money(price) : '—';
    $('#panel-when').textContent = state.slot ? `${dateText(state.slot, { day: 'numeric', month: 'long' })}, ${clock(state.slot)}` : state.day ? dateText(dayTime(state.day), { day: 'numeric', month: 'long' }) : '—';
    renderDays();
    loadSlots();
  }

  /* Schedule: 30 days from the salon's today, then free slots for the chosen services. */
  const days = $('#days');
  const slots = $('#slots');
  function renderDays() {
    if (!state.today) return;
    days.replaceChildren();
    for (let i = 0; i < 30; i++) {
      const day = isoDay(dayTime(state.today) + i * 86400);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'day';
      button.disabled = sunday(day);
      button.setAttribute('aria-pressed', String(day === state.day));
      button.setAttribute('aria-label', dateText(dayTime(day), { weekday: 'long', day: 'numeric', month: 'long' }) + (button.disabled ? ', выходной' : ''));
      button.innerHTML = '<span></span><strong></strong>';
      $('span', button).textContent = dateText(dayTime(day), { weekday: 'short' }).replace('.', '');
      $('strong', button).textContent = String(Number(day.slice(-2)));
      button.addEventListener('click', () => { state.day = day; state.slot = null; state.requestKey = ''; sync(); });
      days.append(button);
    }
  }
  async function loadSlots() {
    state.controller?.abort();
    slots.replaceChildren();
    if (!state.selected.length) { slots.innerHTML = '<p class="hint">Выберите услуги и день — покажем свободное время.</p>'; return; }
    if (!state.day) { slots.innerHTML = '<p class="hint">Выберите день визита.</p>'; return; }
    const controller = new AbortController(); state.controller = controller;
    slots.innerHTML = '<p class="hint">Проверяем свободное время…</p>';
    try {
      const response = await fetch(`/api/slots?date=${state.day}&services=${encodeURIComponent(state.selected.join(','))}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить расписание.');
      if (controller.signal.aborted) return;
      state.slots = data.slots;
      slots.replaceChildren();
      if (!data.slots.length) { slots.innerHTML = `<p class="hint">${data.closed ? 'В этот день записи нет.' : 'Свободных интервалов не осталось.'} Выберите другой день${data.duration > 240 ? ' или сократите список услуг' : ''}.</p>`; return; }
      data.slots.forEach(s => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'slot'; button.textContent = s.label;
        button.setAttribute('aria-pressed', String(state.slot === s.start));
        button.addEventListener('click', () => { state.slot = s.start; state.requestKey = ''; $$('.slot', slots).forEach(b => b.setAttribute('aria-pressed', String(b === button))); $('#panel-when').textContent = `${dateText(s.start, { day: 'numeric', month: 'long' })}, ${clock(s.start)}`; });
        slots.append(button);
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      slots.innerHTML = '<p class="hint"></p>'; $('.hint', slots).textContent = error.message;
    }
  }

  /* Booking form: server owns price, duration and conflicts; the form only validates shape. */
  const form = $('#form');
  const msg = $('#msg');
  const submit = $('#submit');
  const done = $('#done');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    const name = form.name.value.trim();
    const phone = form.phone.value.replace(/[\s()\-]/g, '');
    msg.textContent = '';
    if (!state.selected.length) { msg.textContent = 'Отметьте хотя бы одну услугу в меню.'; return; }
    if (!state.slot) { msg.textContent = 'Выберите день и время визита.'; return; }
    if (name.length < 2 || name.length > 80) { msg.textContent = 'Укажите имя от 2 до 80 символов.'; form.name.focus(); return; }
    if (!/^\+?[0-9]{10,15}$/.test(phone)) { msg.textContent = 'Проверьте номер телефона: от 10 до 15 цифр.'; form.phone.focus(); return; }
    if (!form.consent.checked) { msg.textContent = 'Подтвердите согласие на использование контактов для записи.'; form.consent.focus(); return; }
    if (!state.requestKey) state.requestKey = crypto.randomUUID();
    state.busy = true; submit.disabled = true; $('.btn__label', submit).textContent = 'Сохраняем…';
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ services: state.selected, start: state.slot, name, phone, consent: true, requestKey: state.requestKey, website: form.website.value }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { state.slot = null; state.requestKey = ''; sync(); }
        throw new Error(data.error || 'Не удалось сохранить запись.');
      }
      finish(data.booking);
    } catch (error) {
      msg.textContent = error.message;
    } finally {
      state.busy = false; submit.disabled = false; $('.btn__label', submit).textContent = 'Подтвердить запись';
    }
  });
  function finish(booking) {
    const chosen = JSON.parse(booking.services);
    $('#done-when').textContent = `${dateText(booking.start_at, { weekday: 'long', day: 'numeric', month: 'long' })} / ${clock(booking.start_at)}–${clock(booking.end_at)}`;
    const list = $('#done-list'); list.replaceChildren();
    chosen.forEach(s => { const item = document.createElement('li'); item.innerHTML = '<span></span><span></span>'; item.children[0].textContent = s.title; item.children[1].textContent = 'от ' + money(s.price); list.append(item); });
    $('#done-total').textContent = `Итого от ${money(booking.price)} / ${minutes(booking.duration)} / № ${booking.id.slice(0, 8).toUpperCase()}`;
    $('#done-note').textContent = `${booking.name}, администратор уже получил детали визита. Изменились планы — предупредите салон заранее, и время освободим.`;
    form.hidden = true; done.hidden = false;
    state.selected = []; state.slot = null; state.day = ''; state.requestKey = '';
    sync();
    dock.classList.remove('is-visible');
    done.focus({ preventScroll: true });
    scrollTo(done);
  }
  const firstOpenDay = today => sunday(today) ? isoDay(dayTime(today) + 86400) : today;
  $('#again').addEventListener('click', () => { done.hidden = true; form.hidden = false; form.reset(); state.day = firstOpenDay(state.today); sync(); scrollTo($('#services')); });

  /* Catalog gives the salon's current date and the authoritative prices. */
  fetch('/api/catalog').then(r => r.json()).then(catalog => {
    state.catalog = catalog; state.today = catalog.today; state.day = firstOpenDay(catalog.today);
    sync();
  }).catch(() => { days.innerHTML = '<p class="hint">Расписание временно недоступно. Обновите страницу чуть позже.</p>'; });
})();
