/* Demo mode for the portfolio copy of FORMA.
   The real site talks to a Cloudflare Worker (/api/*). Here the same requests
   are answered in the browser with demo data, so the booking flow works
   without a server. Nothing is sent anywhere. */
(() => {
  const services = [
    { id: 'hair', category: 'hair', title: 'Стрижка и укладка', price: 3500, duration: 90 },
    { id: 'color', category: 'hair', title: 'Окрашивание', price: 6500, duration: 180 },
    { id: 'treatment', category: 'hair', title: 'Уход для волос', price: 3200, duration: 75 },
    { id: 'styling', category: 'hair', title: 'Вечерняя укладка', price: 3000, duration: 75 },
    { id: 'nails', category: 'nails', title: 'Маникюр и покрытие', price: 2800, duration: 120 },
    { id: 'pedicure', category: 'nails', title: 'Педикюр и покрытие', price: 3500, duration: 120 },
    { id: 'brows', category: 'brows', title: 'Брови и взгляд', price: 2000, duration: 60 },
    { id: 'lashes', category: 'brows', title: 'Ламинирование ресниц', price: 3000, duration: 75 },
    { id: 'makeup', category: 'makeup', title: 'Макияж', price: 4500, duration: 90 },
  ];
  const salon = { name: 'FORMA', timezone: 'Europe/Moscow', schedule: 'Пн–сб, 10:00–20:00', open: 10, close: 20, daysAhead: 30, leadMinutes: 60, slotMinutes: 15 };
  const MSK = 3 * 3600;
  const now = () => Math.floor(Date.now() / 1000);
  const dayOf = s => new Date((s + MSK) * 1000).toISOString().slice(0, 10);
  const at = (day, h, m) => Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`) / 1000;
  const label = s => new Date(s * 1000).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
  const booked = [];
  // Stable pseudo-random "busy" hours per day so the grid looks like a real schedule.
  const busy = (day, t) => {
    const seed = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const hour = Math.floor(((t + MSK) % 86400) / 3600);
    return ((seed >> (hour % 13)) & 3) === 0 || booked.some(b => t < b.end_at && t + 900 > b.start_at);
  };
  const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

  function slots(day, ids) {
    const chosen = services.filter(s => ids.includes(s.id));
    const duration = chosen.reduce((a, s) => a + s.duration, 0);
    const closed = new Date(`${day}T12:00:00+03:00`).getUTCDay() === 0;
    if (closed || !duration) return { slots: [], closed, duration };
    const out = [];
    for (let t = at(day, salon.open, 0); t + duration * 60 <= at(day, salon.close, 0); t += 900) {
      if (t < now() + salon.leadMinutes * 60) continue;
      let free = true;
      for (let x = t; x < t + duration * 60; x += 900) if (busy(day, x)) { free = false; break; }
      if (free) out.push({ start: t, label: label(t) });
    }
    return { slots: out, closed: false, duration };
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    if (url.pathname === '/api/catalog') return reply({ services, salon, today: dayOf(now()), botUsername: '', connected: false });
    if (url.pathname === '/api/slots') return reply(slots(url.searchParams.get('date') || '', (url.searchParams.get('services') || '').split(',')));
    if (url.pathname === '/api/bookings') {
      const body = JSON.parse(init.body || '{}');
      const chosen = services.filter(s => body.services.includes(s.id));
      const duration = chosen.reduce((a, s) => a + s.duration, 0);
      const booking = {
        id: crypto.randomUUID(), name: body.name, start_at: body.start, end_at: body.start + duration * 60,
        duration, price: chosen.reduce((a, s) => a + s.price, 0),
        services: JSON.stringify(chosen.map(s => ({ title: s.title, price: s.price }))),
      };
      booked.push(booking);
      return reply({ booking });
    }
    return reply({ error: 'Демо-режим: этот запрос недоступен.' }, 404);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '.demo-badge{position:fixed;left:12px;bottom:12px;z-index:50;font:500 12px/1.4 Onest,sans-serif;background:#191919;color:#fff;padding:8px 12px;border-radius:20px;opacity:.85}';
    document.head.append(style);
    const badge = document.createElement('div');
    badge.className = 'demo-badge';
    badge.textContent = 'Демо для портфолио: запись не отправляется';
    document.body.append(badge);
  });
})();
