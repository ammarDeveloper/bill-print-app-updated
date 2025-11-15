import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const rawBaseUrl = (envBaseUrl.trim() || 'https://cbls0rj8t3.execute-api.ap-south-1.amazonaws.com/prod').trim();
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
};

const AppStateContext = createContext(null);

const normalizeCustomer = (customer) => ({
  id: customer.customerId ?? customer.id,
  name: customer.name ?? '',
  phone: customer.phone ?? '',
  address: customer.address ?? '',
  createdAt: customer.createdAt ?? null
});

const normalizeBillItem = (item) => ({
  id: item.itemId ?? item.id ?? randomId(),
  itemId: item.itemId ?? item.id ?? null,
  name: item.name ?? '',
  quantity: Number(item.quantity ?? 0),
  pricePerUnit: Number(item.pricePerUnit ?? 0),
  service: item.service ?? '',
  createdAt: item.createdAt ?? null
});

const summarizeBill = (bill) => ({
  id: bill.id,
  billId: bill.id,
  customerId: bill.customerId,
  totalAmount: bill.totalAmount ?? 0,
  payedAmount: bill.payedAmount ?? 0,
  dueDate: bill.dueDate ?? null,
  createdAt: bill.createdAt ?? null,
  updatedAt: bill.updatedAt ?? null
});

const normalizeBillResponse = (payload) => {
  const billPayload = payload.bill ?? payload;
  const itemsPayload = payload.items ?? billPayload.items ?? [];
  const normalizedItems = itemsPayload.map(normalizeBillItem);

  return {
    id: billPayload.billId ?? billPayload.id,
    billId: billPayload.billId ?? billPayload.id,
    customerId: billPayload.customerId,
    totalAmount: Number(billPayload.totalAmount ?? 0),
    payedAmount: Number(billPayload.payedAmount ?? 0),
    dueDate: billPayload.dueDate ?? null,
    createdAt: billPayload.createdAt ?? null,
    updatedAt: billPayload.updatedAt ?? null,
    items: normalizedItems
  };
};

const SESSION_STORAGE_KEY = 'billing_app_session';
const SESSION_EXPIRY_KEY = 'billing_app_session_expiry';

