#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import { handler } from './src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const args = process.argv.slice(2);
const options = {};

for (const arg of args) {
  if (!arg.startsWith('--')) continue;
  const [key, value] = arg.replace(/^--/, '').split('=');
  options[key] = value ?? true;
}

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required for this test.`);
  }
  return value;
};

const defaultHeaders = { 'content-type': 'application/json' };

const createEvent = ({
  method,
  resource,
  pathParameters,
  queryStringParameters,
  headers,
  body
}) => ({
  resource,
  path: resource,
  httpMethod: method,
  headers: headers ?? defaultHeaders,
  multiValueHeaders: {},
  queryStringParameters,
  multiValueQueryStringParameters: null,
  pathParameters,
  stageVariables: null,
  requestContext: {
    resourcePath: resource,
    httpMethod: method,
    path: resource,
    identity: { userAgent: 'local-runner' }
  },
  body,
  isBase64Encoded: false
});

const tests = {
  login: () =>
    createEvent({
      method: 'POST',
      resource: '/auth/login',
      body: JSON.stringify({
        username: process.env.TEST_USERNAME ?? 'Laundry Room',
        password: process.env.TEST_PASSWORD ?? 'LaundryRoom@123'
      })
    }),

  logout: () => createEvent({ method: 'POST', resource: '/auth/logout' }),

  session: () => createEvent({ method: 'GET', resource: '/session' }),

  listCustomers: () => createEvent({ method: 'GET', resource: '/customers' }),

  createCustomer: () =>
    createEvent({
      method: 'POST',
      resource: '/customers',
      body: JSON.stringify({
        name: `Sample Customer ${Date.now()}`,
        phone: process.env.TEST_CUSTOMER_PHONE ?? `9${Math.floor(Math.random() * 1e9)}`,
        address: process.env.TEST_CUSTOMER_ADDRESS ?? '123 Test Street'
      })
    }),

  getCustomer: () =>
    createEvent({
      method: 'GET',
      resource: '/customers/{customerId}',
      pathParameters: { customerId: 'f5493ec7-213b-4bb1-8801-001b034c59c6' }
    }),

  deleteCustomer: () =>
    createEvent({
      method: 'DELETE',
      resource: '/customers/{customerId}',
      pathParameters: { customerId: 'cb6bd124-e11c-4542-91ac-2c13b9d0c416' }
    }),

  createBill: () =>
    createEvent({
      method: 'POST',
      resource: '/customers/{customerId}/bills',
      pathParameters: { customerId: 'f5493ec7-213b-4bb1-8801-001b034c59c6' },
      body: JSON.stringify({
        items: [
          {
            name: process.env.TEST_ITEM_NAME ?? 'Pants',
            quantity: Number(process.env.TEST_ITEM_QTY ?? 2),
            pricePerUnit: Number(process.env.TEST_ITEM_RATE ?? 50),
            service: process.env.TEST_ITEM_SERVICE ?? 'Dry cleaning'
          }
        ],
        payedAmount: Number(process.env.TEST_PAYMENT_AMOUNT ?? 0),
        dueDate: process.env.TEST_DUE_DATE ?? new Date().toISOString()
      })
    }),

  upsertBill: () =>
    createEvent({
      method: 'PUT',
      resource: '/bills/{billId}',
      pathParameters: { billId: '377b0e17-42fd-4742-90f2-d93dcb8d67e9' },
      body: JSON.stringify({
        customerId: process.env.TEST_CUSTOMER_ID,
        items: [
          {
            name: process.env.TEST_ITEM_NAME ?? 'Pants',
            quantity: Number(process.env.TEST_ITEM_QTY ?? 2),
            pricePerUnit: Number(process.env.TEST_ITEM_RATE ?? 50),
            service: process.env.TEST_ITEM_SERVICE ?? 'Dry cleaning'
          },
          {
            name: process.env.TEST_ITEM_NAME_2 ?? 'Pants',
            quantity: Number(process.env.TEST_ITEM_QTY_2 ?? 1),
            pricePerUnit: Number(process.env.TEST_ITEM_RATE_2 ?? 120),
            service: process.env.TEST_ITEM_SERVICE_2 ?? 'Wash and Iron'
          }
        ],
        payedAmount: Number(process.env.TEST_PAYMENT_AMOUNT ?? 0),
        dueDate: process.env.TEST_DUE_DATE ?? new Date().toISOString()
      })
    }),

  listBills: () =>
    createEvent({
      method: 'GET',
      resource: '/customers/{customerId}/bills',
      pathParameters: { customerId: requireEnv('TEST_CUSTOMER_ID') }
    }),

  updateBill: () =>
    createEvent({
      method: 'PUT',
      resource: '/bills/{billId}',
      pathParameters: { billId: requireEnv('TEST_BILL_ID') },
      body: JSON.stringify({
        items: process.env.TEST_UPDATE_ITEMS
          ? JSON.parse(process.env.TEST_UPDATE_ITEMS)
          : [
              { name: 'Jacket', quantity: 1, pricePerUnit: 150, service: 'Dry cleaning' },
              { name: 'Scarf', quantity: 3, pricePerUnit: 30, service: 'Iron only' }
            ],
        payedAmount: Number(process.env.TEST_PAYMENT_AMOUNT ?? 0),
        dueDate: process.env.TEST_DUE_DATE ?? null
      })
    }),

  getBill: () =>
    createEvent({
      method: 'GET',
      resource: '/bills/{billId}',
      pathParameters: { billId: '377b0e17-42fd-4742-90f2-d93dcb8d67e9' }
    }),

  deleteBill: () =>
    createEvent({
      method: 'DELETE',
      resource: '/bills/{billId}',
      pathParameters: { billId: '377b0e17-42fd-4742-90f2-d93dcb8d67e9'}
    }),

  printBill: () =>
    createEvent({
      method: 'GET',
      resource: '/bills/{billId}/pdf',
      pathParameters: { billId: '35e5849c-22f8-4a93-a2e1-f46f21d64631' }
    })
};

const invoke = async (event) => {
  console.log('Invoking handler with event:\n', JSON.stringify(event, null, 2));
  const response = await handler(event, {});
  console.log('\nResponse:\n', JSON.stringify(response, null, 2));
};

const main = async () => {
  if (options.test) {
    const testName = options.test;
    const factory = tests[testName];
    if (!factory) {
      console.error(`Unknown test name "${testName}". Available tests: ${Object.keys(tests).join(', ')}`);
      process.exit(1);
    }
    try {
      await invoke(factory());
      process.exit(0);
    } catch (error) {
      console.error('Test invocation failed:', error);
      process.exit(1);
    }
  }

  const method = (options.method || 'GET').toUpperCase();
  const resource = options.resource || '/session';
  const pathParametersInput = options.pathParameters ? JSON.parse(options.pathParameters) : undefined;
  const queryStringParametersInput = options.queryStringParameters ? JSON.parse(options.queryStringParameters) : undefined;

  let body;
  if (options.body) {
    body = options.body;
  } else if (options.bodyFile) {
    const filePath = resolve(__dirname, options.bodyFile);
    body = readFileSync(filePath, 'utf-8');
  }

  try {
    await invoke(
      createEvent({
        method,
        resource,
        pathParameters: pathParametersInput,
        queryStringParameters: queryStringParametersInput,
        headers: options.headers ? JSON.parse(options.headers) : undefined,
        body
      })
    );
    process.exit(0);
  } catch (error) {
    console.error('Invocation failed:', error);
    process.exit(1);
  }
};

main();
