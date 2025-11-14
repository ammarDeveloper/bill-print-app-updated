import { format, parseISO } from 'date-fns';

export const formatDisplayDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), 'dd MMM yyyy, hh:mm a');
  } catch (error) {
    return isoString;
  }
};

export const formatDisplayDate = (isoString) => {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), 'dd MMM yyyy');
  } catch (error) {
    return isoString;
  }
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

export const getBillStatus = (bill) => {
  if (!bill) return 'unknown';

  const total = Number(bill.totalAmount ?? 0);
  const paid = Number(bill.payedAmount ?? 0);
  const remaining = total - paid;
  const hasItems = Array.isArray(bill.items) && bill.items.length > 0;

  if (total <= 0 && paid <= 0 && !hasItems) {
    return 'empty';
  }
  if (remaining <= 0) {
    return 'paid';
  }
  return 'pending';
};

export const countItems = (bill) =>
  bill?.items?.reduce((acc, item) => acc + Number(item.quantity || 0), 0) ?? 0;

