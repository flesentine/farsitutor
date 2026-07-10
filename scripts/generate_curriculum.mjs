import fs from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/m3hrdadfi/persian-words-frequency/main/data/fa_word_count.json';
const LEGACY_COUNT = 84;
const TARGET_COUNT = 1000;
const START_DATE = '2026-07-10';

function loadConstScript(filename, constName, extra = '') {
  return fs.readFile(filename, 'utf8').then((source) => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(`${source}\n${extra}\nglobalThis.__value = ${constName};`, context);
    return { value: context.__value, context };
  });
}

function normalizeFa(input) {
  return String(input || '')
    .normalize('NFC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ۀ/g, 'ه')
    .replace(/[ًٌٍَُِّْٓٔ]/g, '')
    .replace(/\u200f|\u200e/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validHeadword(word) {
  if (word.length < 2 || word.length > 24) return false;
  if (!/^[آ-یءئؤ\u200c ]+$/.test(word)) return false;
  if (/^(http|www|com|ir|org)$/i.test(word)) return false;
  if (/^[اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]{1}$/.test(word)) return false;
  return true;
}

function roughLatin(word) {
  const map = {
    'آ':'â','ا':'â','ب':'b','پ':'p','ت':'t','ث':'s','ج':'j','چ':'ch','ح':'h','خ':'kh',
    'د':'d','ذ':'z','ر':'r','ز':'z','ژ':'zh','س':'s','ش':'sh','ص':'s','ض':'z','ط':'t',
    'ظ':'z','ع':'','غ':'gh','ف':'f','ق':'gh','ک':'k','گ':'g','ل':'l','م':'m','ن':'n',
    'و':'v','ه':'h','ی':'y','ئ':'y','ؤ':'v','ء':'','‌':' ',' ':' '
  };
  return [...word].map((char) => map[char] ?? '').join('').replace(/\s+/g, ' ').trim();
}

const CURATED_ORDER = `
من|تو|او|ما|شما|آنها|این|آن|یک|و|یا|اما|که|برای|با|بدون|از|به|در|روی|زیر|بالا|پایین|جلو|عقب|کنار|بین|داخل|بیرون|اینجا|آنجا|همین|همان|همه|هیچ|بعضی|دیگر|هر|چند|خیلی|کم|بیشتر|کمتر|فقط|هم|همیشه|هرگز|گاهی|الان|امروز|فردا|دیروز|صبح|ظهر|عصر|شب|زود|دیر|قبل|بعد|اول|آخر|دوباره|هنوز|دیگر|شاید|حتماً|واقعاً|تقریباً|بله|نه|باشه|لطفاً|ممنون|مرسی|سلام|خداحافظ|ببخشید|متأسفم|خواهش می‌کنم|چی|چه|کی|کجا|چرا|چطور|کدام|چقدر|چندتا|آیا|بودن|داشتن|رفتن|آمدن|کردن|شدن|گفتن|دیدن|دادن|گرفتن|خوردن|نوشیدن|خواستن|توانستن|دانستن|فهمیدن|خواندن|نوشتن|شنیدن|آوردن|بردن|ماندن|نشستن|ایستادن|خوابیدن|بیدار شدن|پوشیدن|شستن|فروختن|خریدن|ساختن|گذاشتن|برداشتن|رسیدن|فرستادن|پرسیدن|جواب دادن|باز کردن|بستن|شروع کردن|تمام کردن|پیدا کردن|گم کردن|فراموش کردن|یاد گرفتن|یاد دادن|کار کردن|زندگی کردن|صحبت کردن|فکر کردن|نگاه کردن|گوش دادن|بازی کردن|کمک کردن|استفاده کردن|انتخاب کردن|قبول کردن|رد کردن|عوض کردن|تمیز کردن|درست کردن|آماده کردن|صبر کردن|تلاش کردن|احساس کردن|تماس گرفتن|تصمیم گرفتن|عکس گرفتن|دوش گرفتن|اجازه دادن|نشان دادن|ادامه دادن|انجام دادن|راه رفتن|دویدن|رقصیدن|خندیدن|گریه کردن|دوست داشتن|نیاز داشتن|وجود داشتن|رانندگی کردن|سوار شدن|پیاده شدن|برگشتن|افتادن|کشیدن|زدن|پختن|مردن|کشتن|شنا کردن|آدم|مرد|زن|پسر|دختر|بچه|کودک|مادر|پدر|مامان|بابا|خواهر|برادر|شوهر|همسر|خانواده|دوست|همسایه|مهمان|مردم|اسم|نام|سن|سال|روز|هفته|ماه|زمان|وقت|ساعت|دقیقه|ثانیه|لحظه|خانه|اتاق|آشپزخانه|حمام|دستشویی|در|پنجره|دیوار|زمین|سقف|تخت|میز|صندلی|مبل|چراغ|کلید|یخچال|تلویزیون|تلفن|موبایل|کامپیوتر|اینترنت|کتاب|دفتر|کاغذ|قلم|مداد|مدرسه|دانشگاه|کلاس|درس|معلم|دانش‌آموز|دانشجو|کار|شغل|شرکت|اداره|پول|قیمت|خرید|فروش|بازار|فروشگاه|رستوران|کافه|غذا|آب|نان|برنج|گوشت|مرغ|ماهی|تخم‌مرغ|پنیر|شیر|ماست|کره|میوه|سبزی|سیب|پرتقال|موز|انگور|چای|قهوه|شکر|نمک|صبحانه|ناهار|شام|گرسنه|تشنه|ماشین|اتوبوس|قطار|هواپیما|تاکسی|دوچرخه|موتور|خیابان|جاده|راه|شهر|روستا|کشور|ایران|آمریکا|فرودگاه|ایستگاه|هتل|پارک|بیمارستان|بانک|داروخانه|فروشگاه|دریا|کوه|رودخانه|هوا|آفتاب|باران|برف|باد|گرم|سرد|خنک|خشک|خیس|بزرگ|کوچک|بلند|کوتاه|خوب|بد|زیبا|زشت|جدید|قدیمی|جوان|پیر|آسان|سخت|سریع|آهسته|قوی|ضعیف|تمیز|کثیف|باز|بسته|پر|خالی|درست|غلط|مهم|لازم|ممکن|آماده|خوشحال|ناراحت|عصبانی|خسته|بیمار|سالم|ترسیده|نگران|آرام|تنها|مشغول|آزاد|سر|صورت|چشم|گوش|بینی|دهان|دندان|مو|گردن|دست|انگشت|پا|قلب|خون|درد|دارو|دکتر|پرستار|بیماری|سلامتی|رنگ|سفید|سیاه|قرمز|آبی|سبز|زرد|قهوه‌ای|عدد|صفر|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|صد|هزار
`.trim().split('|').map(normalizeFa).filter(Boolean);

const GLOSSES = {
  'من':['man','I / me','Pronoun'], 'تو':['to','you (informal)','Pronoun'], 'او':['u','he / she','Pronoun'],
  'ما':['mâ','we','Pronoun'], 'شما':['shomâ','you (polite / plural)','Pronoun'], 'آنها':['ânhâ','they','Pronoun'],
  'این':['in','this','Function'], 'آن':['ân','that','Function'], 'یک':['yek','one / a','Number'],
  'و':['va','and','Function'], 'یا':['yâ','or','Function'], 'اما':['ammâ','but','Function'], 'که':['ke','that / which','Function'],
  'برای':['barâye','for','Function'], 'با':['bâ','with','Function'], 'بدون':['bedun','without','Function'],
  'از':['az','from / of','Function'], 'به':['be','to','Function'], 'در':['dar','in / at','Function'], 'روی':['ruye','on','Function'],
  'زیر':['zir','under','Function'], 'بین':['beyn','between','Function'], 'داخل':['dâkhel','inside','Function'], 'بیرون':['birun','outside','Function'],
  'همه':['hame','all / everyone','Function'], 'هیچ':['hich','none / any','Function'], 'هر':['har','every','Function'],
  'فقط':['faghat','only','Adverb'], 'همیشه':['hamishe','always','Adverb'], 'هرگز':['hargez','never','Adverb'],
  'گاهی':['gâhi','sometimes','Adverb'], 'هنوز':['hanuz','still / yet','Adverb'], 'شاید':['shâyad','maybe','Adverb'],
  'حتماً':['hatman','definitely','Adverb'], 'واقعاً':['vâghean','really','Adverb'], 'تقریباً':['taghriban','approximately','Adverb'],
  'باشه':['bâshe','okay','Everyday'], 'مرسی':['mersi','thanks','Everyday'], 'متأسفم':['moteassefam','I am sorry','Everyday'],
  'خواهش می‌کنم':['khâhesh mikonam','you are welcome','Everyday'], 'آیا':['âyâ','whether / question marker','Question'],
  'مامان':['mâmân','mom','People'], 'بابا':['bâbâ','dad','People'], 'همسر':['hamsar','spouse','People'],
  'موبایل':['mobâyl','mobile phone','Technology'], 'دستشویی':['dastshuyi','restroom','Home'],
  'صبحانه':['sobhâne','breakfast','Food'], 'ناهار':['nahâr','lunch','Food'], 'شام':['shâm','dinner','Food'],
  'مرغ':['morgh','chicken','Food'], 'تخم‌مرغ':['tokhm-e morgh','egg','Food'],
  'خنک':['khonak','cool','Adjective'], 'خیس':['khis','wet','Adjective'], 'کثیف':['kasif','dirty','Adjective'],
  'ترسیده':['tarside','afraid','Feeling'], 'مشغول':['mashghul','busy','Adjective'],
  'قهوه‌ای':['ghahve-i','brown','Color'], 'صفر':['sefr','zero','Number']
};

const POS_SETS = {
  Question: new Set(['چی','چه','کی','کجا','چرا','چطور','کدام','چقدر','چندتا','آیا']),
  Number: new Set(['صفر','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه','ده','صد','هزار']),
  Pronoun: new Set(['من','تو','او','ما','شما','آنها','این','آن']),
  Time: new Set(['الان','امروز','فردا','دیروز','صبح','ظهر','عصر','شب','زود','دیر','قبل','بعد','اول','آخر','دوباره','هنوز','سال','روز','هفته','ماه','زمان','وقت','ساعت','دقیقه','ثانیه','لحظه']),
  Food: new Set(['غذا','آب','نان','برنج','گوشت','مرغ','ماهی','تخم‌مرغ','پنیر','شیر','ماست','کره','میوه','سبزی','سیب','پرتقال','موز','انگور','چای','قهوه','شکر','نمک','صبحانه','ناهار','شام']),
  People: new Set(['آدم','مرد','زن','پسر','دختر','بچه','کودک','مادر','پدر','مامان','بابا','خواهر','برادر','شوهر','همسر','خانواده','دوست','همسایه','مهمان','مردم']),
  Travel: new Set(['ماشین','اتوبوس','قطار','هواپیما','تاکسی','دوچرخه','موتور','خیابان','جاده','راه','شهر','روستا','کشور','ایران','آمریکا','فرودگاه','ایستگاه','هتل']),
  Health: new Set(['سر','صورت','چشم','گوش','بینی','دهان','دندان','مو','گردن','دست','انگشت','پا','قلب','خون','درد','دارو','دکتر','پرستار','بیماری','سلامتی','بیمار','سالم']),
  Color: new Set(['سفید','سیاه','قرمز','آبی','سبز','زرد','قهوه‌ای']),
  Adjective: new Set(['گرم','سرد','خنک','خشک','خیس','بزرگ','کوچک','بلند','کوتاه','خوب','بد','زیبا','زشت','جدید','قدیمی','جوان','پیر','آسان','سخت','سریع','آهسته','قوی','ضعیف','تمیز','کثیف','باز','بسته','پر','خالی','درست','غلط','مهم','لازم','ممکن','آماده','خوشحال','ناراحت','عصبانی','خسته','گرسنه','تشنه','ترسیده','نگران','آرام','تنها','مشغول','آزاد'])
};

function categoryFor(word, isVerb) {
  if (isVerb) return 'Verb';
  for (const [category, set] of Object.entries(POS_SETS)) if (set.has(word)) return category;
  return 'High-frequency';
}

async function fetchFrequency() {
  const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'farsitutor-curriculum-builder' } });
  if (!response.ok) throw new Error(`Frequency source failed: ${response.status}`);
  return response.json();
}

