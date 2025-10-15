import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import https from "https";

const rekognition = new RekognitionClient({ region: "ap-southeast-2" });

function fetchImageBytesFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

export const handler = async (event) => {
  try {
    // Parse body (if stringified)
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
    let imageBytes;

    if (body.imageBase64) {
      const b64 = body.imageBase64.includes(",")
        ? body.imageBase64.split(",")[1]
        : body.imageBase64;
      imageBytes = Buffer.from(b64, "base64");
    } else if (body.imageUrl) {
      imageBytes = await fetchImageBytesFromUrl(body.imageUrl);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Provide imageUrl or imageBase64" }),
      };
    }

    // Call Rekognition using AWS SDK v3 style
    const command = new DetectLabelsCommand({
      Image: { Bytes: imageBytes },
      MaxLabels: 15,
      MinConfidence: 35,
    });

    const rekogResponse = await rekognition.send(command);

    // Normalize to array of { name, confidence }
    const labels = (rekogResponse.Labels || []).map((l) => ({
      name: l.Name,
      confidence: l.Confidence,
    }));

    console.log("Detected labels:", labels);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ labels }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
