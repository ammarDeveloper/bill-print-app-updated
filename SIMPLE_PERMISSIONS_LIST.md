# Simple Permissions List

## AWS Managed Policies (If Available)

1. **CloudFormationFullAccess**
2. **AmazonS3FullAccess**
3. **AWSLambda_FullAccess**
4. **AmazonAPIGatewayAdministrator**
5. **AmazonDynamoDBFullAccess**
6. **CloudFrontFullAccess** (or create custom with specific actions)
7. **IAMFullAccess** (or create custom with limited actions)

---

## OR Create Custom Inline Policies with These Service Names:

1. **CloudFormation** - `cloudformation:*`
2. **S3** - `s3:*`
3. **Lambda** - `lambda:*`
4. **API Gateway** - `apigateway:*`
5. **DynamoDB** - `dynamodb:*`
6. **CloudFront** - (16 specific actions - see COMPLETE_IAM_SETUP_GUIDE.md)
7. **IAM** - (19 specific actions - see COMPLETE_IAM_SETUP_GUIDE.md)

---

**That's it. 7 policies total.**

