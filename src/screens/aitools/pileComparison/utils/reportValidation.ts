export const isLikelyFullComparisonReport = (text: string) => {
  const t = String(text || '').trim();
  if (!t) return false;

  const hasCoverOrToc = /\b封面\b|\b目录\b/.test(t);
  const hasCh1 = /(^|\n)\s*#{1,3}\s*一[.、\s]/m.test(t) || /(^|\n)\s*##\s*一\b/m.test(t);
  const hasCh2 = /(^|\n)\s*#{1,3}\s*二[.、\s]/m.test(t);
  const hasCh3 = /(^|\n)\s*#{1,3}\s*三[.、\s]/m.test(t);
  const hasCh4 = /(^|\n)\s*#{1,3}\s*四[.、\s]/m.test(t);
  const hasCh5 = /(^|\n)\s*#{1,3}\s*五[.、\s]/m.test(t);

  // 只出现“附录”而没有正文章节，基本可判定为正文缺失
  const hasAppendixOnly = /(^|\n)\s*#{1,3}\s*附录\b/m.test(t) && !(hasCh1 || hasCh2 || hasCh3 || hasCh4 || hasCh5);
  if (hasAppendixOnly) return false;

  // 对话式确认语（不是报告正文）
  const looksChatty = /(已收到|请指出|请提供|需要你补充|请补充|请确认)/.test(t);
  if (looksChatty && !(hasCh1 || hasCh2 || hasCh3 || hasCh4 || hasCh5)) return false;

  // 最小完整性：至少能识别到“第一章+第四章+第五章”，且有封面/目录或第一章
  return (hasCoverOrToc || hasCh1) && hasCh1 && hasCh4 && hasCh5;
};
