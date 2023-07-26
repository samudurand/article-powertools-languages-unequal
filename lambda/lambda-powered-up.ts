
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';
import { makeIdempotent, IdempotencyConfig } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { ApiGatewayProxyEvent, ApiGatewayProxyResult  } from 'aws-lambda';
import middy from '@middy/core';

const { S3 } = require('aws-sdk');
const s3 = new S3();

// Powertools logger
const logger = new Logger({ 
  serviceName: 's3Uploader', // Especially useful if you use multiple Lambda functions to compose a service
  logLevel: 'INFO',
});

// Powertools Idempotency configuration

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME ||  'tableNotFoundInEnv'
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'body',
});

// Main function

async function lambdaHandler (event: ApiGatewayProxyEvent): Promise<ApiGatewayProxyResult> {
  try {
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('Bucket name not provided. Make sure the environment variable BUCKET_NAME is set.');
    }

    const requestBody = JSON.parse(event.body);
    const message = requestBody.message;

    // Get the current date and time in ISO string format
    const currentDate = new Date();
    const isoStringDate = currentDate.toISOString();

    // Use the ISO string as the key for the S3 object
    const params = {
      Bucket: bucketName,
      Key: `powered-up-${isoStringDate}.txt`,
      Body: message,
    };
    await s3.putObject(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `File uploaded successfully with content: '${message}'` }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error uploading file to S3: ' + error.message }),
    };
  }
};

// Apply the idempotency middleware
export const handler = makeIdempotent(
  // Injecting Lambda context in the handler, to be used in the logs
  middy(lambdaHandler)
    .use(injectLambdaContext(logger, { logEvent: true })), 
    { persistenceStore, config: idempotencyConfig }
);

