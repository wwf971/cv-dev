// What a query can derive from a stored value (doc/cv-query.md#derived-values): kana and
// romaji, upper and lower case, the Japanese era of a year, an age. Pure functions.

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KANA_OFFSET = 0x60;

function codeMap(text, isInRange, offset) {
	return [...String(text)].map((char) => {
		const code = char.codePointAt(0);
		return isInRange(code) ? String.fromCodePoint(code + offset) : char;
	}).join('');
}

export function cvHiraganaToKatakana(text) {
	return codeMap(text, (code) => code >= HIRAGANA_START && code <= HIRAGANA_END, KANA_OFFSET);
}

export function cvKatakanaToHiragana(text) {
	return codeMap(text, (code) => code >= HIRAGANA_START + KANA_OFFSET && code <= HIRAGANA_END + KANA_OFFSET, -KANA_OFFSET);
}

// modified Hepburn; a long vowel is written as its kana are
const ROMAJI_BY_KANA = {
	あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
	か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
	さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
	た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
	な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
	は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
	ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
	や: 'ya', ゆ: 'yu', よ: 'yo',
	ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
	わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
	きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
	しゃ: 'sha', しゅ: 'shu', しょ: 'sho', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
	ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
	にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
	びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
	みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
};

export function cvKanaToRomaji(text) {
	const kana = cvKatakanaToHiragana(text);
	let result = '';
	let isDoubled = false;
	for (let index = 0; index < kana.length; index += 1) {
		const char = kana[index];
		if (char === 'っ') {
			isDoubled = true;
			continue;
		}
		if (char === 'ー') {
			continue;
		}
		const pair = kana.slice(index, index + 2);
		const romaji = ROMAJI_BY_KANA[pair] ?? ROMAJI_BY_KANA[char];
		if (ROMAJI_BY_KANA[pair]) index += 1;
		if (romaji === undefined) {
			result += char;
			isDoubled = false;
			continue;
		}
		// っ doubles the next consonant; before ch it is written t (matcha)
		if (isDoubled) result += romaji.startsWith('ch') ? 't' : romaji[0];
		isDoubled = false;
		result += romaji;
	}
	return result;
}

export function cvUppercaseFirst(text) {
	return String(text).toLowerCase().replace(/(^|[\s-])(\S)/g, (match, separator, char) => `${separator}${char.toUpperCase()}`);
}

// the era of a date: its month decides in the year an era began (a year alone: the new era)
const ERA_LIST = [
	{ name: '令和', year: 2019, month: 5 },
	{ name: '平成', year: 1989, month: 1 },
	{ name: '昭和', year: 1926, month: 12 },
	{ name: '大正', year: 1912, month: 7 },
	{ name: '明治', year: 1868, month: 1 },
];

export function cvYearEraGet(yearInput, monthInput) {
	const year = Number(yearInput);
	if (!Number.isFinite(year)) return '';
	const month = Number.parseInt(monthInput, 10);
	const era = ERA_LIST.find((one) => year > one.year || (year === one.year && (!Number.isFinite(month) || month >= one.month)));
	if (!era) return '';
	const eraYear = year - era.year + 1;
	return `${era.name}${eraYear === 1 ? '元' : eraYear}`;
}

// the age on a date: it increments only once the birthday has passed
export function cvAgeGet(birth, dateNow) {
	const year = Number(birth.year);
	if (!Number.isFinite(year)) return '';
	let age = dateNow.getFullYear() - year;
	const month = Number(birth.month);
	const day = Number(birth.day);
	const monthNow = dateNow.getMonth() + 1;
	if (Number.isFinite(month) && (monthNow < month || (monthNow === month && Number.isFinite(day) && dateNow.getDate() < day))) age -= 1;
	return String(age);
}
