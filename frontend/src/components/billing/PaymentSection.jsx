import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { addDays, format, parseISO } from 'date-fns';
import { formatCurrency } from '../../utils/formatters.js';

const deriveDueDateParts = (iso) => {
  if (!iso) {
    return { date: '', time: '18:00' };
  }

  try {
    const parsed = parseISO(iso);
    return {
      date: format(parsed, 'yyyy-MM-dd'),
      time: format(parsed, 'HH:mm')
    };
  } catch (error) {
    return { date: '', time: '18:00' };
  }
};

const PaymentSection = ({
  totalAmount,
  payedAmount,
  dueDate,
  canModifyItems,
  onChangePayedAmount,
  onChangeDueDate,
  onSavePayment,
  isSaving,
  disableAdjustments = false,
  hasItems = true,
  className
}) => {
  const { date: initialDate, time: initialTime } = useMemo(() => deriveDueDateParts(dueDate), [dueDate]);
  const [dueDateDate, setDueDateDate] = useState(initialDate);
  const [dueDateTime, setDueDateTime] = useState(initialTime);
  const [paymentInput, setPaymentInput] = useState('');
  const [message, setMessage] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    setPaymentInput('');
  }, [payedAmount]);

  useEffect(() => {
    setDueDateDate(initialDate);
    setDueDateTime(initialTime);
  }, [initialDate, initialTime]);

  const paymentInputNumber = Number(paymentInput);
  const effectivePayedAmount =
    Number.isFinite(paymentInputNumber) && paymentInput !== '' ? payedAmount + paymentInputNumber : payedAmount;
  const balanceDue = Math.max(0, totalAmount - effectivePayedAmount);
  const maxPaymentAmount = Math.max(0, totalAmount - payedAmount);
  const adjustmentsLocked = disableAdjustments;
  const itemsAvailable = Boolean(hasItems);
  const controlsLocked = adjustmentsLocked || savingPayment || isSaving || !itemsAvailable;

  const handleDueDateSubmit = (event) => {
    event.preventDefault();
    if (!itemsAvailable) {
      setMessage({ type: 'info', text: 'Add at least one item before setting a due date.' });
      return;
    }
    if (!dueDateDate) {
      onChangeDueDate(null);
      setMessage({ type: 'success', text: 'Due date cleared.' });
      return;
    }

    const timeComponent = dueDateTime || '18:00';
    const composed = new Date(`${dueDateDate}T${timeComponent}`);
    onChangeDueDate(composed.toISOString());
    setMessage({ type: 'success', text: 'Due date updated.' });
  };

  const handlePaymentInputChange = (event) => {
    const value = event.target.value;
    setPaymentInput(value);
    
    // Clear validation messages when user starts typing
    if (message?.type === 'danger' || message?.type === 'info') {
      setMessage(null);
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    if (!itemsAvailable) {
      setMessage({ type: 'info', text: 'Add items before recording a payment.' });
      return;
    }
    if (paymentInput === '') {
      setMessage({ type: 'danger', text: 'Enter the amount you are receiving now.' });
      return;
    }
    const amount = Number(paymentInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage({ type: 'danger', text: 'Enter a valid payment amount.' });
      return;
    }
    if (amount > maxPaymentAmount) {
      setMessage({ type: 'danger', text: `Payment cannot exceed balance due (${formatCurrency(maxPaymentAmount)}).` });
      return;
    }

    const previousAmount = payedAmount;
    const combinedAmount = payedAmount + amount;
    onChangePayedAmount(combinedAmount);

    if (typeof onSavePayment === 'function') {
      try {
        setSavingPayment(true);
        const result = await onSavePayment(combinedAmount);
        if (result?.ok) {
          setPaymentInput('');
          setMessage({ type: 'success', text: 'Payment saved.' });
        } else {
          throw new Error(result?.message ?? 'Failed to save payment');
        }
      } catch (error) {
        onChangePayedAmount(previousAmount);
        setMessage({ type: 'danger', text: error.message ?? 'Failed to save payment.' });
      } finally {
        setSavingPayment(false);
      }
    }

    setPaymentInput('');
  };

  const handleQuickSet = (daysAhead) => {
    const next = addDays(new Date(), daysAhead);
    setDueDateDate(format(next, 'yyyy-MM-dd'));
    setDueDateTime('18:00');
  };

  const handleClearDueDate = () => {
    setDueDateDate('');
    setDueDateTime('18:00');
    onChangeDueDate(null);
    setMessage({ type: 'success', text: 'Due date cleared.' });
  };

  return (
    <div className={clsx('payment-panel', className)}>
      <div className="payment-summary">
        <div className="payment-summary__row">
          <div className="payment-summary__tile">
            <span className="payment-summary__label">Total amount</span>
            <span className="payment-summary__value">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="payment-summary__tile">
            <span className="payment-summary__label">Paid</span>
            <span className="payment-summary__value">{formatCurrency(effectivePayedAmount)}</span>
          </div>
          <div className="payment-summary__tile">
            <span className="payment-summary__label">Balance due</span>
            <span className="payment-summary__value">{formatCurrency(balanceDue)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleDueDateSubmit} className="payment-form">
        <label htmlFor="dueDate" className="fw-semibold">
          Set due date
        </label>
        <div className="payment-form__row">
          <input
            id="dueDate"
            type="date"
            className="form-control"
            value={dueDateDate}
            onChange={(event) => setDueDateDate(event.target.value)}
            disabled={controlsLocked}
          />
          <input
            id="dueTime"
            type="time"
            className="form-control"
            value={dueDateTime}
            onChange={(event) => setDueDateTime(event.target.value)}
            disabled={controlsLocked}
          />
        </div>
        <div className="payment-form__quick">
          <button
            type="button"
            className="ghost-button ghost-button--subtle"
            onClick={() => handleQuickSet(1)}
            disabled={controlsLocked}
          >
            +1 day
          </button>
          <button
            type="button"
            className="ghost-button ghost-button--subtle"
            onClick={() => handleQuickSet(3)}
            disabled={controlsLocked}
          >
            +3 days
          </button>
          <button
            type="button"
            className="ghost-button ghost-button--subtle"
            onClick={() => handleQuickSet(7)}
            disabled={controlsLocked}
          >
            +1 week
          </button>
          <button
            type="button"
            className="ghost-button ghost-button--danger"
            onClick={handleClearDueDate}
            disabled={controlsLocked}
          >
            Clear
          </button>
        </div>
        <button type="submit" className="btn btn-outline-light" disabled={controlsLocked}>
          Save due date
        </button>
      </form>

      <form onSubmit={handlePaymentSubmit} className="payment-form">
        <label htmlFor="paymentAmount" className="fw-semibold">
          Record payment
        </label>
        <div className="payment-form__row">
          <input
            id="paymentAmount"
            type="number"
            min="0"
            max={maxPaymentAmount}
            step="0.01"
            className="form-control"
            placeholder={`Enter amount (max: ${formatCurrency(maxPaymentAmount)})`}
            value={paymentInput}
            onChange={handlePaymentInputChange}
            disabled={controlsLocked}
          />
          <button type="submit" className="btn btn-success glimmer" disabled={controlsLocked || savingPayment}>
            {savingPayment ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </form>

      {message && (
        <div className={clsx('message-bubble', `message-bubble--${message.type}`)} role="status">
          {message.text}
        </div>
      )}

      <p className="text-muted small mb-0">
        {canModifyItems ? 'Item quantities remain editable while payments are pending.' : 'Items are locked once fully paid.'}
      </p>
    </div>
  );
};

export default PaymentSection;

