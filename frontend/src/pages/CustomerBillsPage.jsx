import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useAppState } from '../state/AppStateProvider.jsx';
import { formatDisplayDateTime, formatCurrency, getBillStatus } from '../utils/formatters.js';
import { IconSearch } from '../ui/icons.jsx';

const CustomerBillsPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const {
    customers,
    customerBills,
    loadCustomerBills,
    createBill,
    deleteBill,
    loading
  } = useAppState();

  const customer = customers.find((entry) => entry.id === customerId);
  const billsForCustomer = useMemo(() => customerBills[customerId] ?? [], [customerBills, customerId]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'paid', 'empty'

  const filteredBills = useMemo(() => {
    let result = billsForCustomer;

    // Filter by search term
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((bill) => {
        const billNumber = bill.id.slice(-6).toUpperCase();
        return billNumber.toLowerCase().includes(term);
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((bill) => {
        const status = getBillStatus(bill);
        return status === statusFilter;
      });
    }

    return result;
  }, [billsForCustomer, searchTerm, statusFilter]);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setError('');
    loadCustomerBills(customerId).catch((err) => {
      if (!cancelled) {
        setError(err.message ?? 'Failed to fetch bills for this customer.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, loadCustomerBills]);

  if (!customer) {
    return (
      <EmptyState
        title="Customer not found"
        description="The customer you are looking for does not exist or was removed."
        action={
          <Link to="/dashboard" className="btn btn-primary glimmer">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  const handleCreateBill = async () => {
    setCreating(true);
    setError('');
    const result = await createBill(customer.id, {});
    setCreating(false);
    if (result.ok) {
      const billIdentifier = result.bill.billId ?? result.bill.id;
      navigate(`/billing/${billIdentifier}`);
    } else {
      setError(result.message ?? 'Failed to create bill');
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Delete this bill? This cannot be undone.')) return;
    const result = await deleteBill(billId, customer.id);
    if (!result.ok) {
      setError(result.message ?? 'Failed to delete bill');
    }
  };

  const isLoading = Boolean(loading.bills?.[customerId]);

  return (
    <div className="page-content">
      <header className="page-header animate-fade-up">
        <div>
          <h2 className="page-header__title">{customer.name}</h2>
          <p className="page-header__subtitle">
            {customer.phone} • {customer.address || 'Address not provided'}
          </p>
        </div>
      </header>

      <section className="section-surface animate-fade-up--delayed">
        <div className="billing-panel animate-fade-up--delayed">
          <div className="page-toolbar">
            <div>
              <h3 className="section-title">Billing history</h3>
              <p className="section-subtitle">Track outstanding balances, payments, and delivery timelines.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary glimmer"
              onClick={handleCreateBill}
              disabled={creating}
            >
              {creating ? 'Creating…' : 'Create new bill'}
            </button>
          </div>

          {billsForCustomer.length > 0 && (
            <>
              <div className="search-bar" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                <span className="search-bar__icon" aria-hidden="true">
                  <IconSearch />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search bills by bill number"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={clsx('btn', statusFilter === 'all' ? 'btn-primary' : 'btn-outline-light', 'glimmer')}
                  onClick={() => setStatusFilter('all')}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                >
                  All bills
                </button>
                <button
                  type="button"
                  className={clsx('btn', statusFilter === 'pending' ? 'btn-primary' : 'btn-outline-light', 'glimmer')}
                  onClick={() => setStatusFilter('pending')}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                >
                  Pending payments
                </button>
                <button
                  type="button"
                  className={clsx('btn', statusFilter === 'paid' ? 'btn-primary' : 'btn-outline-light', 'glimmer')}
                  onClick={() => setStatusFilter('paid')}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                >
                  Payment done
                </button>
                <button
                  type="button"
                  className={clsx('btn', statusFilter === 'empty' ? 'btn-primary' : 'btn-outline-light', 'glimmer')}
                  onClick={() => setStatusFilter('empty')}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                >
                  No transactions
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="inline-alert" role="alert">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="loading-panel">
              <div className="loading-pulse" aria-hidden="true" />
              <p className="loading-panel__text">Loading bill timeline…</p>
            </div>
          ) : billsForCustomer.length === 0 ? (
            <EmptyState
              title="No bills yet"
              description="Create a bill to start tracking garments and payments for this customer."
              action={
                <button
                  type="button"
                  className="btn btn-primary glimmer"
                  onClick={handleCreateBill}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create first bill'}
                </button>
              }
            />
          ) : filteredBills.length === 0 ? (
            <EmptyState
              title={
                statusFilter !== 'all'
                  ? `No ${statusFilter === 'pending' ? 'pending payment' : statusFilter === 'paid' ? 'paid' : 'empty'} bills`
                  : searchTerm
                    ? 'No bills found'
                    : 'No bills yet'
              }
              description={
                statusFilter !== 'all'
                  ? `No bills found with ${statusFilter === 'pending' ? 'pending payments' : statusFilter === 'paid' ? 'payment done status' : 'no transactions'}. ${searchTerm ? `Also, no bills match "${searchTerm}".` : ''}`
                  : searchTerm
                    ? `No bills found matching "${searchTerm}". Try a different bill number.`
                    : 'Create a bill to start tracking garments and payments for this customer.'
              }
              action={
                searchTerm || statusFilter !== 'all' ? (
                  <button
                    type="button"
                    className="btn btn-primary glimmer"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary glimmer"
                    onClick={handleCreateBill}
                    disabled={creating}
                  >
                    {creating ? 'Creating…' : 'Create first bill'}
                  </button>
                )
              }
            />
          ) : (
            <div className="page-section">
              {filteredBills.map((bill, index) => (
                <article
                  key={bill.id}
                  className="bill-card animate-fade-up"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div>
                    <h4 className="bill-card__title">Bill #{bill.id.slice(-6).toUpperCase()}</h4>
                    <p className="text-muted small">Created {formatDisplayDateTime(bill.createdAt)}</p>
                  </div>
                  <div>
                    <p className="mb-1">
                      Total <strong>{formatCurrency(bill.totalAmount)}</strong>
                    </p>
                    <p className="text-muted small mb-0">Paid {formatCurrency(bill.payedAmount)}</p>
                  </div>
                  <div>
                    <StatusBadge bill={bill} />
                  </div>
                  <div className="customer-card__actions">
                    <button type="button" className="ghost-button" onClick={() => navigate(`/billing/${bill.id}`)}>
                      Open bill
                    </button>
                    <button
                      type="button"
                      className="ghost-button ghost-button--danger"
                      onClick={() => handleDeleteBill(bill.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CustomerBillsPage;

