const VERB_DATA = {
  'بودن': { en: 'to be', latin: 'budan', forms: {
    present: ['هستم','هستی','هست','هستیم','هستید','هستند'],
    past: ['بودم','بودی','بود','بودیم','بودید','بودند'],
    subjunctive: ['باشم','باشی','باشد','باشیم','باشید','باشند'],
    future: ['خواهم بود','خواهی بود','خواهد بود','خواهیم بود','خواهید بود','خواهند بود']
  }},
  'داشتن': { en: 'to have', latin: 'dâshtan', forms: {
    present: ['دارم','داری','دارد','داریم','دارید','دارند'],
    past: ['داشتم','داشتی','داشت','داشتیم','داشتید','داشتند'],
    subjunctive: ['داشته باشم','داشته باشی','داشته باشد','داشته باشیم','داشته باشید','داشته باشند'],
    future: ['خواهم داشت','خواهی داشت','خواهد داشت','خواهیم داشت','خواهید داشت','خواهند داشت']
  }},
  'رفتن': { en: 'to go', latin: 'raftan', past: 'رفت', present: 'رو', subj: 'برو' },
  'آمدن': { en: 'to come', latin: 'âmadan', past: 'آمد', present: 'آی', subj: 'بیا' },
  'کردن': { en: 'to do / make', latin: 'kardan', past: 'کرد', present: 'کن', subj: 'بکن' },
  'شدن': { en: 'to become', latin: 'shodan', past: 'شد', present: 'شو', subj: 'بشو' },
  'گفتن': { en: 'to say', latin: 'goftan', past: 'گفت', present: 'گو', subj: 'بگو' },
  'دیدن': { en: 'to see', latin: 'didan', past: 'دید', present: 'بین', subj: 'ببین' },
  'دادن': { en: 'to give', latin: 'dâdan', past: 'داد', present: 'ده', subj: 'بده' },
  'گرفتن': { en: 'to take / get', latin: 'gereftan', past: 'گرفت', present: 'گیر', subj: 'بگیر' },
  'خوردن': { en: 'to eat', latin: 'khordan', past: 'خورد', present: 'خور', subj: 'بخور' },
  'نوشیدن': { en: 'to drink', latin: 'nushidan', past: 'نوشید', present: 'نوش', subj: 'بنوش' },
  'خواستن': { en: 'to want', latin: 'khâstan', past: 'خواست', present: 'خواه', subj: 'بخواه' },
  'توانستن': { en: 'to be able to', latin: 'tavânestan', forms: {
    present: ['می‌توانم','می‌توانی','می‌تواند','می‌توانیم','می‌توانید','می‌توانند'],
    past: ['توانستم','توانستی','توانست','توانستیم','توانستید','توانستند'],
    subjunctive: ['بتوانم','بتوانی','بتواند','بتوانیم','بتوانید','بتوانند'],
    future: ['خواهم توانست','خواهی توانست','خواهد توانست','خواهیم توانست','خواهید توانست','خواهند توانست']
  }},
  'دانستن': { en: 'to know', latin: 'dânestan', past: 'دانست', present: 'دان', subj: 'بدان' },
  'فهمیدن': { en: 'to understand', latin: 'fahmidan', past: 'فهمید', present: 'فهم', subj: 'بفهم' },
  'خواندن': { en: 'to read', latin: 'khândan', past: 'خواند', present: 'خوان', subj: 'بخوان' },
  'نوشتن': { en: 'to write', latin: 'neveshtan', past: 'نوشت', present: 'نویس', subj: 'بنویس' },
  'شنیدن': { en: 'to hear', latin: 'shenidan', past: 'شنید', present: 'شنو', subj: 'بشنو' },
  'آوردن': { en: 'to bring', latin: 'âvardan', past: 'آورد', present: 'آور', subj: 'بیاور' },
  'بردن': { en: 'to take / carry', latin: 'bordan', past: 'برد', present: 'بر', subj: 'ببر' },
  'ماندن': { en: 'to stay / remain', latin: 'mândan', past: 'ماند', present: 'مان', subj: 'بمان' },
  'نشستن': { en: 'to sit', latin: 'neshastan', past: 'نشست', present: 'نشین', subj: 'بنشین' },
  'ایستادن': { en: 'to stand', latin: 'istâdan', past: 'ایستاد', present: 'ایست', subj: 'بایست' },
  'خوابیدن': { en: 'to sleep', latin: 'khâbidan', past: 'خوابید', present: 'خواب', subj: 'بخواب' },
  'بیدار شدن': { en: 'to wake up', latin: 'bidâr shodan', prefix: 'بیدار', helper: 'شدن' },
  'پوشیدن': { en: 'to wear', latin: 'pushidan', past: 'پوشید', present: 'پوش', subj: 'بپوش' },
  'شستن': { en: 'to wash', latin: 'shostan', past: 'شست', present: 'شوی', subj: 'بشوی' },
  'فروختن': { en: 'to sell', latin: 'forukhtan', past: 'فروخت', present: 'فروش', subj: 'بفروش' },
  'خریدن': { en: 'to buy', latin: 'kharidan', past: 'خرید', present: 'خر', subj: 'بخر' },
  'ساختن': { en: 'to build / make', latin: 'sâkhtan', past: 'ساخت', present: 'ساز', subj: 'بساز' },
  'گذاشتن': { en: 'to put / leave', latin: 'gozâshtan', past: 'گذاشت', present: 'گذار', subj: 'بگذار' },
  'برداشتن': { en: 'to pick up', latin: 'bardâshtan', past: 'برداشت', present: 'بردار', subj: 'بردار' },
  'رسیدن': { en: 'to arrive / reach', latin: 'residan', past: 'رسید', present: 'رس', subj: 'برس' },
  'فرستادن': { en: 'to send', latin: 'ferestâdan', past: 'فرستاد', present: 'فرست', subj: 'بفرست' },
  'پرسیدن': { en: 'to ask', latin: 'porsidan', past: 'پرسید', present: 'پرس', subj: 'بپرس' },
  'جواب دادن': { en: 'to answer', latin: 'javâb dâdan', prefix: 'جواب', helper: 'دادن' },
  'باز کردن': { en: 'to open', latin: 'bâz kardan', prefix: 'باز', helper: 'کردن' },
  'بستن': { en: 'to close / tie', latin: 'bastan', past: 'بست', present: 'بند', subj: 'ببند' },
  'شروع کردن': { en: 'to start', latin: 'shoru kardan', prefix: 'شروع', helper: 'کردن' },
  'تمام کردن': { en: 'to finish', latin: 'tamâm kardan', prefix: 'تمام', helper: 'کردن' },
  'پیدا کردن': { en: 'to find', latin: 'peydâ kardan', prefix: 'پیدا', helper: 'کردن' },
  'گم کردن': { en: 'to lose', latin: 'gom kardan', prefix: 'گم', helper: 'کردن' },
  'فراموش کردن': { en: 'to forget', latin: 'farâmush kardan', prefix: 'فراموش', helper: 'کردن' },
  'یاد گرفتن': { en: 'to learn', latin: 'yâd gereftan', prefix: 'یاد', helper: 'گرفتن' },
  'یاد دادن': { en: 'to teach', latin: 'yâd dâdan', prefix: 'یاد', helper: 'دادن' },
  'کار کردن': { en: 'to work', latin: 'kâr kardan', prefix: 'کار', helper: 'کردن' },
  'زندگی کردن': { en: 'to live', latin: 'zendegi kardan', prefix: 'زندگی', helper: 'کردن' },
  'صحبت کردن': { en: 'to speak / talk', latin: 'sohbat kardan', prefix: 'صحبت', helper: 'کردن' },
  'فکر کردن': { en: 'to think', latin: 'fekr kardan', prefix: 'فکر', helper: 'کردن' },
  'نگاه کردن': { en: 'to look', latin: 'negâh kardan', prefix: 'نگاه', helper: 'کردن' },
  'گوش دادن': { en: 'to listen', latin: 'gush dâdan', prefix: 'گوش', helper: 'دادن' },
  'بازی کردن': { en: 'to play', latin: 'bâzi kardan', prefix: 'بازی', helper: 'کردن' },
  'کمک کردن': { en: 'to help', latin: 'komak kardan', prefix: 'کمک', helper: 'کردن' },
  'استفاده کردن': { en: 'to use', latin: 'estefâde kardan', prefix: 'استفاده', helper: 'کردن' },
  'انتخاب کردن': { en: 'to choose', latin: 'entekhâb kardan', prefix: 'انتخاب', helper: 'کردن' },
  'قبول کردن': { en: 'to accept', latin: 'ghabul kardan', prefix: 'قبول', helper: 'کردن' },
  'رد کردن': { en: 'to reject / pass', latin: 'rad kardan', prefix: 'رد', helper: 'کردن' },
  'عوض کردن': { en: 'to change', latin: 'avaz kardan', prefix: 'عوض', helper: 'کردن' },
  'تمیز کردن': { en: 'to clean', latin: 'tamiz kardan', prefix: 'تمیز', helper: 'کردن' },
  'درست کردن': { en: 'to make / fix', latin: 'dorost kardan', prefix: 'درست', helper: 'کردن' },
  'آماده کردن': { en: 'to prepare', latin: 'âmâde kardan', prefix: 'آماده', helper: 'کردن' },
  'صبر کردن': { en: 'to wait', latin: 'sabr kardan', prefix: 'صبر', helper: 'کردن' },
  'تلاش کردن': { en: 'to try', latin: 'talâsh kardan', prefix: 'تلاش', helper: 'کردن' },
  'احساس کردن': { en: 'to feel', latin: 'ehsâs kardan', prefix: 'احساس', helper: 'کردن' },
  'تماس گرفتن': { en: 'to call / contact', latin: 'tamâs gereftan', prefix: 'تماس', helper: 'گرفتن' },
  'تصمیم گرفتن': { en: 'to decide', latin: 'tasmim gereftan', prefix: 'تصمیم', helper: 'گرفتن' },
  'عکس گرفتن': { en: 'to take a photo', latin: 'aks gereftan', prefix: 'عکس', helper: 'گرفتن' },
  'دوش گرفتن': { en: 'to take a shower', latin: 'dush gereftan', prefix: 'دوش', helper: 'گرفتن' },
  'اجازه دادن': { en: 'to allow', latin: 'ejâze dâdan', prefix: 'اجازه', helper: 'دادن' },
  'نشان دادن': { en: 'to show', latin: 'neshân dâdan', prefix: 'نشان', helper: 'دادن' },
  'ادامه دادن': { en: 'to continue', latin: 'edâme dâdan', prefix: 'ادامه', helper: 'دادن' },
  'انجام دادن': { en: 'to carry out / do', latin: 'anjâm dâdan', prefix: 'انجام', helper: 'دادن' },
  'راه رفتن': { en: 'to walk', latin: 'râh raftan', prefix: 'راه', helper: 'رفتن' },
  'دویدن': { en: 'to run', latin: 'davidan', past: 'دوید', present: 'دو', subj: 'بدو' },
  'رقصیدن': { en: 'to dance', latin: 'raghsidan', past: 'رقصید', present: 'رقص', subj: 'برقص' },
  'خندیدن': { en: 'to laugh', latin: 'khandidan', past: 'خندید', present: 'خند', subj: 'بخند' },
  'گریه کردن': { en: 'to cry', latin: 'gerye kardan', prefix: 'گریه', helper: 'کردن' },
  'دوست داشتن': { en: 'to like / love', latin: 'dust dâshtan', prefix: 'دوست', helper: 'داشتن' },
  'نیاز داشتن': { en: 'to need', latin: 'niyâz dâshtan', prefix: 'نیاز', helper: 'داشتن' },
  'وجود داشتن': { en: 'to exist', latin: 'vojud dâshtan', prefix: 'وجود', helper: 'داشتن' },
  'رانندگی کردن': { en: 'to drive', latin: 'rânandegi kardan', prefix: 'رانندگی', helper: 'کردن' },
  'سوار شدن': { en: 'to get on / ride', latin: 'savâr shodan', prefix: 'سوار', helper: 'شدن' },
  'پیاده شدن': { en: 'to get off', latin: 'piyâde shodan', prefix: 'پیاده', helper: 'شدن' },
  'برگشتن': { en: 'to return', latin: 'bargashtan', past: 'برگشت', present: 'گرد', subj: 'برگرد' },
  'افتادن': { en: 'to fall', latin: 'oftâdan', past: 'افتاد', present: 'افت', subj: 'بیفت' },
  'کشیدن': { en: 'to pull / draw', latin: 'keshidan', past: 'کشید', present: 'کش', subj: 'بکش' },
  'زدن': { en: 'to hit / play', latin: 'zadan', past: 'زد', present: 'زن', subj: 'بزن' },
  'پختن': { en: 'to cook', latin: 'pokhtan', past: 'پخت', present: 'پز', subj: 'بپز' },
  'مردن': { en: 'to die', latin: 'mordan', past: 'مرد', present: 'میر', subj: 'بمیر' },
  'کشتن': { en: 'to kill', latin: 'koshtan', past: 'کشت', present: 'کش', subj: 'بکش' },
  'شنا کردن': { en: 'to swim', latin: 'shenâ kardan', prefix: 'شنا', helper: 'کردن' }
};

