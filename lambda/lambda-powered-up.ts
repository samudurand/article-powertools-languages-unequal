
const { S3 } = require('aws-sdk');
const s3 = new S3();

interface RequestEvent {
  body: string;
}

interface Response {
  statusCode: number;
  body: string;
}

export async function handler(event: RequestEvent): Promise<Response> {
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
      Key: `${isoStringDate}.txt`,
      Body: message,
    };

    await s3.putObject(params).promise();

    // Print file uploaded successfully with the content of the message
    console.log(`File uploaded successfully with content: '${message}'`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'File uploaded successfully!' }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error uploading file to S3: ' + error.message }),
    };
  }
}
