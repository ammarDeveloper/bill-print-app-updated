import { useState } from 'react';
import { useAppState } from '../../state/AppStateProvider.jsx';

const INITIAL_STATE = {
  name: '',
  phone: '',
  address: ''
};

const NewCustomerForm = ({ onSubmitted }) => {
  const { createCustomer } = useAppState();
  const [formState, setFormState] = useState(INITIAL_STATE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const result = await createCustomer({
      name: formState.name.trim(),
      phone: formState.phone.trim(),
      address: formState.address.trim()
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.message ?? 'Failed to save customer');
      return;
    }

    setFormState(INITIAL_STATE);
    onSubmitted?.();
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="customerName">Customer Name</label>
        <input
          id="customerName"
          name="name"
          type="text"
          className="form-control"
          placeholder="Enter customer name"
          value={formState.name}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <label htmlFor="customerPhone">Phone Number</label>
        <input
          id="customerPhone"
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="\d{10}"
          className="form-control"
          placeholder="10-digit phone"
          value={formState.phone}
          onChange={handleChange}
          required
        />
        <small className="text-muted">Digits only, e.g. 9876543210</small>
      </div>

      <div>
        <label htmlFor="customerAddress">Address</label>
        <textarea
          id="customerAddress"
          name="address"
          rows={3}
          className="form-control"
          placeholder="Apartment / Street / Landmark"
          value={formState.address}
          onChange={handleChange}
        />
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary glimmer" disabled={saving}>
          {saving ? 'Saving…' : 'Save customer'}
        </button>
      </div>
    </form>
  );
};

export default NewCustomerForm;

