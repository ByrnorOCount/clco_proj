const AWS = require('aws-sdk');
const https = require('https');
const rekognition = new AWS.Rekognition();

function fetchImageBytesFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  try {
    // event.body might be stringified
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
    let imageBytes;

    if (body.imageBase64) {
      // expected: data URL or plain base64
      const b64 = body.imageBase64.includes(',') ? body.imageBase64.split(',')[1] : body.imageBase64;
      imageBytes = Buffer.from(b64, 'base64');
    } else if (body.imageUrl) {
      imageBytes = await fetchImageBytesFromUrl(body.imageUrl);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Provide imageUrl or imageBase64' }),
      };
    }

    const rekogResponse = await rekognition
      .detectLabels({
        Image: { Bytes: imageBytes },
        MaxLabels: 15,
        MinConfidence: 35,
      })
      .promise();

    // Normalize to an array of { name, confidence }
    const labels = (rekogResponse.Labels || []).map((l) => ({
      name: l.Name,
      confidence: l.Confidence,
    }));

    console.log('Detected labels:', labels);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ labels }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
