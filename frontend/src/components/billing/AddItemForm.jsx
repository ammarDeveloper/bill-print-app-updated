import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [showItemList, setShowItemList] = useState(false);
  const itemFieldRef = useRef(null);

  const availableItems = useMemo(() => {
    const category = ITEM_CATALOG.find((entry) => entry.id === formState.categoryId);
    return category?.items ?? [];
  }, [formState.categoryId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => {
      // When category changes, also reset the suggested item name to the first item
      if (name === 'categoryId') {
        const category = ITEM_CATALOG.find((entry) => entry.id === value);
        const firstItem = category?.items?.[0] ?? '';
        return { ...prev, categoryId: value, name: firstItem };
      }

      return { ...prev, [name]: value };
    });

    if (name === 'name') {
      setShowItemList(true);
    }
  };

  const handleToggleItemList = () => {
    if (disabled) return;
    setShowItemList((prev) => !prev);
  };

  const handleSelectItem = (itemName) => {
    setFormState((prev) => ({ ...prev, name: itemName }));
    setShowItemList(false);
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

  // Close item list when clicking outside the item field area
  useEffect(() => {
    if (!showItemList) return;

    const handleClickOutside = (event) => {
      if (!itemFieldRef.current) return;
      if (!itemFieldRef.current.contains(event.target)) {
        setShowItemList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showItemList]);

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

        <div style={{ position: 'relative' }} ref={itemFieldRef}>
          <label htmlFor="itemName">Item</label>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <input
              id="itemName"
              name="name"
              type="text"
              className="form-control"
              value={formState.name}
              onChange={handleChange}
              disabled={disabled}
              placeholder="Select from list or type your own (e.g. Track pant white)"
              autoComplete="off"
              onFocus={() => setShowItemList(true)}
            />
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={handleToggleItemList}
              disabled={disabled}
              aria-label="Show item suggestions"
            >
              ▼
            </button>
          </div>

          {showItemList && availableItems.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 10,
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'var(--surface-elevated, #fff)',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '0.5rem',
                marginTop: '0.25rem',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)'
              }}
            >
              {availableItems.map((itemName) => (
                <button
                  key={itemName}
                  type="button"
                  onClick={() => handleSelectItem(itemName)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.4rem 0.75rem',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {itemName}
                </button>
              ))}
            </div>
          )}
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