export const AppStateProvider = ({ children }) => {
  const [customers, setCustomers] = useState([]);
  const [customerBills, setCustomerBills] = useState({});
  const [billCache, setBillCache] = useState({});
  const [loading, setLoading] = useState({ customers: false, bills: {}, bill: false });
  const [auth, setAuth] = useState(() => {
    // Initialize auth state from localStorage
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
    
    if (!token || !expiry) {
      return { isAuthenticated: false, token: null, username: null };
    }
    
    // Check if session expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = parseInt(expiry, 10);
    
    if (expiresAt < now) {
      // Session expired, clear storage
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      return { isAuthenticated: false, token: null, username: null };
    }
    
    return { isAuthenticated: true, token, username: 'admin' };
  });

  const apiFetch = useCallback(async (path, { method = 'GET', body, skipAuth = false } = {}) => {
    const headers = { 
      'Content-Type': 'application/json'
    };

    // Add auth token if available and not skipping auth
    if (!skipAuth && auth.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }

    const url = `${API_BASE_URL}${path}`;
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json().catch(() => ({})) : await response.text();

    // Handle 401 Unauthorized - session expired
    if (response.status === 401 && !skipAuth) {
      // Clear session
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      setAuth({ isAuthenticated: false, token: null, username: null });
      const error = new Error('Session expired. Please login again.');
      error.statusCode = 401;
      throw error;
    }

    if (!response.ok) {
      const message = (data && data.message) || response.statusText || 'Request failed';
      const error = new Error(message);
      error.statusCode = response.status;
      error.details = data;
      throw error;
    }

    if (response.status === 204) return null;
    return data;
  }, [auth.token]);

  const loadCustomers = useCallback(
    async () => {
      setLoading((prev) => ({ ...prev, customers: true }));
      try {
        const data = await apiFetch('/customers');
        const items = (data?.items ?? []).map(normalizeCustomer);
        setCustomers(items);
        return items;
      } catch (error) {
        console.error('Failed to load customers:', error);
        // Don't throw - just set empty array so app can still render
        setCustomers([]);
        return [];
      } finally {
        setLoading((prev) => ({ ...prev, customers: false }));
      }
    },
    [apiFetch]
  );

  const createCustomer = useCallback(
    async ({ name, phone, address }) => {
      try {
        const response = await apiFetch('/customers', {
          method: 'POST',
          body: { name, phone, address }
        });
        const normalized = normalizeCustomer(response);
        setCustomers((prev) => [...prev, normalized]);
        setCustomerBills((prev) => ({ ...prev, [normalized.id]: [] }));
        return { ok: true, customer: normalized };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    [apiFetch]
  );

  const deleteCustomer = useCallback(
    async (customerId) => {
      try {
        await apiFetch(`/customers/${customerId}`, { method: 'DELETE' });
        setCustomers((prev) => prev.filter((customer) => customer.id !== customerId));
        setCustomerBills((prev) => {
          if (!prev[customerId]) return prev;
          const { [customerId]: _, ...rest } = prev;
          return rest;
        });
        setBillCache((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((billKey) => {
            if (next[billKey]?.customerId === customerId) {
              delete next[billKey];
            }
          });
          return next;
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    [apiFetch]
  );

  const loadCustomerBills = useCallback(
    async (customerId) => {
      setLoading((prev) => ({ ...prev, bills: { ...prev.bills, [customerId]: true } }));
      try {
        const data = await apiFetch(`/customers/${customerId}/bills`);
        const items = (data?.items ?? []).map((bill) =>
          summarizeBill({
            id: bill.billId,
            customerId: bill.customerId,
            totalAmount: bill.totalAmount,
            payedAmount: bill.payedAmount,
            dueDate: bill.dueDate,
            createdAt: bill.createdAt,
            updatedAt: bill.updatedAt
          })
        );
        setCustomerBills((prev) => ({ ...prev, [customerId]: items }));
        return items;
      } finally {
        setLoading((prev) => ({
          ...prev,
          bills: { ...prev.bills, [customerId]: false }
        }));
      }
    },
    [apiFetch]
  );

  const createBill = useCallback(
    async (customerId, payload = {}) => {
      try {
        const body = {
          items: (payload.items ?? []).map((item) => {
            const itemId = item.itemId ?? (item.id && !item.id.startsWith('temp-') ? item.id : undefined);
            return {
              itemId,
              name: item.name,
              quantity: Number(item.quantity ?? 0),
              pricePerUnit: Number(item.pricePerUnit ?? 0),
              service: item.service
            };
          }),
          payedAmount: Number(payload.payedAmount ?? 0),
          dueDate: payload.dueDate ?? null
        };
        const response = await apiFetch(`/customers/${customerId}/bills`, {
          method: 'POST',
          body
        });
        const normalized = normalizeBillResponse(response);
        setBillCache((prev) => ({ ...prev, [normalized.id]: normalized }));
        setCustomerBills((prev) => {
          const existing = prev[customerId] ?? [];
          return {
            ...prev,
            [customerId]: [summarizeBill(normalized), ...existing]
          };
        });
        return { ok: true, bill: normalized };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    [apiFetch]
  );

  const loadBill = useCallback(
    async (billId) => {
      setLoading((prev) => ({ ...prev, bill: true }));
      try {
        const response = await apiFetch(`/bills/${billId}`);
        const normalized = normalizeBillResponse(response);
        setBillCache((prev) => ({ ...prev, [billId]: normalized }));
        return normalized;
      } finally {
        setLoading((prev) => ({ ...prev, bill: false }));
      }
    },
    [apiFetch]
  );

  const upsertBill = useCallback(
    async (billId, { customerId, items, payedAmount, dueDate }) => {
      try {
        const body = {
          customerId,
          items: (items ?? []).map((item) => {
            const itemId = item.itemId ?? (item.id && !item.id.startsWith('temp-') ? item.id : undefined);
            return {
              itemId,
            name: item.name,
              quantity: Number(item.quantity ?? 0),
              pricePerUnit: Number(item.pricePerUnit ?? 0),
            service: item.service
            };
          }),
          payedAmount: Number(payedAmount ?? 0),
          dueDate: dueDate ?? null
        };
        const response = await apiFetch(`/bills/${billId}`, {
          method: 'PUT',
          body
        });
        const normalized = normalizeBillResponse(response);
        setBillCache((prev) => ({ ...prev, [billId]: normalized }));
        setCustomerBills((prev) => {
          const existing = prev[normalized.customerId] ?? [];
          const updatedList = existing.some((bill) => bill.id === normalized.id)
            ? existing.map((bill) => (bill.id === normalized.id ? summarizeBill(normalized) : bill))
            : [summarizeBill(normalized), ...existing];
          return { ...prev, [normalized.customerId]: updatedList };
        });
        return { ok: true, bill: normalized };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    [apiFetch]
  );

  const deleteBill = useCallback(
    async (billId, customerId) => {
      try {
        await apiFetch(`/bills/${billId}`, { method: 'DELETE' });
        setBillCache((prev) => {
          const next = { ...prev };
          delete next[billId];
          return next;
        });
        if (customerId) {
          setCustomerBills((prev) => {
            const existing = prev[customerId];
            if (!existing) return prev;
            return {
              ...prev,
              [customerId]: existing.filter((bill) => bill.id !== billId)
            };
          });
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error.message };
      }
    },
    [apiFetch]
  );

  const login = useCallback(async (credentials) => {
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: credentials,
        skipAuth: true
      });

      if (response && response.token && response.expiresAt) {
        // Store session
        localStorage.setItem(SESSION_STORAGE_KEY, response.token);
        localStorage.setItem(SESSION_EXPIRY_KEY, String(response.expiresAt));
        
        setAuth({
          isAuthenticated: true,
          token: response.token,
          username: response.username || 'admin'
        });

        return { ok: true };
      }

      return { ok: false, message: 'Invalid response from server' };
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      return { ok: false, message: errorMessage };
    }
  }, [apiFetch]);

  const logout = useCallback(async () => {
    try {
      // Try to call logout API
      await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {
        // Ignore errors - we'll clear local session anyway
      });
    } catch (error) {
      // Ignore errors
    } finally {
      // Always clear local session
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      setAuth({ isAuthenticated: false, token: null, username: null });
    }
  }, [apiFetch]);

  const checkSessionExpiry = useCallback(() => {
    const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!expiry) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = parseInt(expiry, 10);

    if (expiresAt < now) {
      // Session expired
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      setAuth({ isAuthenticated: false, token: null, username: null });
      return false;
    }

    return true;
  }, []);

  // Check session expiry on mount and periodically
  useEffect(() => {
    // Check immediately
    checkSessionExpiry();

    // Check every 5 minutes
    const interval = setInterval(() => {
      if (!checkSessionExpiry()) {
        clearInterval(interval);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkSessionExpiry]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      loadCustomers();
    }
  }, [auth.isAuthenticated, loadCustomers]);

  const value = useMemo(
    () => ({
      customers,
      customerBills,
      billCache,
      loading,
      auth,
      login,
      logout,
      createCustomer,
      deleteCustomer,
      loadCustomerBills,
      createBill,
      loadBill,
      upsertBill,
      deleteBill
    }),
    [
      customers,
      customerBills,
      billCache,
      loading,
      auth,
      login,
      logout,
      createCustomer,
      deleteCustomer,
      loadCustomerBills,
      createBill,
      loadBill,
      upsertBill,
      deleteBill
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
};

