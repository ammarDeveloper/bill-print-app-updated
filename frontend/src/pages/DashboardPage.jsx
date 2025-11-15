import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { IconSearch, IconUserPlus } from '../ui/icons.jsx';
import CustomerCard from '../components/customers/CustomerCard.jsx';
import NewCustomerForm from '../components/customers/NewCustomerForm.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useAppState } from '../state/AppStateProvider.jsx';
import { hasPendingBills } from '../utils/formatters.js';

const DashboardPage = () => {
  const { customers, customerBills, loading } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Filter by search term
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (customer) => customer.name.toLowerCase().includes(term) || customer.phone.toLowerCase().includes(term)
      );
    }

    // Filter by pending bills
    if (showOnlyPending) {
      result = result.filter((customer) => {
        const bills = customerBills[customer.id] ?? [];
        return hasPendingBills(bills);
      });
    }

    return result;
  }, [customers, searchTerm, showOnlyPending, customerBills]);

  const isLoading = loading.customers;

  return (
    <div className="page-content">
      <header className="page-header animate-fade-up">
        <h2 className="page-header__title">Customer Command Center</h2>
        <p className="page-header__subtitle">
          Search, onboard, and engage with your patrons while their laundry journeys stay front and center.
        </p>
      </header>

      <section className="section-surface animate-fade-up--delayed">
        <div className="page-toolbar">
          <div className="search-bar">
            <span className="search-bar__icon" aria-hidden="true">
              <IconSearch />
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="Search customers by phone or name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className={clsx('btn', showOnlyPending ? 'btn-primary' : 'btn-outline-light', 'glimmer')}
              onClick={() => setShowOnlyPending((prev) => !prev)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {showOnlyPending ? '✓ Pending only' : 'Show pending'}
            </button>
            <button
              type="button"
              className="btn btn-primary glimmer d-inline-flex align-items-center gap-2"
              onClick={() => setShowNewCustomer((prev) => !prev)}
            >
              <IconUserPlus />
              {showNewCustomer ? 'Close form' : 'New customer'}
            </button>
          </div>
        </div>

        {showNewCustomer && (
          <div className="divider" role="presentation" />
        )}

        {showNewCustomer && (
          <div className="form-panel animate-fade-up">
            <NewCustomerForm onSubmitted={() => setShowNewCustomer(false)} />
          </div>
        )}
      </section>

      {isLoading ? (
        <div className="loading-panel">
          <div className="loading-pulse" aria-hidden="true" />
          <p className="loading-panel__text">Fetching your customer roster…</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={
            showOnlyPending
              ? 'No customers with pending bills'
              : searchTerm
                ? 'No matches found'
                : 'Your first customer awaits'
          }
          description={
            showOnlyPending
              ? 'All customers have completed their payments, or bills haven\'t been loaded yet. View a customer\'s timeline to load their bills.'
              : searchTerm
                ? `We couldn't find anyone for "${searchTerm}". Try adjusting the spelling or searching by phone number.`
                : 'Create a customer profile to begin tracking laundry orders and payments.'
          }
          action={
            !showNewCustomer && (
              <button
                type="button"
                className="btn btn-primary glimmer d-inline-flex align-items-center gap-2"
                onClick={() => setShowNewCustomer(true)}
              >
                <IconUserPlus />
                Add customer
              </button>
            )
          }
        />
      ) : (
        <div className="customer-grid">
          {filteredCustomers.map((customer, index) => (
            <CustomerCard key={customer.id} customer={customer} animationDelay={index * 60} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

