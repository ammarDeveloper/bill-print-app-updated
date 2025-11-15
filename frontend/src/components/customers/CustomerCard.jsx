import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAppState } from '../../state/AppStateProvider.jsx';
import { hasPendingBills } from '../../utils/formatters.js';

const CustomerCard = ({ customer, animationDelay = 0 }) => {
  const navigate = useNavigate();
  const { deleteCustomer, customerBills } = useAppState();
  const bills = customerBills[customer.id] ?? [];
  const hasPending = hasPendingBills(bills);

  const handleOpen = () => {
    navigate(`/customers/${customer.id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete customer ${customer.name}? This removes all associated bills.`)) {
      return;
    }
    const result = await deleteCustomer(customer.id);
    if (!result.ok) {
      window.alert(result.message ?? 'Failed to delete customer');
    }
  };

  return (
    <article
      className={clsx('customer-card', 'animate-fade-up')}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div>
        <h3 className="customer-card__name">{customer.name}</h3>
        <p className="customer-card__address">{customer.address || 'No address provided yet'}</p>
      </div>

      <div>
        <p className="customer-card__phone">{customer.phone}</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="customer-meta-chip">Active customer</span>
          {hasPending && (
            <span className="status-badge status-badge--pending" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
              Pending
            </span>
          )}
        </div>
      </div>

      <div className="customer-card__actions">
        <button type="button" className="ghost-button" onClick={handleOpen}>
          View timeline
        </button>
        <button type="button" className="ghost-button ghost-button--danger" onClick={handleDelete}>
          Remove
        </button>
      </div>
    </article>
  );
};

export default CustomerCard;

