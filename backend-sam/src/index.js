"use strict";

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

/**
 * Lambda handler stub for the serverless Bill Printing API (Node.js).
 * Replace placeholder logic with real implementations accessing DynamoDB.
 */

const TABLE_NAME = process.env.TABLE_NAME ?? 'BillingAppTable';
const BILL_TTL_DAYS_RAW = Number(process.env.BILL_TTL_DAYS ?? 30);
const BILL_TTL_DAYS = Number.isFinite(BILL_TTL_DAYS_RAW) && BILL_TTL_DAYS_RAW > 0 ? BILL_TTL_DAYS_RAW : 30;
const BILL_TTL_SECONDS = Math.max(1, Math.round(BILL_TTL_DAYS * 24 * 60 * 60));

const rawClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
};

const buildResponse = (statusCode, body) => ({
  statusCode,
  headers: DEFAULT_HEADERS,
  body: body === undefined || body === null ? '' : JSON.stringify(body)
});

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
};

const badRequest = (message) => {
  throw Object.assign(new Error(message), { statusCode: 400 });
};

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const computeExpiresAt = () => Math.floor(Date.now() / 1000) + BILL_TTL_SECONDS;

// Auth constants
const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 24 hours
const VALID_PASSCODE = process.env.ADMIN_PASSCODE;

if (!VALID_PASSCODE) {
  console.error('ERROR: ADMIN_PASSCODE environment variable is not set. Login will be disabled.');
}

const generateSessionToken = () => {
  return randomBytes(32).toString('hex');
};

const hashToken = (token) => {
  return createHash('sha256').update(token).digest('hex');
};

const computeSessionExpiresAt = () => Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

const getSessionToken = (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

const validateSession = async (sessionToken) => {
  if (!sessionToken) return null;
  
  const tokenHash = hashToken(sessionToken);
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'SESSION', sk: `TOKEN#${tokenHash}` }
      })
    );
    
    if (!result.Item) return null;
    
    const expiresAt = result.Item.expiresAt;
    const now = Math.floor(Date.now() / 1000);
    
    if (expiresAt && expiresAt < now) {
      // Session expired, delete it
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'SESSION', sk: `TOKEN#${tokenHash}` }
        })
      ).catch(() => {});
      return null;
    }
    
    return result.Item;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
};

const requireAuth = async (event) => {
  const sessionToken = getSessionToken(event);
  const session = await validateSession(sessionToken);
  
  if (!session) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
  
  return session;
};

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) {
    badRequest('items must be an array');
  }

  return items.map((item, index) => {
    const name = item?.name?.trim();
    if (!name) {
      badRequest(`items[${index}].name is required`);
    }

    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      badRequest(`items[${index}].quantity must be greater than 0`);
    }

    const pricePerUnit = Number(item?.pricePerUnit ?? 0);
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      badRequest(`items[${index}].pricePerUnit must be zero or positive`);
    }

    const service = item?.service ? String(item.service).trim() : null;

    return {
      itemId: item?.itemId ? String(item.itemId) : uuidv4(),
      name,
      quantity,
      pricePerUnit,
      service
    };
  });
};

const computeTotalAmount = (items) => items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);

const deleteExistingBillItems = async (billId, existingItems) => {
  const itemsToDelete = existingItems ?? (await listBillItems(billId));

  if (!itemsToDelete.length) return;

  const deleteRequests = itemsToDelete.map((item) => ({
    DeleteRequest: {
      Key: { pk: `BILL#${billId}`, sk: item.sk }
    }
  }));

  const chunks = chunkArray(deleteRequests, 25);
  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: chunk }
      })
    );
  }
};

const writeBillItems = async (billId, customerId, items, defaultTimestamp, expiresAt) => {
  if (!items.length) return;

  const putRequests = items.map((item) => ({
    PutRequest: {
      Item: {
        pk: `BILL#${billId}`,
        sk: `ITEM#${item.itemId}`,
        itemId: item.itemId,
        billId,
        customerId,
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        service: item.service,
        createdAt: item.createdAt ?? defaultTimestamp,
        expiresAt,
        entityType: 'BILL_ITEM'
      }
    }
  }));

  const chunks = chunkArray(putRequests, 25);
  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: chunk }
      })
    );
  }
};

const routes = [];
const addRoute = (method, resource, handler) => {
  routes.push({ method: method.toUpperCase(), resource, handler });
};

