export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === '-') return '-';
  try {
    const dateOnly = dateString.split('T')[0];
    const date = new Date(dateOnly);
    if (isNaN(date.getTime())) return dateString;
    return dateOnly;
  } catch (error) {
    console.error('日期格式化失败:', error);
    return dateString;
  }
};

export const formatDateChinese = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === '-') return '-';
  try {
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${year}年${month}月${day}日`;
  } catch (error) {
    console.error('日期格式化失败:', error);
    return dateString;
  }
};