async function translateSingle(word) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'fa');
  url.searchParams.set('tl', 'en');
  url.searchParams.append('dt', 't');
  url.searchParams.append('dt', 'rm');
  url.searchParams.set('q', word);
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Translate failed: ${response.status}`);
  const data = await response.json();
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const en = segments.map((segment) => segment?.[0] || '').join('').trim();
  const latin = segments.map((segment) => segment?.[3] || '').join('').trim();
  return { en: en || 'meaning unavailable', latin: latin || roughLatin(word) };
}

async function enrichUnknown(words, knownByFa) {
  const unknown = words.filter((word) => !knownByFa.has(word));
  const results = new Map();
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < unknown.length) {
      const index = cursor++;
      const word = unknown[index];
      let value;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          value = await translateSingle(word);
          break;
        } catch (error) {
          if (attempt === 3) value = { en: 'meaning unavailable', latin: roughLatin(word) };
          else await new Promise((resolve) => setTimeout(resolve, attempt * 350));
        }
      }
      results.set(word, value);
      if ((index + 1) % 50 === 0) console.log(`Translated ${index + 1}/${unknown.length}`);
    }
  });
  await Promise.all(workers);
  return results;
}

const { value: parsedWords } = await loadConstScript('words.js', 'WORDS');
const legacyWords = parsedWords.slice(0, LEGACY_COUNT).map((word) => ({ ...word, fa: normalizeFa(word.fa) }));
const { value: verbData, context: verbContext } = await loadConstScript('verbs.js', 'VERB_DATA', 'globalThis.getVerbConjugations = getVerbConjugations;');

const lemmaMap = new Map();
for (const infinitive of Object.keys(verbData)) {
  lemmaMap.set(normalizeFa(infinitive), normalizeFa(infinitive));
  const conjugations = verbContext.getVerbConjugations(infinitive);
  if (!conjugations) continue;
  for (const tense of ['present','past','subjunctive','future']) {
    for (const form of conjugations[tense] || []) lemmaMap.set(normalizeFa(form), normalizeFa(infinitive));
  }
}
['است','هست','هستم','هستی','هستیم','هستید','هستند','بود','بودم','بودی','بودیم','بودید','بودند'].forEach((form) => lemmaMap.set(form, 'بودن'));

const counts = await fetchFrequency();
const countMap = new Map(Object.entries(counts).map(([word, count]) => [normalizeFa(word), Number(count) || 0]));

function maybeSingular(word) {
  const variants = [
    word.endsWith('هایی') ? word.slice(0, -4) : '',
    word.endsWith('های') ? word.slice(0, -3) : '',
    word.endsWith('ها') ? word.slice(0, -2) : ''
  ].filter(Boolean);
  return variants.find((candidate) => candidate.length >= 2 && countMap.has(candidate)) || word;
}

const rankedCorpus = [...countMap.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([raw]) => {
    const normalized = normalizeFa(raw);
    const lemma = lemmaMap.get(normalized) || maybeSingular(normalized);
    return normalizeFa(lemma);
  })
  .filter(validHeadword);

const seen = new Set();
const curriculumFa = [];
const addCandidate = (word) => {
  const normalized = normalizeFa(word);
  if (!validHeadword(normalized) || seen.has(normalized)) return;
  seen.add(normalized);
  curriculumFa.push(normalized);
};

CURATED_ORDER.forEach(addCandidate);
legacyWords.forEach((word) => addCandidate(word.fa));
Object.keys(verbData).forEach(addCandidate);
rankedCorpus.forEach((word) => { if (curriculumFa.length < TARGET_COUNT) addCandidate(word); });

if (curriculumFa.length < TARGET_COUNT) throw new Error(`Only generated ${curriculumFa.length} headwords`);
curriculumFa.length = TARGET_COUNT;

const knownByFa = new Map();
for (const word of legacyWords) knownByFa.set(word.fa, { ...word });
for (const [fa, [latin, en, category]] of Object.entries(GLOSSES)) {
  knownByFa.set(normalizeFa(fa), { fa: normalizeFa(fa), latin, en, category });
}
for (const [fa, data] of Object.entries(verbData)) {
  knownByFa.set(normalizeFa(fa), {
    fa: normalizeFa(fa), latin: data.latin, en: data.en, category: 'Verb', pos: 'verb', verbKey: normalizeFa(fa)
  });
}

const translated = await enrichUnknown(curriculumFa, knownByFa);
const curriculum = curriculumFa.map((fa, rankIndex) => {
  const known = knownByFa.get(fa) || {};
  const auto = translated.get(fa) || {};
  const isVerb = Boolean(verbData[fa]);
  return {
    fa,
    latin: known.latin || auto.latin || roughLatin(fa),
    en: known.en || auto.en || 'meaning unavailable',
    category: known.category || categoryFor(fa, isVerb),
    pos: known.pos || (isVerb ? 'verb' : undefined),
    verbKey: known.verbKey || (isVerb ? fa : undefined),
    exFa: known.exFa,
    exLatin: known.exLatin,
    exEn: known.exEn,
    rank: rankIndex + 1,
    frequency: countMap.get(fa) || undefined
  };
});

const storage = legacyWords.map((word) => ({ ...word }));
const storageIndex = new Map(storage.map((word, index) => [word.fa, index]));
for (const item of curriculum) {
  if (storageIndex.has(item.fa)) {
    const index = storageIndex.get(item.fa);
    storage[index] = { ...storage[index], ...item, exFa: storage[index].exFa || item.exFa, exLatin: storage[index].exLatin || item.exLatin, exEn: storage[index].exEn || item.exEn };
  } else {
    storageIndex.set(item.fa, storage.length);
    storage.push(item);
  }
}
if (storage.length !== TARGET_COUNT) throw new Error(`Storage has ${storage.length}; expected ${TARGET_COUNT}`);
const dailyOrder = curriculum.map((item) => storageIndex.get(item.fa));

const clean = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== ''));
const output = `// Generated by scripts/generate_curriculum.mjs. Do not edit by hand.\n` +
`// Frequency data: ${SOURCE_URL}\n` +
`const LEGACY_WORD_COUNT = ${LEGACY_COUNT};\n` +
`const CURRICULUM_START = '${START_DATE}';\n` +
`const CURRICULUM_SOURCE = 'frequency-informed spoken Persian, using m3hrdadfi/persian-words-frequency (Apache-2.0) with conversational lemma cleanup';\n` +
`const WORDS = ${JSON.stringify(storage.map(clean), null, 2)};\n` +
`const DAILY_ORDER = ${JSON.stringify(dailyOrder)};\n`;

await fs.writeFile('words.js', output);
console.log(`Wrote ${storage.length} stable words and ${dailyOrder.length} daily ranks.`);
console.log(`First: ${curriculum[0].fa} — ${curriculum[0].en}`);
console.log(`Last: ${curriculum.at(-1).fa} — ${curriculum.at(-1).en}`);