const dispatch = async (event) => {
  const method = (event.httpMethod ?? 'GET').toUpperCase();
  const resource = event.resource;

  for (const route of routes) {
    if (route.method === method && route.resource === resource) {
      return route.handler(event);
    }
  }

  return buildResponse(404, {
    message: `No route configured for ${method} ${resource}`
  });
};

const ensureCustomerExists = async (customerId) => {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CUSTOMER#${customerId}`, sk: 'PROFILE' }
    })
  );
  if (!result.Item) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  }
  return result.Item;
};

const getBillSummary = async (billId) => {
  const response = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: '#gpk = :bill',
      ExpressionAttributeNames: { '#gpk': 'gsi1pk' },
      ExpressionAttributeValues: { ':bill': `BILL#${billId}` },
      Limit: 1
    })
  );
  const summary = response.Items?.[0];
  if (!summary) {
    throw Object.assign(new Error('Bill not found'), { statusCode: 404 });
  }
  return summary;
};

const listBillItems = async (billId) => {
  const response = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': `BILL#${billId}` }
    })
  );
  return response.Items ?? [];
};

const deleteAllBillItems = async (billId) => {
  const items = await listBillItems(billId);
  if (!items.length) return;
  const deleteRequests = items.map((item) => ({
    DeleteRequest: {
      Key: { pk: `BILL#${billId}`, sk: item.sk }
    }
  }));
  const chunks = chunkArray(deleteRequests, 25);
  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: chunk }
      })
    );
  }
};

const normalizeBillPayload = (body) => {
  if (!body || typeof body !== 'object') {
    throw Object.assign(new Error('Bill payload must be an object'), { statusCode: 400 });
  }
  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw Object.assign(new Error('At least one item is required'), { statusCode: 400 });
  }

  const items = rawItems.map((raw, index) => {
    const name = raw?.name?.toString().trim();
    const service = raw?.service ? raw.service.toString().trim() : 'General';
    const quantity = Number(raw?.quantity ?? raw?.qty);
    const pricePerUnit = Number(raw?.pricePerUnit ?? raw?.rate ?? 0);
    if (!name) {
      throw Object.assign(new Error(`Item ${index + 1} is missing name`), { statusCode: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Item ${index + 1} has invalid quantity`), { statusCode: 400 });
    }
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      throw Object.assign(new Error(`Item ${index + 1} has invalid pricePerUnit`), { statusCode: 400 });
    }
    const itemId = raw?.itemId?.toString().trim() || uuidv4();
    return {
      itemId,
      name,
      quantity,
      pricePerUnit,
      service
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  const payedAmountRaw = Number(body?.payedAmount ?? 0);
  if (!Number.isFinite(payedAmountRaw) || payedAmountRaw < 0) {
    throw Object.assign(new Error('payedAmount must be a non-negative number'), { statusCode: 400 });
  }
  if (payedAmountRaw > totalAmount) {
    throw Object.assign(new Error('payedAmount cannot exceed total amount'), { statusCode: 400 });
  }

  const dueDateRaw = body?.dueDate;
  let dueDate = null;
  if (dueDateRaw !== null && dueDateRaw !== undefined && dueDateRaw !== '') {
    const parsed = Date.parse(dueDateRaw);
    if (Number.isNaN(parsed)) {
      throw Object.assign(new Error('dueDate must be an ISO 8601 datetime'), { statusCode: 400 });
    }
    dueDate = new Date(parsed).toISOString();
  }

  return {
    items,
    payedAmount: payedAmountRaw,
    dueDate,
    totalAmount
  };
};

// Auth & session -----------------------------------------------------------

addRoute('POST', '/auth/login', async (event) => {
  const body = parseBody(event);
  const passcode = body?.passcode?.trim();
  
  if (!passcode) {
    return buildResponse(400, { message: 'Passcode is required' });
  }
  
  // Check if passcode is configured
  if (!VALID_PASSCODE) {
    console.error('Login attempt failed: ADMIN_PASSCODE not configured');
    return buildResponse(503, { message: 'Authentication service is not configured. Please contact administrator.' });
  }
  
  // Validate passcode
  if (passcode !== VALID_PASSCODE) {
    return buildResponse(401, { message: 'Invalid passcode' });
  }
  
  // Create session
  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = computeSessionExpiresAt();
  const createdAt = new Date().toISOString();
  
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'SESSION',
        sk: `TOKEN#${tokenHash}`,
        sessionToken: tokenHash,
        username: 'admin',
        createdAt,
        expiresAt,
        entityType: 'SESSION'
        // Note: expiresAt is used as TTL attribute for automatic cleanup
      }
    })
  );
  
  return buildResponse(200, {
    token: sessionToken,
    expiresAt,
    username: 'admin'
  });
});

