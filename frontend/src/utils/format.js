export const formatCurrencyEUR = (value) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(value);

export const buildMonthRangeParams = (year, month) => {
  const params = {};
  if (year && month) {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    params.date_from = `${year}-${mm}-01`;
    params.date_to = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  } else if (year) {
    params.date_from = `${year}-01-01`;
    params.date_to = `${year}-12-31`;
  }
  return params;
};
