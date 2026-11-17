// מסך "שער": כפתור פתיחה ידני לבעל העסק, וקישור אישי עם וואטסאפ לכל נהג.
// וגם: בכרטיס של כל נהג יש הודעת וואטסאפ מוכנה עם הקישור והקוד שלו.
(function () {
  const CFG = window.APP_CONFIG || {};
  const PUBLIC_URL = 'https://68kaminsky-maker.github.io/gate-agents/';
  // כשהמערכת נפתחת מהמחשב (לא מהאתר), הקישור לנהג חייב להצביע על האתר האמיתי, אחרת הוא לא יעבוד בטלפון שלו
  const onThisComputer = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname === '';
  const pageUrl = () => onThisComputer ? PUBLIC_URL + 'open.html' : new URL('open.html', location.href).href.replace(/[#?].*$/, '');
  const digits = s => String(s || '').replace(/\D/g, '');
  const intl = s => { let d = digits(s); if (d.startsWith('972')) return d; if (d.startsWith('0')) d = d.slice(1); return '972' + d; };
  const personalLink = a => pageUrl() + '#c=' + digits(a.code);
  const hoursText = a => (a.from && a.to) ? `${a.from}–${a.to}` : 'ללא הגבלת שעות';

  // ההודעה שהנהג מקבל: קישור אישי + הקוד. אותה הודעה בלשונית "שער" ובכרטיס הנהג.
  // replaced = הקוד הוחלף, ההודעה אומרת לו שהקוד הישן כבר לא עובד
  function invite(a, replaced) {
    const link = personalLink(a);
    const hours = (a.from && a.to) ? `\nשעות כניסה: בין ${a.from} ל-${a.to}${a.days && a.days !== 'כל הימים' ? ', ' + a.days : ''}.` : '';
    const text = replaced
      ? `היי ${a.name}, הקוד שלך לפתיחת השער הוחלף.\nהקוד החדש שלך: ${digits(a.code)}\nהקישור האישי החדש:\n${link}${hours}\nהקוד הקודם כבר לא עובד. שמור את הקוד החדש, תצטרך אותו בכל כניסה.\nפותחים את הקישור ולוחצים "פתח את השער".`
      : `היי ${a.name}, זה הקישור האישי שלך לפתיחת השער:\n${link}\n\nהקוד האישי שלך: ${digits(a.code)}${hours}\nחשוב: שמור את הקוד, תצטרך אותו בכל כניסה.\nפותחים את הקישור ולוחצים "פתח את השער".`;
    const wa = a.phone ? `https://wa.me/${intl(a.phone)}?text=${encodeURIComponent(text)}` : '';
    return { link, text, wa };
  }

  // סימון מי כבר קיבל הודעה (בדפדפן הזה בלבד). המפתח כולל את הקוד, אז אחרי החלפת קוד הנהג חוזר להיות "לא נשלח"
  const SENT_KEY = 'gate-sent';
  const sentKey = a => a.id + '|' + digits(a.code);
  const sentMap = () => { try { return JSON.parse(localStorage.getItem(SENT_KEY)) || {}; } catch (e) { return {}; } };
  const isSent = a => Boolean(sentMap()[sentKey(a)]);
  function markSent(key) { try { const m = sentMap(); m[key] = Date.now(); localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch (e) { /* לא קריטי */ } }
  function resetSent() { try { localStorage.removeItem(SENT_KEY); } catch (e) { /* לא קריטי */ } }

  window.LazyApp.view('gate', (params, h) => {
    const agents = (h.rows.agents || []).filter(a => a.status === 'פעיל');
    const rows = agents.map(a => {
      const { link, wa } = invite(a);
      const sent = isSent(a);
      return `<div class="item" style="flex-wrap:wrap;gap:8px">
        <span class="item__av">${h.icon('users')}</span>
        <span class="item__main"><b>${h.esc(a.name)}${sent ? ' <span style="color:#25D366" title="נשלחה אליו הודעה">✔ נשלח</span>' : ''}</b><small class="ltr">${h.esc(a.code)} · ${h.esc(hoursText(a))}</small></span>
        ${wa ? `<a class="chip-btn" href="${wa}" target="_blank" rel="noopener" data-sent-mark="${h.esc(sentKey(a))}">${sent ? 'שלח שוב' : 'שלח בוואטסאפ'}</a>` : ''}
        <button class="chip-btn" type="button" data-copy="${h.esc(link)}">העתק קישור</button>
      </div>`;
    }).join('');

    // שליחה לכולם: כפתור אחד שמוביל לנהג הבא בתור. כל הודעה אישית (שם, קוד וקישור משלו) ונשלחת בלחיצה שלך, אחת אחת
    const withPhone = agents.filter(a => a.phone);
    const noPhone = agents.length - withPhone.length;
    const queue = withPhone.filter(a => !isSent(a));
    const next = queue[0];
    const bulk = !agents.length ? '' : `<section class="card set">
        <h3>שליחה לכל הנהגים הפעילים</h3>
        ${next
          ? `<p>לוחצים, וואטסאפ נפתח עם ההודעה של <b>${h.esc(next.name)}</b>, שולחים, וחוזרים לכאן. הכפתור עובר לבא בתור. נשארו <b>${queue.length}</b> מתוך ${withPhone.length}.</p>
             <a class="btn btn--primary" href="${invite(next).wa}" target="_blank" rel="noopener" data-sent-mark="${h.esc(sentKey(next))}" style="width:100%;min-height:60px;font-size:1.15rem;background:#25D366;color:#06210F;box-shadow:none">${h.icon('chat')}שלח ל${h.esc(next.name.split(' ')[0])} (הבא בתור)</a>`
          : `<p>${withPhone.length ? 'כל הנהגים הפעילים עם טלפון קיבלו הודעה.' : 'אין נהגים פעילים עם מספר טלפון.'}</p>`}
        ${noPhone ? `<p class="muted">${noPhone} נהגים בלי מספר טלפון, אליהם אפשר לשלוח רק ידנית.</p>` : ''}
        ${withPhone.length > queue.length ? `<button class="btn btn--ghost btn--sm" type="button" data-sent-reset>אפס את הסימונים</button>` : ''}
        <p class="muted">שולחים אחד אחד ובכוונה לא בבת אחת, כדי שוואטסאפ לא יחשוד בהודעות המוניות.</p>
      </section>`;

    return `${h.top('שער', CFG.gateEndpoint ? 'מחובר לשער האמיתי' : 'מצב הדגמה: השער לא מחובר עדיין')}
      <section class="card set">
        <h3>פתיחה ידנית</h3>
        <p>לחיצה אחת פותחת את השער, ורשומה נכנסת ליומן.</p>
        <button class="btn" id="gate-open" type="button" style="min-height:64px;font-size:1.25rem;width:100%">פתח את השער עכשיו</button>
      </section>
      <section class="card set" style="${h.settings.lockdown ? 'border:2px solid var(--c-red)' : ''}">
        <h3>נעילת חירום</h3>
        <p>${h.settings.lockdown ? 'כל הקודים של הנהגים חסומים עכשיו. רק אתה יכול לפתוח את השער.' : 'לחיצה אחת חוסמת את כל הקודים של הנהגים, אם קוד דלף או אם משהו נראה חשוד. אתה תמשיך לפתוח.'}</p>
        <button class="btn ${h.settings.lockdown ? 'btn--primary' : 'btn--ghost'}" type="button" data-lockdown="${h.settings.lockdown ? 'off' : 'on'}" style="width:100%">${h.settings.lockdown ? 'שחרר את הנעילה' : 'נעל את כל הקודים עכשיו'}</button>
      </section>
      ${bulk}
      <section class="card set">
        <h3>קישור אישי לכל נהג</h3>
        <p>לכל נהג קישור משלו, עם הקוד שלו בפנים. הוא לוחץ פעם אחת ו"פתח את השער", והטלפון זוכר אותו להבא.</p>
      </section>
      <div class="list">${rows || '<div class="empty">אין נהגים פעילים. הוסף נהג בלשונית "נהגים".</div>'}</div>`;
  });

  // כרטיס הנהג: שליחת הקישור והקוד בוואטסאפ, בלי לעבור ללשונית אחרת
  window.LazyApp.detailExtra('agents', (a, h, ctx) => {
    const first = String(a.name || '').split(' ')[0];
    if (a.status !== 'פעיל') {
      return `<section class="card set"><h3>שליחת הקוד</h3><p>הקוד של ${h.esc(first)} במצב "${h.esc(a.status)}", ולכן הוא לא יכול לפתוח את השער. כשתחזיר אותו ל"פעיל" אפשר יהיה לשלוח לו את הקישור.</p></section>`;
    }
    const replaced = !ctx.isNew && (ctx.changed || []).includes('code');
    const { link, text, wa } = invite(a, replaced);
    const head = ctx.isNew ? `${h.esc(first)} נוסף. עכשיו שולחים לו את הקוד`
      : replaced ? `הקוד של ${h.esc(first)} הוחלף. שולחים לו את החדש`
      : `שליחת הקוד ל${h.esc(first)}`;
    const body = wa
      ? `<p>${replaced ? 'ההודעה מוכנה: הקוד החדש, הקישור החדש, והסבר שהקוד הקודם כבר לא עובד.' : 'ההודעה מוכנה, עם הקישור האישי והקוד.'} לוחצים, וואטסאפ נפתח, ורק צריך ללחוץ "שלח".${isSent(a) && !replaced ? ' <b style="color:#25D366">✔ כבר נשלחה אליו הודעה.</b>' : ''}</p>
         <a class="btn btn--primary" href="${wa}" target="_blank" rel="noopener" data-sent-mark="${h.esc(sentKey(a))}" style="width:100%;min-height:60px;font-size:1.15rem;background:#25D366;color:#06210F;box-shadow:none">${h.icon('chat')}${replaced ? `שלח ל${h.esc(first)} את הקוד החדש` : `שלח ל${h.esc(first)} בוואטסאפ`}</a>`
      : `<p>אין לנהג הזה מספר טלפון, ולכן אי אפשר לשלוח לו ישר. <a href="#/t/agents/${h.esc(a.id)}/edit"><b>הוספת טלפון</b></a>, או העתקת ההודעה ושליחה ידנית.</p>`;
    return `<section class="card set" style="${ctx.isNew || replaced ? 'border:2px solid #25D366' : ''}">
      <h3>${head}</h3>
      ${body}
      <div class="btn-row" style="margin:10px 0 0;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" type="button" data-copy="${h.esc(text)}" data-toast="ההודעה הועתקה">העתק הודעה</button>
        <button class="btn btn--ghost btn--sm" type="button" data-copy="${h.esc(link)}">העתק קישור</button>
      </div>
    </section>`;
  });

  document.addEventListener('click', async e => {
    const mark = e.target.closest('[data-sent-mark]');
    if (mark) {
      // לא עוצרים את הקישור: וואטסאפ נפתח בטאב חדש, ואנחנו רק מסמנים ומעבירים את הכפתור לבא בתור
      markSent(mark.dataset.sentMark);
      if (location.hash.startsWith('#/x/gate')) setTimeout(() => window.LazyApp.helpers.render(), 400);
      return;
    }
    if (e.target.closest('[data-sent-reset]')) { resetSent(); window.LazyApp.helpers.render(); return; }
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
