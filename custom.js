// מסך "שער": כפתור פתיחה ידני לבעל העסק, וקישור וואטסאפ מוכן לכל סוכן עם הקוד שלו.
(function () {
  const CFG = window.APP_CONFIG || {};
  const pageUrl = () => new URL('open.html', location.href).href.replace(/#.*$/, '');
  const digits = s => String(s || '').replace(/\D/g, '');
  const intl = s => { let d = digits(s); if (d.startsWith('972')) return d; if (d.startsWith('0')) d = d.slice(1); return '972' + d; };

  window.LazyApp.view('gate', (params, h) => {
    const agents = (h.rows.agents || []).filter(a => a.status === 'פעיל');
    const rows = agents.map(a => {
      const text = `היי ${a.name}, הקוד שלך לפתיחת השער: ${a.code}\nמקלידים אותו כאן: ${pageUrl()}`;
      const wa = a.phone ? `https://wa.me/${intl(a.phone)}?text=${encodeURIComponent(text)}` : '';
      return `<div class="item">
        <span class="item__av">${h.icon('users')}</span>
        <span class="item__main"><b>${h.esc(a.name)}</b><small class="ltr">${h.esc(a.code)} · ${h.esc(a.from || '')}–${h.esc(a.to || '')}</small></span>
        ${wa ? `<a class="chip-btn" href="${wa}" target="_blank" rel="noopener">שלח קוד בוואטסאפ</a>` : ''}
      </div>`;
    }).join('');

    return `${h.top('שער', CFG.gateEndpoint ? 'מחובר לשער' : 'מצב הדגמה: השער לא מחובר עדיין')}
      <section class="card set">
        <h3>פתיחה ידנית</h3>
        <p>לחיצה אחת פותחת את השער, ורשומה נכנסת ליומן.</p>
        <button class="btn" id="gate-open" type="button" style="min-height:64px;font-size:1.25rem;width:100%">פתח את השער עכשיו</button>
      </section>
      <section class="card set">
        <h3>הדף של הסוכנים</h3>
        <p>זה הקישור שהסוכנים מקבלים. הם מקלידים בו את הקוד האישי שלהם.</p>
        <p class="ltr" style="word-break:break-all"><b>${h.esc(pageUrl())}</b></p>
        <a class="btn" href="open.html" target="_blank" rel="noopener">פתח את הדף</a>
      </section>
      <section class="card set"><h3>שליחת קודים בוואטסאפ</h3></section>
      <div class="list">${rows || '<div class="empty">אין סוכנים פעילים. הוסף סוכן בלשונית "סוכנים".</div>'}</div>`;
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('#gate-open');
    if (!btn) return;
    const h = window.LazyApp.helpers;
    btn.disabled = true;
    try {
      if (CFG.gateEndpoint && CFG.supabaseUrl) {
        // בענן: השירות עצמו רושם ביומן, ופותח רק לבעל העסק אחרי כניסה
        const jwt = await h.accessToken();
        const res = await fetch(CFG.gateEndpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (jwt || '') }, body: JSON.stringify({ manual: true }) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.det || out.msg || 'השער לא ענה');
        await h.refresh();
        h.toast('השער נפתח');
      } else {
        await h.save('log', { agentName: 'ישראל', result: 'נפתח', when: new Date().toISOString(), note: 'פתיחה ידנית' });
        h.toast('הדגמה: השער נפתח על המסך');
      }
    } catch (err) {
      h.toast('לא הצלחתי לפתוח: ' + err.message);
    }
    btn.disabled = false;
  });
})();
