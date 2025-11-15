import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AddItemForm from '../components/billing/AddItemForm.jsx';
import PaymentSection from '../components/billing/PaymentSection.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useAppState } from '../state/AppStateProvider.jsx';
import {
  countItems,
  formatCurrency,
  formatDisplayDateTime
} from '../utils/formatters.js';
import { format, parseISO } from 'date-fns';

const generateTempId = () => `temp-${crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;

const normalizeDraft = (bill) => ({
  ...bill,
  items: (bill.items ?? []).map((item) => ({
    ...item,
    id: item.id ?? item.itemId ?? generateTempId()
  })),
  payedAmount: Number(bill.payedAmount ?? 0),
  dueDate: bill.dueDate ?? null
});

const BillingPage = () => {
  const { billId } = useParams();
  const navigate = useNavigate();
  const { billCache, customers, loadBill, upsertBill, deleteBill, loading } = useAppState();

  const cachedBill = billCache[billId];

  const [draft, setDraft] = useState(cachedBill ? normalizeDraft(cachedBill) : null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(!cachedBill);
  const [saving, setSaving] = useState(false);
  const [savedPaidAmount, setSavedPaidAmount] = useState(null);

  useEffect(() => {
    if (draft && savedPaidAmount === null) {
      setSavedPaidAmount(draft.payedAmount ?? 0);
    }
  }, [draft, savedPaidAmount]);

  useEffect(() => {
    let cancelled = false;
    if (cachedBill) {
      setDraft(normalizeDraft(cachedBill));
      setInitialLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setInitialLoading(true);
    setError(null);

    loadBill(billId)
      .then((bill) => {
        if (!cancelled) {
          setDraft(normalizeDraft(bill));
          setInitialLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load bill');
          setInitialLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [billId, cachedBill, loadBill]);

  const customer = useMemo(() => {
    if (!draft) return null;
    return customers.find((entry) => entry.id === draft.customerId) ?? null;
  }, [customers, draft]);

  const totalAmount = useMemo(() => {
    if (!draft) return 0;
    return draft.items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  }, [draft]);

  const balanceDue = Math.max(0, totalAmount - (draft?.payedAmount ?? 0));
  const canModifyItems = (draft?.payedAmount ?? 0) === 0;
  const hasItems = (draft?.items?.length ?? 0) > 0;
  const isBillSettled =
    totalAmount > 0 && balanceDue === 0 && savedPaidAmount !== null && savedPaidAmount === totalAmount;
  const showItemActions = !isBillSettled;
  const totalPieces = countItems(draft);

  const handleAddItem = (item) => {
    if (!draft) return;
    setDraft((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: generateTempId(),
          itemId: null,
          name: item.name,
          quantity: Number(item.quantity),
          pricePerUnit: Number(item.pricePerUnit),
          service: item.service ?? '',
          createdAt: new Date().toISOString()
        }
      ]
    }));
  };

  const handleRemoveItem = (itemId) => {
    if (!draft) return;
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId)
    }));
  };

  const handlePayedAmountChange = (amount) => {
    setDraft((prev) => ({
      ...prev,
      payedAmount: amount
    }));
  };

  const handleDueDateChange = (isoString) => {
    setDraft((prev) => ({
      ...prev,
      dueDate: isoString
    }));
  };

  const persistBill = async (overrides = {}) => {
    if (!draft) return { ok: false, message: 'Bill not loaded' };
    setSaving(true);
    setStatus(null);
    setError(null);

    const payload = {
      customerId: overrides.customerId ?? draft.customerId,
      items: overrides.items ?? draft.items,
      payedAmount: overrides.payedAmount ?? draft.payedAmount,
      dueDate: overrides.dueDate ?? draft.dueDate
    };

    const result = await upsertBill(draft.billId ?? billId, payload);
    setSaving(false);

    if (result.ok) {
      setDraft(normalizeDraft(result.bill));
      setStatus('Bill saved successfully.');
      setSavedPaidAmount(result.bill.payedAmount ?? null);
    } else {
      setError(result.message ?? 'Failed to save bill');
    }

    return result;
  };

  const handleSave = () => {
    persistBill();
  };

  const handleSavePayment = async (amount) => {
    const result = await persistBill({ payedAmount: amount });
    if (!result.ok) {
      setSavedPaidAmount(null);
    }
    return result;
  };

  const handleDeleteBill = async () => {
    if (!draft) return;
    if (!window.confirm('Delete this bill permanently?')) return;

    const result = await deleteBill(draft.billId ?? billId, draft.customerId);
    if (result.ok) {
      navigate(`/customers/${draft.customerId}`);
    } else {
      setError(result.message ?? 'Failed to delete bill');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    try {
      return parseISO(value);
    } catch (error) {
      const fallback = new Date(value);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
  };

  const formatPrintDateTime = (value, placeholder = 'dd / mm / yyyy, --:-- --') => {
    const dateInstance = parseDateValue(value);
    if (!dateInstance) return placeholder;
    return format(dateInstance, 'dd-MM-yy, hh:mm:ss a');
  };

  if (initialLoading || loading.bill) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="spinner-border" role="status" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load bill"
        description={error}
        action={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        }
      />
    );
  }

  if (!draft) {
    return (
      <EmptyState
        title="Bill not found"
        description="This bill may have been deleted."
        action={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        }
      />
    );
  }

  const printBillId = (draft.billId ?? billId)?.slice(-6).toUpperCase() ?? '';
  const formattedPrintBillId = printBillId ? `BN${printBillId}` : 'Bill';
  const printedCreatedAt = formatPrintDateTime(draft.createdAt, formatPrintDateTime(new Date()));
  const printedDueDate = formatPrintDateTime(draft.dueDate);
  const advanceAmount = Number(draft.payedAmount ?? 0);
  const advanceBalance = Math.max(0, advanceAmount - totalAmount);
  const isPaymentPending = balanceDue > 0;
  const paymentStatusKey = isPaymentPending ? 'pending' : 'completed';
  const paymentStatusLabel = isPaymentPending ? 'Payment Pending' : 'Payment Done';

  const printLayout = (
    <div className="print-template">
      <div className="print-wrapper">
        <div className="company-info">
          <h2 className="company-name">Laundry Room</h2>
          <p className="company-address">
            &quot;NANDAWAT COMPLEX&quot; #7, RMS Bus Stop, Near Bharath Petrol Bunk, Sanjaynage, Bengaluru - 560094
          </p>
          <p className="company-phone">+91-99024 70697, +91-80770 41575</p>
        </div>
        <div className="bill-meta-row">
          <div className="bill-meta-number">
            <h1>{formattedPrintBillId}</h1>
          </div>
          <div className="bill-meta-date">
            <span className="label">Billing Date:</span>
            <strong>{printedCreatedAt}</strong>
          </div>
          <div className="bill-meta-customer">
            <strong>
              {(customer?.name ?? 'Customer')} - {customer?.phone ?? '—'}
            </strong>
            <span>{customer?.address ?? ''}</span>
          </div>
        </div>
        <div className="summary-row">
          <div>
            <span className="summary-value">INR: {totalAmount}</span>
            <span className="summary-label">Current Due</span>
          </div>
          <div>
            <span className="summary-value">INR: {advanceAmount}</span>
            <span className="summary-label">Paid</span>
          </div>
          <div>
            <span className="summary-value">INR: {balanceDue}</span>
            <span className="summary-label">Balance Due</span>
          </div>
          <div className="summary-status-col">
            <span className="summary-label">Status</span>
            <span className={`summary-status summary-status--${paymentStatusKey}`}>{paymentStatusLabel}</span>
          </div>
        </div>
        <div className="extra-row">
          <strong>Total Pcs: {totalPieces}</strong>
          <strong>Paid Balance: {advanceBalance}</strong>
          <strong>Due Date: {printedDueDate}</strong>
        </div>
        <table className="print-items">
          <thead>
            <tr>
              <th>Sno</th>
              <th>Qty</th>
              <th>Preticular&apos;s</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody>
            {draft.items.length ? (
              draft.items.map((item, index) => (
                <tr key={item.id ?? index}>
                  <td>{index + 1}</td>
                  <td>{item.quantity}</td>
                  <td>
                    {item.name}
                    {item.service ? ` -(${item.service})` : ''}
                    {`@Rs.${item.pricePerUnit}`}
                  </td>
                  <td className="text-end">{item.quantity * item.pricePerUnit}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center">
                  No items added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="terms-row">
          <div>
            <h3>Terms &amp; Conditions</h3>
            <p className="pi-terms__last">Original acknowledgement / messages needs to be presented at the time of taking delivery of Garments.</p>
            <p className="pi-terms__last">We are not Responsible for fastness / running of colors / shrinkage / damage to Embellishments.</p>
            <p className="pi-terms__last">We will not be responsible if the garment is not collected within 3 months from the date of reving.</p>
          </div>
          <div className="totals">
            <p>
              <strong>Sub-total : {totalAmount}</strong>
            </p>
            <p>
              <strong>Current Due : {balanceDue}</strong>
            </p>
            <p>
              <strong>Paid : {advanceAmount}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="billing-shell no-print">
        <div className="billing-hero animate-fade-up">
          <div className="billing-hero__top">
            <Link to={`/customers/${draft.customerId}`} className="ghost-button ghost-button--subtle">
              ← Back to bills
            </Link>
            <h1 className="billing-hero__title">Bill #{(draft.billId ?? billId).slice(-6).toUpperCase()}</h1>
            <div className="billing-hero__meta">
              <span>Created {formatDisplayDateTime(draft.createdAt)}</span>
              <span>{customer ? `${customer.name} • ${customer.phone}` : 'Unknown customer'}</span>
            </div>
          </div>
          <div className="billing-hero__actions">
            <StatusBadge
              bill={{ totalAmount, payedAmount: draft.payedAmount, dueDate: draft.dueDate, items: draft.items }}
            />
            <button type="button" className="ghost-button ghost-button--danger" onClick={handleDeleteBill}>
              Delete bill
            </button>
            <button
              type="button"
              className="btn btn-primary glimmer"
              onClick={handlePrint}
              disabled={!draft.items.length}
            >
              Print bill
            </button>
          </div>
        </div>

        {status && (
          <div className="inline-alert inline-alert--success animate-fade-up" role="alert">
            {status}
          </div>
        )}
        {error && (
          <div className="inline-alert animate-fade-up" role="alert">
            {error}
          </div>
        )}

        <div className="metrics-grid animate-fade-up--delayed">
          <div className="metric-card">
            <span className="metric-card__label">Total pieces</span>
            <p className="metric-card__value">{totalPieces}</p>
            <p className="metric-card__hint">Garments captured on this bill</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Due date</span>
            <p className="metric-card__value">{draft.dueDate ? formatDisplayDateTime(draft.dueDate) : 'Not set'}</p>
            <p className="metric-card__hint">Schedule when garments are ready</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Balance due</span>
            <p className="metric-card__value">{formatCurrency(balanceDue)}</p>
            <p className="metric-card__hint">After accounting for received payments</p>
          </div>
        </div>

        <div className="billing-grid">
          <section className="billing-panel animate-fade-up">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="billing-panel__title">Items</h3>
              {isBillSettled && <span className="badge-soft">Paid in full</span>}
            </div>

            {draft.items.length === 0 ? (
              <div className="inline-alert inline-alert--info" role="alert">
                No items yet. Use the form below to add garments to this bill.
              </div>
            ) : (
              <div className="table-halo">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">S.No</th>
                      <th scope="col">Item</th>
                      <th scope="col" className="text-center">
                        Qty
                      </th>
                      <th scope="col">Service</th>
                      <th scope="col" className="text-end">
                        Rate
                      </th>
                      <th scope="col" className="text-end">
                        Total
                      </th>
                      {showItemActions ? <th scope="col" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, index) => (
                      <tr key={item.id}>
                        <th scope="row">{index + 1}</th>
                        <td>
                          <div className="fw-semibold">{item.name}</div>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td>{item.service}</td>
                        <td className="text-end">{formatCurrency(item.pricePerUnit)}</td>
                        <td className="text-end">{formatCurrency(item.pricePerUnit * item.quantity)}</td>
                        {showItemActions ? (
                          <td className="text-end">
                            <button
                              type="button"
                              className="ghost-button ghost-button--danger"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={saving || isBillSettled}
                            >
                              Remove
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {showItemActions ? (
              <div className="no-print">
                <AddItemForm disabled={saving || isBillSettled} onAddItem={handleAddItem} />
              </div>
            ) : null}
          </section>

          <aside className="billing-panel animate-fade-up--delayed no-print">
            <h3 className="billing-panel__title">Payments &amp; Due date</h3>
            <PaymentSection
              totalAmount={totalAmount}
              payedAmount={draft.payedAmount}
              dueDate={draft.dueDate}
              canModifyItems={canModifyItems}
              onChangePayedAmount={handlePayedAmountChange}
              onChangeDueDate={handleDueDateChange}
              onSavePayment={handleSavePayment}
              isSaving={saving}
              disableAdjustments={isBillSettled}
              hasItems={hasItems}
            />
          </aside>
        </div>

        <div className="billing-actions no-print animate-fade-up--delayed">
          <button type="button" className="ghost-button ghost-button--subtle" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="button" className="btn btn-success glimmer" onClick={handleSave} disabled={saving || isBillSettled}>
            {saving ? 'Saving…' : 'Save bill'}
          </button>
        </div>

        <div className="terms-panel animate-fade-up--delayed">
          <h4>Terms &amp; Conditions</h4>
          <ul>
            <li>Original acknowledgement must be presented at the time of delivery.</li>
            <li>We are not responsible for colour fastness, shrinkage or embellishment damage.</li>
            <li>Garments not collected within 90 days will be respectfully recycled.</li>
          </ul>
        </div>
      </div>
      {printLayout}
    </>
  );
};

export default BillingPage;