addRoute('POST', '/auth/logout', async (event) => {
  try {
    const session = await requireAuth(event);
    const tokenHash = hashToken(getSessionToken(event));
    
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'SESSION', sk: `TOKEN#${tokenHash}` }
      })
    );
    
    return buildResponse(200, { message: 'Logged out successfully' });
  } catch (error) {
    if (error.statusCode === 401) {
      return buildResponse(401, { message: 'Unauthorized' });
    }
    throw error;
  }
});

addRoute('GET', '/auth/verify', async (event) => {
  try {
    const session = await requireAuth(event);
    return buildResponse(200, {
      authenticated: true,
      username: session.username,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    return buildResponse(401, { authenticated: false, message: 'Unauthorized' });
  }
});

// Customers ---------------------------------------------------------------

addRoute('GET', '/customers', async (event) => {
  await requireAuth(event);
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': 'CUSTOMERS' }
    })
  );
  const items = (result.Items ?? []).map((item) => ({
    customerId: item.customerId,
    name: item.name,
    phone: item.phone,
    address: item.address,
    createdAt: item.createdAt
  }));
  items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return buildResponse(200, { items });
});

addRoute('POST', '/customers', async (event) => {
  await requireAuth(event);
  const body = parseBody(event);
  const name = body?.name?.trim();
  const phone = body?.phone?.trim();
  const address = (body?.address ?? '').trim();
  if (!name || !phone) {
    return buildResponse(400, { message: 'name and phone are required' });
  }

  const existing = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: '#gpk = :phone',
      ExpressionAttributeNames: { '#gpk': 'gsi1pk' },
      ExpressionAttributeValues: { ':phone': `PHONE#${phone}` },
      Limit: 1
    })
  );
  if (existing.Count && existing.Items?.[0]?.customerId) {
    return buildResponse(409, { message: 'Phone number already exists' });
  }

  const customerId = uuidv4();
  const createdAt = new Date().toISOString();
  const profileItem = {
    pk: `CUSTOMER#${customerId}`,
    sk: 'PROFILE',
    customerId,
    name,
    phone,
    address,
    createdAt,
    gsi1pk: `PHONE#${phone}`,
    gsi1sk: `CUSTOMER#${customerId}`,
    entityType: 'CUSTOMER'
  };
  const listingItem = {
    pk: 'CUSTOMERS',
    sk: `CUSTOMER#${customerId}`,
    customerId,
    name,
    phone,
    address,
    createdAt,
    entityType: 'CUSTOMER'
  };

  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: [
          { PutRequest: { Item: profileItem } },
          { PutRequest: { Item: listingItem } }
        ]
      }
    })
  );

  return buildResponse(201, { customerId, name, phone, address, createdAt });
});

addRoute('GET', '/customers/{customerId}', async (event) => {
  await requireAuth(event);
  const customerId = event.pathParameters?.customerId;
  if (!customerId) {
    return buildResponse(400, { message: 'customerId path parameter is required' });
  }
  const profile = await ensureCustomerExists(customerId);
  return buildResponse(200, {
    customerId,
    name: profile.name,
    phone: profile.phone,
    address: profile.address,
    createdAt: profile.createdAt
  });
});

addRoute('DELETE', '/customers/{customerId}', async (event) => {
  await requireAuth(event);
  const customerId = event.pathParameters?.customerId;
  if (!customerId) {
    return buildResponse(400, { message: 'customerId path parameter is required' });
  }
  await ensureCustomerExists(customerId);

  const billQuery = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': `CUSTOMER#${customerId}` }
    })
  );

  const deleteRequests = [
    { DeleteRequest: { Key: { pk: `CUSTOMER#${customerId}`, sk: 'PROFILE' } } },
    { DeleteRequest: { Key: { pk: 'CUSTOMERS', sk: `CUSTOMER#${customerId}` } } }
  ];

  const billItems = billQuery.Items ?? [];
  for (const bill of billItems) {
    if (!bill.sk?.startsWith('BILL#')) continue;
    deleteRequests.push({
      DeleteRequest: {
        Key: { pk: `CUSTOMER#${customerId}`, sk: bill.sk }
      }
    });
    const billId = bill.billId;
    if (!billId) continue;
    await deleteAllBillItems(billId);
  }

  const chunks = chunkArray(deleteRequests, 25);
  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: chunk }
      })
    );
  }

  return buildResponse(204);
});

