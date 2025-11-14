import { useMemo, useState } from 'react';
import { ITEM_CATALOG, SERVICE_TYPES } from '../../data/itemCatalog.js';

const DEFAULT_STATE = {
  categoryId: ITEM_CATALOG[0]?.id ?? '',
  name: ITEM_CATALOG[0]?.items[0] ?? '',
  quantity: 1,
  pricePerUnit: 50,
  service: SERVICE_TYPES[0]
};

const AddItemForm = ({ disabled, onAddItem }) => {
  const [formState, setFormState] = useState(DEFAULT_STATE);

  const availableItems = useMemo(() => {
    const category = ITEM_CATALOG.find((entry) => entry.id === formState.categoryId);
    return category?.items ?? [];
  }, [formState.categoryId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onAddItem === 'function') {
      onAddItem({
        name: formState.name,
        quantity: Number(formState.quantity),
        pricePerUnit: Number(formState.pricePerUnit),
        service: formState.service
      });
    }
    setFormState((prev) => ({
      ...prev,
      name: availableItems[0] ?? prev.name,
      quantity: 1,
      pricePerUnit: 50
    }));
  };

  return (
    <form className="add-item-form" onSubmit={handleSubmit}>
      <div className="add-item-grid">
        <div>
          <label htmlFor="categoryId">Category</label>
          <select
            id="categoryId"
            name="categoryId"
            className="form-select"
            value={formState.categoryId}
            onChange={handleChange}
            disabled={disabled}
          >
            {ITEM_CATALOG.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="itemName">Item</label>
          <select
            id="itemName"
            name="name"
            className="form-select"
            value={formState.name}
            onChange={handleChange}
            disabled={disabled}
          >
            {availableItems.map((itemName) => (
              <option key={itemName} value={itemName}>
                {itemName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            className="form-control"
            value={formState.quantity}
            onChange={handleChange}
            disabled={disabled}
            required
          />
        </div>

        <div>
          <label htmlFor="pricePerUnit">Rate</label>
          <input
            id="pricePerUnit"
            name="pricePerUnit"
            type="number"
            min="0"
            className="form-control"
            value={formState.pricePerUnit}
            onChange={handleChange}
            disabled={disabled}
            required
          />
        </div>

        <div>
          <label htmlFor="service">Service</label>
          <select
            id="service"
            name="service"
            className="form-select"
            value={formState.service}
            onChange={handleChange}
            disabled={disabled}
          >
            {SERVICE_TYPES.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="add-item-actions">
        <button type="submit" className="btn btn-primary glimmer" disabled={disabled}>
          Add item
        </button>
      </div>
    </form>
  );
};

export default AddItemForm;

