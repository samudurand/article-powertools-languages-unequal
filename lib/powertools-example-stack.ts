import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';

export class PowertoolsExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3Bucket = new s3.Bucket(this, 'S3Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Idempotency

    const idempotencyTable = new dynamodb.Table(this, 'IdempotencyTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiration',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambdas

    const s3Lambda = new lambdaNode.NodejsFunction(this, 'S3Lambda', {
      entry: 'lambda/lambda.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        BUCKET_NAME: s3Bucket.bucketName,
      },
    });

    const s3LambdaPoweredUp = new lambdaNode.NodejsFunction(this, 'S3LambdaPoweredUp', {
      entry: 'lambda/lambda-powered-up.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_16_X,
      environment: {
        BUCKET_NAME: s3Bucket.bucketName,
        IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName
      },
    });

    s3Bucket.grantPut(s3Lambda);
    s3Bucket.grantPut(s3LambdaPoweredUp);
    idempotencyTable.grantReadWriteData(s3LambdaPoweredUp);

    // API Gateway

    const s3StoringApi = new apigw.RestApi(this, 'S3StoringApi', {
      restApiName: 'S3 Storing Api',
    });

    // Basic Lambda API endpoint
    const resource1 = s3StoringApi.root.addResource('upload');
    const lambdaIntegration = new apigw.LambdaIntegration(s3Lambda);
    resource1.addMethod('POST', lambdaIntegration);

    // Powered up Lambda API endpoint
    const resource2 = s3StoringApi.root.addResource('upload-powered-up');
    const poweredUpLambdaIntegration = new apigw.LambdaIntegration(s3LambdaPoweredUp);
    resource2.addMethod('POST', poweredUpLambdaIntegration);

    // Outputs

    new cdk.CfnOutput(this, 'ApiGatewayEndpoint', {
      value: s3StoringApi.url,
    });

  }
}
