export interface BookInfo {
  he_name: string;
  ru_name: string;
  section: string;
  chapters: number;
}

export interface SectionInfo {
  name: string;
  he_name: string;
  ru_name: string;
  description: string;
}

export const TANAKH_SECTIONS: SectionInfo[] = [
  {
    name: "Torah",
    he_name: "תורה",
    ru_name: "Тора",
    description: "Пятикнижие Моисея"
  },
  {
    name: "Nevi'im",
    he_name: "נביאים",
    ru_name: "Невиим",
    description: "Пророки"
  },
  {
    name: "Ketuvim",
    he_name: "כתובים",
    ru_name: "Ктувим",
    description: "Писания"
  }
];

export const TANAKH_BOOKS: Record<string, BookInfo> = {
  // Torah
  "Genesis": { he_name: "בראשית", ru_name: "Брейшит", section: "Torah", chapters: 50 },
  "Exodus": { he_name: "שמות", ru_name: "Шмот", section: "Torah", chapters: 40 },
  "Leviticus": { he_name: "ויקרא", ru_name: "Ваикра", section: "Torah", chapters: 27 },
  "Numbers": { he_name: "במדבר", ru_name: "Бемидбар", section: "Torah", chapters: 36 },
  "Deuteronomy": { he_name: "דברים", ru_name: "Дварим", section: "Torah", chapters: 34 },

  // Nevi'im Rishonim (Early Prophets)
  "Joshua": { he_name: "יהושע", ru_name: "Йеошуа", section: "Nevi'im", chapters: 24 },
  "Judges": { he_name: "שופטים", ru_name: "Шофтим", section: "Nevi'im", chapters: 21 },
  "I Samuel": { he_name: "שמואל א", ru_name: "Шмуэль I", section: "Nevi'im", chapters: 31 },
  "II Samuel": { he_name: "שמואל ב", ru_name: "Шмуэль II", section: "Nevi'im", chapters: 24 },
  "I Kings": { he_name: "מלכים א", ru_name: "Млахим I", section: "Nevi'im", chapters: 22 },
  "II Kings": { he_name: "מלכים ב", ru_name: "Млахим II", section: "Nevi'im", chapters: 25 },

  // Nevi'im Acharonim (Later Prophets)
  "Isaiah": { he_name: "ישעיהו", ru_name: "Йешаяу", section: "Nevi'im", chapters: 66 },
  "Jeremiah": { he_name: "ירמיהו", ru_name: "Йирмияу", section: "Nevi'im", chapters: 52 },
  "Ezekiel": { he_name: "יחזקאל", ru_name: "Йехезкель", section: "Nevi'im", chapters: 48 },
  
  // Trei Asar (Twelve Minor Prophets)
  "Hosea": { he_name: "הושע", ru_name: "Ошеа", section: "Nevi'im", chapters: 14 },
  "Joel": { he_name: "יואל", ru_name: "Йоэль", section: "Nevi'im", chapters: 4 },
  "Amos": { he_name: "עמוס", ru_name: "Амос", section: "Nevi'im", chapters: 9 },
  "Obadiah": { he_name: "עובדיה", ru_name: "Овадья", section: "Nevi'im", chapters: 1 },
  "Jonah": { he_name: "יונה", ru_name: "Йона", section: "Nevi'im", chapters: 4 },
  "Micah": { he_name: "מיכה", ru_name: "Миха", section: "Nevi'im", chapters: 7 },
  "Nahum": { he_name: "נחום", ru_name: "Нахум", section: "Nevi'im", chapters: 3 },
  "Habakkuk": { he_name: "חבקוק", ru_name: "Хавакук", section: "Nevi'im", chapters: 3 },
  "Zephaniah": { he_name: "צפניה", ru_name: "Цфанья", section: "Nevi'im", chapters: 3 },
  "Haggai": { he_name: "חגי", ru_name: "Хагай", section: "Nevi'im", chapters: 2 },
  "Zechariah": { he_name: "זכריה", ru_name: "Зхарья", section: "Nevi'im", chapters: 14 },
  "Malachi": { he_name: "מלאכי", ru_name: "Малахи", section: "Nevi'im", chapters: 3 },

  // Ketuvim
  "Psalms": { he_name: "תהלים", ru_name: "Теилим", section: "Ketuvim", chapters: 150 },
  "Proverbs": { he_name: "משלי", ru_name: "Мишлей", section: "Ketuvim", chapters: 31 },
  "Job": { he_name: "איוב", ru_name: "Ийов", section: "Ketuvim", chapters: 42 },
  "Song of Songs": { he_name: "שיר השירים", ru_name: "Шир ашим", section: "Ketuvim", chapters: 8 },
  "Ruth": { he_name: "רות", ru_name: "Рут", section: "Ketuvim", chapters: 4 },
  "Lamentations": { he_name: "איכה", ru_name: "Эйха", section: "Ketuvim", chapters: 5 },
  "Ecclesiastes": { he_name: "קהלת", ru_name: "Коэлет", section: "Ketuvim", chapters: 12 },
  "Esther": { he_name: "אסתר", ru_name: "Эстер", section: "Ketuvim", chapters: 10 },
  "Daniel": { he_name: "דניאל", ru_name: "Даниэль", section: "Ketuvim", chapters: 12 },
  "Ezra": { he_name: "עזרא", ru_name: "Эзра", section: "Ketuvim", chapters: 10 },
  "Nehemiah": { he_name: "נחמיה", ru_name: "Нехемья", section: "Ketuvim", chapters: 13 },
  "I Chronicles": { he_name: "דברי הימים א", ru_name: "Диврей аймим I", section: "Ketuvim", chapters: 29 },
  "II Chronicles": { he_name: "דברי הימים ב", ru_name: "Диврей аймим II", section: "Ketuvim", chapters: 36 }
};


























