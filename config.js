// חיבור ל-Supabase.
// כל עוד השדות ריקים, המערכת עובדת ב"מצב הדגמה": הנתונים נשמרים רק בדפדפן הזה.
// אחרי שמריצים את setup.sql בפרויקט Supabase, ממלאים כאן את כתובת הפרויקט ואת המפתח הציבורי (publishable / anon).
// המפתח הציבורי מיועד להיות גלוי. אף פעם לא שמים כאן את המפתח הסודי (service_role / secret).
window.APP_CONFIG = {
  supabaseUrl: 'https://oorrpidiljomwsbtesnu.supabase.co',
  supabaseKey: 'sb_publishable_rC6IeCTpzER32MSNHVnRig_9Kx8rKjj',
  // כתובת שירות פתיחת השער. ריק = מצב הדגמה: השער "נפתח" רק על המסך, ורק היומן מתעדכן.
  // כשמחברים את השער האמיתי, כאן נכנסת הכתובת של השירות (בלי שום מפתח).
  gateEndpoint: 'https://oorrpidiljomwsbtesnu.supabase.co/functions/v1/open-gate'
};