// Bills ------------------------------------------------------------------

addRoute('GET', '/customers/{customerId}/bills', async (event) => {
  await requireAuth(event);
  const customerId = event.pathParameters?.customerId;
  if (!customerId) {
    return buildResponse(400, { message: 'customerId path parameter is required' });
  }
  await ensureCustomerExists(customerId);

  const response = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: { ':pk': `CUSTOMER#${customerId}`, ':sk': 'BILL#' }
    })
  );
  const items = (response.Items ?? []).map((bill) => ({
    billId: bill.billId,
    customerId: bill.customerId,
    totalAmount: bill.totalAmount ?? 0,
    payedAmount: bill.payedAmount ?? 0,
    dueDate: bill.dueDate ?? null,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt
  }));
  items.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return buildResponse(200, { items });
});

addRoute('POST', '/customers/{customerId}/bills', async (event) => {
  await requireAuth(event);
  const customerId = event.pathParameters?.customerId;
  if (!customerId) {
    badRequest('customerId path parameter is required');
  }
  await ensureCustomerExists(customerId);
 
  const body = parseBody(event);
  const items = normalizeItems(body.items ?? []);
  const totalAmount = computeTotalAmount(items);
 
  let payedAmount = Number(body?.payedAmount ?? 0);
  if (!Number.isFinite(payedAmount) || payedAmount < 0) {
    badRequest('payedAmount must be zero or positive');
  }
  if (payedAmount > totalAmount) {
    badRequest('payedAmount cannot exceed total amount');
  }
 
  let dueDate = body?.dueDate ?? null;
  if (dueDate && Number.isNaN(Date.parse(dueDate))) {
    badRequest('dueDate must be an ISO datetime string');
  }
 
  const billId = uuidv4();
  const timestamp = new Date().toISOString();
  const expiresAt = computeExpiresAt();
  const enrichedItems = items.map((item) => ({ ...item, createdAt: timestamp }));
 
  const summaryItem = {
    pk: `CUSTOMER#${customerId}`,
    sk: `BILL#${billId}`,
    billId,
    customerId,
    totalAmount,
    payedAmount,
    dueDate,
    createdAt: timestamp,
    updatedAt: timestamp,
    gsi1pk: `BILL#${billId}`,
    gsi1sk: 'SUMMARY',
    expiresAt,
    entityType: 'BILL'
  };
 
  try {
    await writeBillItems(billId, customerId, enrichedItems, timestamp, expiresAt);
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: summaryItem }));
  } catch (error) {
    await deleteExistingBillItems(billId).catch(() => {});
    await docClient
      .send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { pk: `CUSTOMER#${customerId}`, sk: `BILL#${billId}` }
        })
      )
      .catch(() => {});
    throw error;
  }
 
  const responseItems = enrichedItems.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    quantity: item.quantity,
    pricePerUnit: item.pricePerUnit,
    service: item.service,
    createdAt: item.createdAt
  }));
 
  return buildResponse(201, {
    bill: {
      billId,
      customerId,
      totalAmount,
      payedAmount,
      dueDate,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    items: responseItems
  });
});