const VERB_PRONOUNS = ['من', 'تو', 'او', 'ما', 'شما', 'آنها'];
const VERB_ENDINGS = ['م', 'ی', 'د', 'یم', 'ید', 'ند'];
const FUTURE_AUX = ['خواهم', 'خواهی', 'خواهد', 'خواهیم', 'خواهید', 'خواهند'];

function conjugateSimpleVerb(infinitive, data) {
  if (data.forms) return data.forms;
  const present = VERB_ENDINGS.map((ending) => `می‌${data.present}${ending}`);
  const past = VERB_ENDINGS.map((ending, index) => `${data.past}${index === 2 ? '' : ending}`);
  const subjunctive = VERB_ENDINGS.map((ending) => `${data.subj || `ب${data.present}`}${ending}`);
  const future = FUTURE_AUX.map((aux) => `${aux} ${infinitive}`);
  return { present, past, subjunctive, future };
}

function prefixForms(prefix, forms) {
  return Object.fromEntries(Object.entries(forms).map(([tense, values]) => [
    tense,
    values.map((value) => `${prefix} ${value}`)
  ]));
}

function getVerbConjugations(infinitive) {
  const data = VERB_DATA[infinitive];
  if (!data) return null;
  if (data.prefix && data.helper) {
    const helper = VERB_DATA[data.helper];
    if (!helper) return null;
    return {
      infinitive,
      en: data.en,
      latin: data.latin,
      pronouns: VERB_PRONOUNS,
      ...prefixForms(data.prefix, conjugateSimpleVerb(data.helper, helper))
    };
  }
  return {
    infinitive,
    en: data.en,
    latin: data.latin,
    pronouns: VERB_PRONOUNS,
    ...conjugateSimpleVerb(infinitive, data)
  };
}
