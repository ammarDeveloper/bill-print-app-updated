# Serverless API Stack

This folder contains the AWS SAM (Serverless Application Model) project that will
back the React client. It provisions:

- API Gateway REST API with CORS enabled
- Lambda function (Node.js 18) that implements all billing endpoints
- Single-table DynamoDB design (partition key `pk`, sort key `sk`) for customers,
  bills and items

## Layout

```
backend-sam/
├── README.md
├── template.yaml        # CloudFormation/SAM template
├── package.json         # Lambda Node.js dependencies (installed via npm)
├── local-runner.js      # Helper script to invoke the handler locally
└── src/
    └── index.js         # Lambda handler with routed endpoints
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build and deploy:
   ```bash
   sam validate
   sam build
   sam deploy \
            --stack-name bill-printing-stack \
            --region ap-south-1 \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --no-confirm-changeset \
            --resolve-s3
   ```

## To delete stack
```
sam delete --stack-name bill-printing-stack --region ap-south-1
```

During the guided deploy you can pick the AWS region, stack name and bucket.
The template surfaces parameters for table name and stage name.

### Local Invocation

You can exercise the handler without deploying by using the helper script:

```bash
# default call -> GET /session
npm run invoke

# specify method, resource and body inline
npm run invoke -- \
  --method=POST \
  --resource=/customers/{customerId}/bills \
  --pathParameters='{"customerId":"<uuid>"}' \
  --body='{"items":[{"name":"Shirt","quantity":2,"pricePerUnit":50}],"payedAmount":0}'

# provide path parameters and body from file
npm run invoke -- \
  --method=PUT \
  --resource=/bills/{billId} \
  --pathParameters='{"billId":"<uuid>"}' \
  --bodyFile=./payloads/upsert-bill.json
```

The script builds a mock API Gateway proxy event and prints the Lambda
response. Ensure `TABLE_NAME`, `LOGIN_USERNAME`, and `LOGIN_PASSWORD` env vars
are set if you need non-default values. For DynamoDB access, either run against
AWS (default credentials chain) or point the SDK to a local emulator by setting
`AWS_ENDPOINT_URL_DYNAMODB` before invoking.

## Next Steps

1. Replace the stub logic inside `src/index.js` with real handlers that read/write
   DynamoDB and enforce authentication. *(Already partially implemented.)*
2. Add unit tests under `tests/` (not created yet) and wire in `sam local start-api`
   during development.
3. Integrate the deployed endpoints with the React app. Update Vite’s proxy
   configuration or environment variables with the API Gateway invoke URL.

Refer to the SAM documentation for more advanced features:
https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html

