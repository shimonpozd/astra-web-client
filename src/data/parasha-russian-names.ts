/**
 * Русские названия недельных глав (парашот) для книг Торы
 * Mapping from English/Hebrew parasha names to Russian translations
 */

export interface ParashaRussianNames {
  [bookName: string]: {
    [parashaSlug: string]: string;
  };
}

export const PARASHA_RUSSIAN_NAMES: ParashaRussianNames = {
  Genesis: {
    'bereshit': 'Берешит',
    'noach': 'Ноах',
    'lech-lecha': 'Лех Леха',
    'vayera': 'Ваера',
    'chayei-sara': 'Хаей Сара',
    'toldot': 'Толдот',
    'vayetzei': 'Ваеце',
    'vayishlach': 'Ваишлах',
    'vayeshev': 'Ваешев',
    'miketz': 'Микец',
    'vayigash': 'Ваигаш',
    'vayechi': 'Ваехи',
  },
  Exodus: {
    'shemot': 'Шмот',
    'vaera': 'Ваэра',
    'bo': 'Бо',
    'beshalach': 'Бешалах',
    'yitro': 'Итро',
    'mishpatim': 'Мишпатим',
    'terumah': 'Трума',
    'tetzaveh': 'Тецаве',
    'ki-tisa': 'Ки Тиса',
    'vayakhel': 'Ваякель',
    'pekudei': 'Пкудей',
  },
  Leviticus: {
    'vayikra': 'Ваикра',
    'tzav': 'Цав',
    'shmini': 'Шмини',
    'tazria': 'Тазриа',
    'metzora': 'Мецора',
    'achrei-mot': 'Ахарей Мот',
    'kedoshim': 'Кдошим',
    'emor': 'Эмор',
    'behar': 'Бехар',
    'bechukotai': 'Бехукотай',
  },
  Numbers: {
    'bamidbar': 'Бамидбар',
    'nasso': 'Насо',
    'behaalotcha': 'Бехаалотха',
    'beha\'alotcha': 'Бехаалотха', // альтернативный вариант с апострофом
    'shlach': 'Шлах',
    'sh\'lach': 'Шлах', // альтернативный вариант с апострофом
    'korach': 'Корах',
    'chukat': 'Хукат',
    'balak': 'Балак',
    'pinchas': 'Пинхас',
    'matot': 'Матот',
    'masei': 'Масе',
  },
  Deuteronomy: {
    'devarim': 'Дварим',
    'vaetchanan': 'Ваэтханан',
    'eikev': 'Экев',
    'reeh': 'Реэ',
    'shoftim': 'Шофтим',
    'ki-teitzei': 'Ки Теце',
    'ki-tavo': 'Ки Таво',
    'nitzavim': 'Ницавим',
    'vayeilech': 'Ваелех',
    'haazinu': 'Аазину',
    'vzot-haberachah': 'Ве-Зот Ха-Браха',
  },
};

/**
 * Нормализует строку для сравнения (приводит к нижнему регистру, заменяет пробелы на дефисы)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/['"]/g, '')
    .replace(/[^\w-]/g, '');
}

/**
 * Получить русское название параши по английскому названию книги и slug параши
 */
export function getParashaRussianName(
  bookName: string,
  parashaSlug: string,
  sharedTitle?: string,
): string | null {
  const bookNames = PARASHA_RUSSIAN_NAMES[bookName];
  if (!bookNames) {
    return null;
  }
  
  // Нормализуем slug для поиска
  const normalizedSlug = normalizeForComparison(parashaSlug);
  
  // Попробуем найти точное совпадение по slug
  for (const [slug, russianName] of Object.entries(bookNames)) {
    if (normalizeForComparison(slug) === normalizedSlug) {
      return russianName;
    }
  }
  
  // Если не найдено по slug, попробуем найти по sharedTitle
  if (sharedTitle) {
    const normalizedTitle = normalizeForComparison(sharedTitle);
    for (const [slug, russianName] of Object.entries(bookNames)) {
      if (normalizeForComparison(slug) === normalizedTitle) {
        return russianName;
      }
    }
  }
  
  return null;
}

