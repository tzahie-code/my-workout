const set = (n, r) => ({ n, w: '', r });
const sets = (n, count, r) => Array.from({ length: count }, () => set(n, r));
const exercise = (name, muscles, blocks, img) => ({
  name, key: false, machine: '', muscles, img,
  sets: blocks.flatMap(([type, count, reps]) => sets(type, count, reps))
});

export const NOAM_EMAIL = 'noamweisbrun@gmail.com';
// Version 5 uses the correct chest-supported machine row in Routine A.
export const NOAM_PROGRAM_SEED_VERSION = 5;

export const NOAM_PROGRAM = {
  name: 'Heavy + Pump',
  routines: {
    A: { id:'A', label:'Back, Chest & Biceps', locker:'', modes:['heavy','pump'], exercises:[
      exercise('Lat Pulldown', ['lat','upper-back','bicep'], [['כבד',4,'6-8'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif'),
      exercise('Chest Supported Machine Row', ['upper-back','lat','bicep'], [['כבד',4,'8-10'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Row-Machine.gif'),
      exercise('Shrugs', ['upper-back'], [['כבד',3,'10-15'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/10/smith-machine-shrug.gif'),
      exercise('Back Extension', ['lower-back','glute','hamstring'], [['כבד',2,'12-15'],['פאמפ',2,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/hyperextension.gif'),
      exercise('Smith Incline Press', ['chest','shoulder','tricep'], [['כבד',4,'6-8'],['פאמפ',3,'10-12']], 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Smith-Machine-Incline-Bench-Press.gif'),
      exercise('Machine Chest Press', ['chest','shoulder','tricep'], [['כבד',3,'8-10'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Chest-Press-Machine.gif'),
      exercise('Cable Fly', ['chest'], [['כבד',3,'12-15'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Crossover.gif'),
      exercise('Bayesian Cable Curl', ['bicep'], [['כבד',3,'8-10'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/One-Arm-Cable-Curl.gif'),
      exercise('Cable Rope Hammer Curl', ['bicep','forearm'], [['כבד',3,'10-12'],['פאמפ',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/06/rope-bicep-curls.gif'),
      exercise('Cable Bar Curl', ['bicep'], [['כבד',3,'10-12'],['פאמפ',2,'15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-curl.gif')
    ]},
    B: { id:'B', label:'Legs, Glutes, Shoulders & Triceps', locker:'', modes:['heavy','pump'], exercises:[
      exercise('Leg Extension', ['quad'], [['פאמפ',3,'15-20'],['כבד',4,'8-10']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/LEG-EXTENSION.gif'),
      exercise('Leg Press', ['quad','glute','hamstring'], [['פאמפ',3,'12-15'],['כבד',4,'8-10']], 'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif'),
      exercise('Seated Leg Curl', ['hamstring'], [['פאמפ - קליל',3,'12-15'],['כבד',4,'8-10']], 'https://fitnessprogramer.com/wp-content/uploads/2021/08/Seated-Leg-Curl.gif'),
      exercise('Leg Press Calf Raise', ['calf'], [['פאמפ',3,'15-20'],['כבד',4,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Leg-Press-Calf-Raise.gif'),
      exercise('Hip Thrust', ['glute','hamstring'], [['פאמפ',3,'12-15'],['כבד',3,'8-10']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Hip-Thrust.gif'),
      exercise('Multi Hip - Abduction + Adduction', ['glute'], [['פאמפ - חוץ + פנים, כל צד',3,'12-15'],['כבד - חוץ + פנים, כל צד',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Hip-Abduction.gif'),
      exercise('Cable Lateral Raise', ['shoulder'], [['פאמפ',4,'15-20'],['כבד',4,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/09/Leaning-Cable-Lateral-Raise.gif'),
      exercise('Rear Delt Cable', ['shoulder','upper-back'], [['פאמפ',3,'12-15'],['כבד',3,'12-15']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-rear-delt-fly.gif'),
      exercise('Triceps Pushdown', ['tricep'], [['פאמפ',3,'12-15'],['כבד',3,'8-10']], 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pushdown.gif'),
      exercise('Overhead Rope Extension', ['tricep'], [['פאמפ',3,'10-12'],['כבד',3,'10-12']], 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Cable-Rope-Overhead-Triceps-Extension.gif')
    ]}
  }
};

export const NOAM_COMMENTS = {
  'Lat Pulldown':'אחיזה ניטרלית ברוחב כתפיים. משוך לחזה העליון תוך הובלה במרפקים מטה-אחורה, סחוט שכמות וחזור בשליטה למתיחה מלאה. בלי תנופה.',
  'Chest Supported Machine Row':'החזה נשען על הכרית לכל אורך התרגיל. משוך את הידיות תוך קירוב שכמות, עצור בכיווץ וחזור לאט למתיחה. אל תרים את החזה מהתמיכה.',
  'Shrugs':'זרועות ישרות. הרם כתפיים ישר לכיוון האוזניים, סחוט שנייה ורד לאט. בלי לגלגל כתפיים.',
  'Back Extension':'גב ניטרלי. רד מהמותניים בשליטה עד מתיחה ועלה עד קו ישר בלבד. כווץ ישבן בקצה ואל תתקמר מעבר.',
  'Smith Incline Press':'ספסל 30°. אחיזה מעט רחבה מהכתפיים. הורד לחזה העליון עם מרפקים כ-45° ודחוף בלי נעילה חזקה.',
  'Machine Chest Press':'ידיות בקו אמצע החזה ושכמות מכונסות. דחוף עד כמעט יישור, סחוט וחזור לאט למתיחה נעימה.',
  'Cable Fly':'כיפוף קל וקבוע במרפק. פתח בקשת עד מתיחה וקרב ידיים בתנועת חיבוק. התנועה מהכתף.',
  'Bayesian Cable Curl':'עמוד עם הגב לפולי והזרוע מאחורי קו הגוף. כופף כשהזרוע העליונה קבועה, סחוט וירד לאט למתיחה מלאה.',
  'Cable Rope Hammer Curl':'חבל בפולי תחתון ואחיזה ניטרלית. מרפקים צמודים, כופף בלי לפתוח את החבל וירד בשליטה.',
  'Cable Bar Curl':'מוט ישר או EZ בפולי תחתון. אחיזה תחתית ברוחב כתפיים, מרפקים קבועים ובלי תנופה מהגב.',
  'Leg Extension':'גב צמוד למשענת. יישר ברכיים במלואן, סחוט את הארבע ראשי שנייה וחזור לאט.',
  'Leg Press':'רגליים ברוחב כתפיים. רד בשליטה עד כ-90° בלי לגלגל גב תחתון. דחוף דרך העקבים בלי לנעול ברכיים.',
  'Seated Leg Curl':'כרית על הירכיים וגב נשען. משוך עקבים אחורה-מטה לכיווץ מלא וחזור לאט. ביום שלישי לפני שפאגט: קליל בלבד, בלי להתקרב לכשל.',
  'Leg Press Calf Raise':'כפות הרגליים בתחתית הפלטה והעקבים חופשיים. עלה לטווח מלא, סחוט ורד לאט למתיחה מלאה.',
  'Hip Thrust':'דחוף דרך העקבים עד קו ישר ברכיים-אגן-כתפיים. סחוט ישבן, סנטר מכונס ובלי לקמר גב.',
  'Multi Hip - Abduction + Adduction':'חוץ: דחוף את הרגל החוצה. פנים: משוך פנימה. בצע כל צד וכל כיוון בנפרד, בשליטה ועם כיווץ בקצה.',
  'Cable Lateral Raise':'פולי תחתון והיד הרחוקה מהפולי. הרם עד גובה כתף בהובלת המרפק, עצור קצר ורד לאט. בלי תנופה.',
  'Rear Delt Cable':'פולי גבוה וכבלים מוצלבים. משוך החוצה-אחורה בקשת בהובלת המרפקים, סחוט וחזור לאט.',
  'Triceps Pushdown':'מרפקים צמודים וקבועים. דחוף מטה ליישור מלא, סחוט וחזור לאט בלי להזיז מרפקים.',
  'Overhead Rope Extension':'פנים מנוגדות לפולי, חבל מעל ומאחורי הראש ומרפקים גבוהים. יישר קדימה-למעלה ופתח את החבל בקצה.'
};

export function seedNoamProgram(data, email) {
  const current = data && typeof data === 'object' ? data : {};
  const versions = current.seedVersions || {};
  if (String(email || '').toLowerCase() !== NOAM_EMAIL || versions.noamProgram >= NOAM_PROGRAM_SEED_VERSION) {
    return { data: current, changed: false };
  }
  return {
    changed: true,
    data: {
      ...current,
      program: NOAM_PROGRAM,
      currentSession: null,
      prefs: {
        ...(current.prefs || {}),
        comments: { ...(current.prefs?.comments || {}), ...NOAM_COMMENTS }
      },
      seedVersions: { ...versions, noamProgram: NOAM_PROGRAM_SEED_VERSION }
    }
  };
}
