import clsx from 'clsx';
import { getBillStatus } from '../../utils/formatters.js';

const STATUS_COPY = {
  empty: { label: 'No transactions', className: 'status-badge status-badge--neutral' },
  pending: { label: 'Payment pending', className: 'status-badge' },
  paid: { label: 'Payment done', className: 'status-badge status-badge--success' },
  unknown: { label: 'Status unknown', className: 'status-badge status-badge--muted' }
};

const StatusBadge = ({ bill }) => {
  const statusKey = getBillStatus(bill);
  const { label, className } = STATUS_COPY[statusKey] ?? STATUS_COPY.unknown;

  return <span className={clsx(className)}>{label}</span>;
};

export default StatusBadge;