addRoute('PUT', '/bills/{billId}', async (event) => {
  await requireAuth(event);
  const billId = event.pathParameters?.billId;
  if (!billId) {
    badRequest('billId path parameter is required');
  }
 
  const body = parseBody(event);
 
  let existingSummary = null;
  try {
    existingSummary = await getBillSummary(billId);
  } catch (error) {
    if (error.statusCode === 404) {
      existingSummary = null;
    } else {
      throw error;
    }
  }
 
  const customerId = body?.customerId ?? existingSummary?.customerId;
  if (!customerId) {
    badRequest('customerId is required');
  }
  if (!existingSummary) {
    await ensureCustomerExists(customerId);
  }
 
  const items = normalizeItems(body.items ?? []);
  const totalAmount = computeTotalAmount(items);
 
  let payedAmount = Number(body?.payedAmount ?? (existingSummary?.payedAmount ?? 0));
  if (!Number.isFinite(payedAmount) || payedAmount < 0) {
    badRequest('payedAmount must be zero or positive');
  }
  if (payedAmount > totalAmount) {
    badRequest('payedAmount cannot exceed total amount');
  }
 
  let dueDate = body?.dueDate ?? existingSummary?.dueDate ?? null;
  if (dueDate && Number.isNaN(Date.parse(dueDate))) {
    badRequest('dueDate must be an ISO datetime string');
  }
 
  const createdAt = existingSummary?.createdAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const expiresAt = computeExpiresAt();
 
  let previousItems = [];
  if (existingSummary) {
    previousItems = await listBillItems(billId);
  }
 
  const enrichedItems = items.map((item) => ({ ...item, createdAt: updatedAt }));
 
  try {
    if (existingSummary) {
      await deleteExistingBillItems(billId, previousItems);
    }
    await writeBillItems(billId, customerId, enrichedItems, updatedAt, expiresAt);
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `CUSTOMER#${customerId}`,
          sk: `BILL#${billId}`,
          billId,
          customerId,
          totalAmount,
          payedAmount,
          dueDate,
          createdAt,
          updatedAt,
          gsi1pk: `BILL#${billId}`,
          gsi1sk: 'SUMMARY',
          expiresAt,
          entityType: 'BILL'
        }
      })
    );
  } catch (error) {
    if (existingSummary) {
      await deleteExistingBillItems(billId).catch(() => {});
      await docClient
        .send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: existingSummary
          })
        )
        .catch(() => {});
      if (previousItems.length) {
        const restoreRequests = previousItems.map((item) => ({ PutRequest: { Item: item } }));
        const chunks = chunkArray(restoreRequests, 25);
        for (const chunk of chunks) {
          await docClient
            .send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: chunk } }))
            .catch(() => {});
        }
      }
    } else {
      await deleteExistingBillItems(billId).catch(() => {});
      await docClient
        .send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { pk: `CUSTOMER#${customerId}`, sk: `BILL#${billId}` }
          })
        )
        .catch(() => {});
    }
    throw error;
  }
 
  return buildResponse(existingSummary ? 200 : 201, {
    bill: {
      billId,
      customerId,
      totalAmount,
      payedAmount,
      dueDate,
      createdAt,
      updatedAt
    },
    items: enrichedItems.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      service: item.service,
      createdAt: item.createdAt
    }))
  });
});

addRoute('GET', '/bills/{billId}', async (event) => {
  await requireAuth(event);
  const billId = event.pathParameters?.billId;
  if (!billId) {
    return buildResponse(400, { message: 'billId path parameter is required' });
  }
  const summary = await getBillSummary(billId);
  const items = await listBillItems(billId);
  return buildResponse(200, {
    bill: {
      billId,
      customerId: summary.customerId,
      totalAmount: summary.totalAmount ?? 0,
      payedAmount: summary.payedAmount ?? 0,
      dueDate: summary.dueDate ?? null,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt
    },
    items: items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit,
      service: item.service,
      createdAt: item.createdAt
    }))
  });
});

addRoute('DELETE', '/bills/{billId}', async (event) => {
  await requireAuth(event);
  const billId = event.pathParameters?.billId;
  if (!billId) {
    return buildResponse(400, { message: 'billId path parameter is required' });
  }
  const summary = await getBillSummary(billId);
  const customerId = summary.customerId;

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CUSTOMER#${customerId}`, sk: `BILL#${billId}` }
    })
  );

  await deleteAllBillItems(billId);

  return buildResponse(204);
});

addRoute('GET', '/bills/{billId}/pdf', async (event) => {
  await requireAuth(event);
  const billId = event.pathParameters?.billId;
  if (!billId) {
    return buildResponse(400, { message: 'billId path parameter is required' });
  }
  await getBillSummary(billId); // ensure bill exists
  return buildResponse(200, {
    message: 'PDF generation not yet implemented. Integrate wkhtmltopdf or another renderer.',
    billId
  });
});

export const handler = async (event) => {
  if ((event.httpMethod ?? '').toUpperCase() === 'OPTIONS') {
    return buildResponse(204);
  }
  try {
    return await dispatch(event);
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    return buildResponse(statusCode, {
      message: error.message ?? 'Internal server error'
    });
  }
};

