export interface TractateInfo {
  he_name: string;
  ru_name: string;
  order: string;
  pages: [number, number]; // [start, end]
}

export interface OrderInfo {
  name: string;
  he_name: string;
  ru_name: string;
  description: string;
}

export const TALMUD_ORDERS: OrderInfo[] = [
  {
    name: "Zeraim",
    he_name: "זרעים",
    ru_name: "Зраим",
    description: "Сельскохозяйственные законы"
  },
  {
    name: "Moed", 
    he_name: "מועד",
    ru_name: "Моэд",
    description: "Праздники и субботы"
  },
  {
    name: "Nashim",
    he_name: "נשים", 
    ru_name: "Нашим",
    description: "Женщины и брак"
  },
  {
    name: "Nezikin",
    he_name: "נזיקין",
    ru_name: "Незикин", 
    description: "Ущербы и суды"
  },
  {
    name: "Kodashim",
    he_name: "קדשים",
    ru_name: "Кодашим",
    description: "Священные предметы"
  },
  {
    name: "Taharot",
    he_name: "טהרות",
    ru_name: "Тахарот",
    description: "Чистота и нечистота"
  }
];

export const TALMUD_BAVLI_TRACTATES: Record<string, TractateInfo> = {
  // Zeraim
  "Berakhot": { he_name: "ברכות", ru_name: "Брахот", order: "Zeraim", pages: [2, 64] },

  // Moed
  "Shabbat": { he_name: "שבת", ru_name: "Шабат", order: "Moed", pages: [2, 157] },
  "Eruvin": { he_name: "עירובין", ru_name: "Эрувин", order: "Moed", pages: [2, 105] },
  "Pesachim": { he_name: "פסחים", ru_name: "Псахим", order: "Moed", pages: [2, 121] },
  "Rosh Hashanah": { he_name: "ראש השנה", ru_name: "Рош Ашана", order: "Moed", pages: [2, 35] },
  "Yoma": { he_name: "יומא", ru_name: "Йома", order: "Moed", pages: [2, 88] },
  "Sukkah": { he_name: "סוכה", ru_name: "Сука", order: "Moed", pages: [2, 56] },
  "Beitzah": { he_name: "ביצה", ru_name: "Бейца", order: "Moed", pages: [2, 40] },
  "Taanit": { he_name: "תענית", ru_name: "Таанит", order: "Moed", pages: [2, 31] },
  "Megillah": { he_name: "מגילה", ru_name: "Мегила", order: "Moed", pages: [2, 32] },
  "Moed Katan": { he_name: "מועד קטן", ru_name: "Моэд Катан", order: "Moed", pages: [2, 29] },
  "Chagigah": { he_name: "חגיגה", ru_name: "Хагига", order: "Moed", pages: [2, 27] },

  // Nashim
  "Yevamot": { he_name: "יבמות", ru_name: "Йевамот", order: "Nashim", pages: [2, 122] },
  "Ketubot": { he_name: "כתובות", ru_name: "Ктубот", order: "Nashim", pages: [2, 112] },
  "Nedarim": { he_name: "נדרים", ru_name: "Недарим", order: "Nashim", pages: [2, 91] },
  "Nazir": { he_name: "נזיר", ru_name: "Назир", order: "Nashim", pages: [2, 66] },
  "Sotah": { he_name: "סוטה", ru_name: "Сота", order: "Nashim", pages: [2, 49] },
  "Gittin": { he_name: "גיטין", ru_name: "Гитин", order: "Nashim", pages: [2, 90] },
  "Kiddushin": { he_name: "קידושין", ru_name: "Кидушин", order: "Nashim", pages: [2, 82] },

  // Nezikin
  "Bava Kamma": { he_name: "בבא קמא", ru_name: "Бава Кама", order: "Nezikin", pages: [2, 119] },
  "Bava Metzia": { he_name: "בבא מציעא", ru_name: "Бава Мециа", order: "Nezikin", pages: [2, 119] },
  "Bava Batra": { he_name: "בבא בתרא", ru_name: "Бава Батра", order: "Nezikin", pages: [2, 176] },
  "Sanhedrin": { he_name: "סנהדרין", ru_name: "Санедрин", order: "Nezikin", pages: [2, 113] },
  "Makkot": { he_name: "מכות", ru_name: "Макот", order: "Nezikin", pages: [2, 24] },
  "Shevuot": { he_name: "שבועות", ru_name: "Швуот", order: "Nezikin", pages: [2, 49] },
  "Avodah Zarah": { he_name: "עבודה זרה", ru_name: "Авода Зара", order: "Nezikin", pages: [2, 76] },
  "Horayot": { he_name: "הוריות", ru_name: "Орайот", order: "Nezikin", pages: [2, 14] },

  // Kodashim
  "Zevachim": { he_name: "זבחים", ru_name: "Звахим", order: "Kodashim", pages: [2, 120] },
  "Menachot": { he_name: "מנחות", ru_name: "Менахот", order: "Kodashim", pages: [2, 110] },
  "Chullin": { he_name: "חולין", ru_name: "Хулин", order: "Kodashim", pages: [2, 142] },
  "Bekhorot": { he_name: "בכורות", ru_name: "Бхорот", order: "Kodashim", pages: [2, 61] },
  "Arakhin": { he_name: "ערכין", ru_name: "Арахин", order: "Kodashim", pages: [2, 34] },
  "Temurah": { he_name: "תמורה", ru_name: "Тмура", order: "Kodashim", pages: [2, 34] },
  "Keritot": { he_name: "כריתות", ru_name: "Кританim", order: "Kodashim", pages: [2, 28] },
  "Meilah": { he_name: "מעילה", ru_name: "Меила", order: "Kodashim", pages: [2, 22] },
  "Kinnim": { he_name: "קינים", ru_name: "Киним", order: "Kodashim", pages: [22, 25] },
  "Tamid": { he_name: "תמיד", ru_name: "Тамид", order: "Kodashim", pages: [25, 33] },
  "Midot": { he_name: "מדות", ru_name: "Мидот", order: "Kodashim", pages: [33, 37] },

  // Taharot
  "Niddah": { he_name: "נדה", ru_name: "Нида", order: "Taharot", pages: [2, 73] }
};



































