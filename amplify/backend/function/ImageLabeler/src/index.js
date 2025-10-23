const https = require("https");
const {
  RekognitionClient,
  DetectLabelsCommand,
} = require("@aws-sdk/client-rekognition");

const rekognition = new RekognitionClient({ region: "ap-southeast-2" });

function fetchImageBytesFromUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

exports.handler = async (event) => {
  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
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

    // Use provided params or sensible defaults
    const minConfidence = typeof body.minConfidence === "number" ? body.minConfidence : 55; // doc default
    const maxLabels = typeof body.maxLabels === "number" ? body.maxLabels : 100;
    const maxDominantColors =
      typeof body.maxDominantColors === "number" ? body.maxDominantColors : 5;

    // Build DetectLabels request with both GENERAL_LABELS and IMAGE_PROPERTIES when needed
    const params = {
      Image: { Bytes: imageBytes },
      // MinConfidence and MaxLabels only apply to GENERAL_LABELS,
      // but sending them here is fine as the API applies them to label detection.
      MinConfidence: minConfidence,
      MaxLabels: maxLabels,
      Features: ["GENERAL_LABELS", "IMAGE_PROPERTIES"],
      Settings: {
        ImageProperties: {
          MaxDominantColors: maxDominantColors,
        },
      },
    };

    const cmd = new DetectLabelsCommand(params);
    const rekogResponse = await rekognition.send(cmd);

    // rekogResponse contains: Labels (array), ImageProperties (object), LabelModelVersion, OrientationCorrection
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        Labels: rekogResponse.Labels || [],
        ImageProperties: rekogResponse.ImageProperties || null,
        LabelModelVersion: rekogResponse.LabelModelVersion || null,
        OrientationCorrection: rekogResponse.OrientationCorrection || null,
      }),
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