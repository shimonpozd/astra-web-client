export interface SectionInfo {
  he_name: string;
  ru_name: string;
  simanim: number;
  description: string;
}

export const SHULCHAN_ARUKH_SECTIONS: Record<string, SectionInfo> = {
  "Orach Chaim": {
    he_name: "אורח חיים",
    ru_name: "Орах Хаим",
    simanim: 697,
    description: "Ежедневные законы, молитвы, субботы и праздники"
  },
  "Yoreh De'ah": {
    he_name: "יורה דעה",
    ru_name: "Йорэ Деа",
    simanim: 403,
    description: "Кашрут, траур, обеты и ритуальная чистота"
  },
  "Even HaEzer": {
    he_name: "אבן העזר",
    ru_name: "Эвен аЭзер",
    simanim: 178,
    description: "Брак, развод и семейные отношения"
  },
  "Choshen Mishpat": {
    he_name: "חושן משפט",
    ru_name: "Хошен Мишпат",
    simanim: 427,
    description: "Гражданское право, суды и ущербы"
  }
};
































