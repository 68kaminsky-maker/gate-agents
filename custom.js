// מסך "שער": כפתור פתיחה ידני לבעל העסק, וקישור אישי עם וואטסאפ לכל סוכן.
// וגם: בכרטיס של כל סוכן יש הודעת וואטסאפ מוכנה עם הקישור והקוד שלו.
(function () {
  const CFG = window.APP_CONFIG || {};
  const PUBLIC_URL = 'https://68kaminsky-maker.github.io/gate-agents/';
  // כשהמערכת נפתחת מהמחשב (לא מהאתר), הקישור לסוכן חייב להצביע על האתר האמיתי, אחרת הוא לא יעבוד בטלפון שלו
  const onThisComputer = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname === '';
  const pageUrl = () => onThisComputer ? PUBLIC_URL + 'open.html' : new URL('open.html', location.href).href.replace(/[#?].*$/, '');
  const digits = s => String(s || '').replace(/\D/g, '');
  const intl = s => { let d = digits(s); if (d.startsWith('972')) return d; if (d.startsWith('0')) d = d.slice(1); return '972' + d; };
  const personalLink = a => pageUrl() + '#c=' + digits(a.code);
  const hoursText = a => (a.from && a.to) ? `${a.from}–${a.to}` : 'ללא הגבלת שעות';

  // ההודעה שהסוכן מקבל: קישור אישי + הקוד. אותה הודעה בלשונית "שער" ובכרטיס הסוכן
  function invite(a) {
    const link = personalLink(a);
    const hours = (a.from && a.to) ? `\nשעות כניסה: בין ${a.from} ל-${a.to}${a.days && a.days !== 'כל הימים' ? ', ' + a.days : ''}.` : '';
    const text = `היי ${a.name}, זה הקישור האישי שלך לפתיחת השער:\n${link}\n\nהקוד האישי שלך: ${digits(a.code)}${hours}\nחשוב: שמור את הקוד, תצטרך אותו בכל כניסה.\nפותחים את הקישור ולוחצים "פתח את השער".`;
    const wa = a.phone ? `https://wa.me/${intl(a.phone)}?text=${encodeURIComponent(text)}` : '';
    return { link, text, wa };
  }

  window.LazyApp.view('gate', (params, h) => {
    const agents = (h.rows.agents || []).filter(a => a.status === 'פעיל');
    const rows = agents.map(a => {
      const { link, wa } = invite(a);
      return `<div class="item" style="flex-wrap:wrap;gap:8px">
        <span class="item__av">${h.icon('users')}</span>
        <span class="item__main"><b>${h.esc(a.name)}</b><small class="ltr">${h.esc(a.code)} · ${h.esc(hoursText(a))}</small></span>
        ${wa ? `<a class="chip-btn" href="${wa}" target="_blank" rel="noopener">שלח בוואטסאפ</a>` : ''}
        <button class="chip-btn" type="button" data-copy="${h.esc(link)}">העתק קישור</button>
      </div>`;
    }).join('');

    return `${h.top('שער', CFG.gateEndpoint ? 'מחובר לשער האמיתי' : 'מצב הדגמה: השער לא מחובר עדיין')}
      <section class="card set">
        <h3>פתיחה ידנית</h3>
        <p>לחיצה אחת פותחת את השער, ורשומה נכנסת ליומן.</p>
        <button class="btn" id="gate-open" type="button" style="min-height:64px;font-size:1.25rem;width:100%">פתח את השער עכשיו</button>
      </section>
      <section class="card set" style="${h.settings.lockdown ? 'border:2px solid var(--c-red)' : ''}">
        <h3>נעילת חירום</h3>
        <p>${h.settings.lockdown ? 'כל הקודים של הסוכנים חסומים עכשיו. רק אתה יכול לפתוח את השער.' : 'לחיצה אחת חוסמת את כל הקודים של הסוכנים, אם קוד דלף או אם משהו נראה חשוד. אתה תמשיך לפתוח.'}</p>
        <button class="btn ${h.settings.lockdown ? 'btn--primary' : 'btn--ghost'}" type="button" data-lockdown="${h.settings.lockdown ? 'off' : 'on'}" style="width:100%">${h.settings.lockdown ? 'שחרר את הנעילה' : 'נעל את כל הקודים עכשיו'}</button>
      </section>
      <section class="card set">
        <h3>קישור אישי לכל סוכן</h3>
        <p>לכל סוכן קישור משלו, עם הקוד שלו בפנים. הוא לוחץ פעם אחת ו"פתח את השער", והטלפון זוכר אותו להבא.</p>
      </section>
      <div class="list">${rows || '<div class="empty">אין סוכנים פעילים. הוסף סוכן בלשונית "סוכנים".</div>'}</div>`;
  });

  // כרטיס הסוכן: שליחת הקישור והקוד בוואטסאפ, בלי לעבור ללשונית אחרת
  window.LazyApp.detailExtra('agents', (a, h, ctx) => {
    const first = String(a.name || '').split(' ')[0];
    if (a.status !== 'פעיל') {
      return `<section class="card set"><h3>שליחת הקוד</h3><p>הקוד של ${h.esc(first)} במצב "${h.esc(a.status)}", ולכן הוא לא יכול לפתוח את השער. כשתחזיר אותו ל"פעיל" אפשר יהיה לשלוח לו את הקישור.</p></section>`;
    }
    const { link, text, wa } = invite(a);
    const head = ctx.isNew ? `${h.esc(first)} נוסף. עכשיו שולחים לו את הקוד` : `שליחת הקוד ל${h.esc(first)}`;
    const body = wa
      ? `<p>ההודעה מוכנה, עם הקישור האישי והקוד. לוחצים, וואטסאפ נפתח, ורק צריך ללחוץ "שלח".</p>
         <a class="btn btn--primary" href="${wa}" target="_blank" rel="noopener" style="width:100%;min-height:60px;font-size:1.15rem;background:#25D366;color:#06210F;box-shadow:none">${h.icon('chat')}שלח ל${h.esc(first)} בוואטסאפ</a>`
      : `<p>אין לסוכן הזה מספר טלפון, ולכן אי אפשר לשלוח לו ישר. <a href="#/t/agents/${h.esc(a.id)}/edit"><b>הוספת טלפון</b></a>, או העתקת ההודעה ושליחה ידנית.</p>`;
    return `<section class="card set" style="${ctx.isNew ? 'border:2px solid #25D366' : ''}">
      <h3>${head}</h3>
      ${body}
      <div class="btn-row" style="margin:10px 0 0;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" type="button" data-copy="${h.esc(text)}" data-toast="ההודעה הועתקה">העתק הודעה</button>
        <button class="btn btn--ghost btn--sm" type="button" data-copy="${h.esc(link)}">העתק קישור</button>
      </div>
    </section>`;
  });

  document.addEventListener('click', async e => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); window.LazyApp.helpers.toast(copy.dataset.toast || 'הקישור הועתק'); }
      catch (err) { window.LazyApp.helpers.toast('לא הצלחתי להעתיק'); }
      return;
    }
    const lock = e.target.closest('[data-lockdown]');
    if (lock) {
      const h = window.LazyApp.helpers;
      const on = lock.dataset.lockdown === 'on';
      try { await h.saveSettings({ lockdown: on }); h.render(); h.toast(on ? 'כל הקודים ננעלו' : 'הנעילה שוחררה'); }
      catch (err) { h.toast('לא הצלחתי לשמור: ' + (err.message || err)); }
      return;
    }
    const btn = e.target.closest('#gate-open');
    if (!btn) return;
    const h = window.LazyApp.helpers;
    btn.disabled = true;
    try {
      if (CFG.gateEndpoint && CFG.supabaseUrl) {
        const jwt = await h.accessToken();
        const res = await fetch(CFG.gateEndpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (jwt || '') }, body: JSON.stringify({ manual: true }) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.det || out.msg || 'השער לא ענה');
        await h.save('log', { agentName: 'ישראל', result: 'נפתח', when: new Date().toISOString(), note: 'פתיחה ידנית' });
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
