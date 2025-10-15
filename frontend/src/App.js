import React, { useState } from "react";
import "./App.css";

function App() {
  const [imageUrl, setImageUrl] = useState("");
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!imageUrl) return;

    setLoading(true);
    setError("");
    setLabels([]);

    try {
      const response = await fetch("https://y98g2010ni.execute-api.ap-southeast-2.amazonaws.com/dev/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      const data = await response.json();
      setLabels(data.Labels || []);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze image");
    }

    setLoading(false);
  };

  return (
    <div className="app">
      <h1>🧠 Image Label Analyzer</h1>
      <div className="input-section">
        <input
          type="text"
          placeholder="Enter image URL..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <button onClick={handleAnalyze} disabled={loading}>
          Analyze
        </button>
      </div>

      {imageUrl && (
        <div className="preview">
          <img src={imageUrl} alt="preview" />
        </div>
      )}

      {loading && <div className="loading">🔍 Analyzing image...</div>}
      {error && <div className="error">{error}</div>}

      <div className="labels-grid">
        {labels.map((label, i) => (
          <div
            key={i}
            className="label-card"
            style={{
              backgroundColor: `hsl(${(i * 50) % 360}, 70%, 60%)`,
            }}
          >
            <h3>{label.Name}</h3>
            <p>{label.Confidence.toFixed(2)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
