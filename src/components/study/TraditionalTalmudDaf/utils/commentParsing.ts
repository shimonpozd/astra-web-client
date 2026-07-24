export const parseCommentDh = (hebrewHtml: string) => {
  let dh = '';
  let restHtml = hebrewHtml || '';

  const boldMatch = restHtml.match(/^(?:<br\s*\/?>|\s)*<(b|strong)>(.*?)<\/\1>/i);
  if (boldMatch) {
    dh = boldMatch[2].trim();
    restHtml = restHtml.substring(boldMatch[0].length).trim();
  } else {
    const strippedHtml = restHtml.replace(/<\/?b>/gi, '').replace(/<\/?strong>/gi, '');
    const dashMatch = strippedHtml.match(/^(.*?)([\-–—])(.*)$/s);
    if (dashMatch && dashMatch[1].trim().length < 150) {
      dh = dashMatch[1].trim();
      restHtml = dashMatch[3].trim();
    } else {
      const match = strippedHtml.match(/^(.*?)([\.])(.*)$/s);
      if (match && match[1].trim().length < 100) {
        dh = match[1].trim();
        restHtml = match[3].trim();
      } else {
        dh = strippedHtml.slice(0, 40);
        restHtml = strippedHtml;
      }
    }
  }

  const cleanWords = dh
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'""().,!?;:\-\[\]{}–—]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !/^(וכו|גו|וגו|פי|פירוש|ע)$/i.test(w));

  const matchDh = cleanWords.slice(0, 5).join(' ') || dh;

  return { dh, matchDh, restHtml };
};
