import React, { useState } from "react";
import "./App.css";

const API_ENDPOINT = "https://b1dph4kf0a.execute-api.ap-southeast-2.amazonaws.com/dev/label";

function percentToColor(pct) {
  // 0 -> red, 50 -> orange, 100 -> green
  const hue = (pct * 1.2); // 0..120
  return `hsl(${hue}, 75%, 45%)`;
}

export default function App() {
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setImageUrl("");
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  }

  function resetStateForNewRun() {
    setLabels([]);
    setError("");
    setProgressPct(0);
  }

  function uploadWithProgress(url, body, setProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");

      // Track upload progress (0–60%)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = (e.loaded / e.total) * 60; // 0–60%
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(85);
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`API error ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Request timed out"));

      xhr.send(body);
    });
  }

  async function handleAnalyze(e) {
    e && e.preventDefault();
    resetStateForNewRun();

    if (!imageUrl && !file && !preview) {
      setError("Provide an image URL or upload a file.");
      return;
    }

    setLoading(true);
    setProgressPct(5);

    try {
      let body;
      if (file || preview) {
        setProgressPct(10);
        const b64 = preview || await toDataUrl(file);
        setProgressPct(20);
        body = { imageBase64: b64 };
      } else {
        body = { imageUrl: imageUrl };
      }

      // Real upload progress
      const json = await uploadWithProgress(API_ENDPOINT, JSON.stringify(body), setProgressPct);

      // Handle both { labels: [...] } and raw arrays
      const got = json.labels || json.Labels || json || [];
      const normalized = (Array.isArray(got) ? got : []).map((l) => {
        if (l.name) return l;
        if (l.Name) return { name: l.Name, confidence: l.Confidence };
        if (l.label) return { name: l.label, confidence: l.confidence };
        const keys = Object.keys(l);
        return { name: l.Name || l.name || keys[0], confidence: l.Confidence || l.confidence || 0 };
      });

      setProgressPct(95);
      setLabels(normalized);
      setProgressPct(100);
    } catch (err) {
      console.error(err);
      setError(err.message || "Analysis failed");
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 400);
    }
  }

  function toDataUrl(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="app">
      <h1>🧪 Live Image Label Analyzer</h1>

      <form onSubmit={handleAnalyze} className="controls">
        <div className="input-row">
          <input
            className="url-input"
            placeholder="Enter image URL..."
            value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setPreview(""); setFile(null); }}
            disabled={loading}
          />
          <button className="btn" type="submit" disabled={loading}>Analyze</button>
        </div>

        <div className="or-row">— or upload an image —</div>

        <div className="upload-row">
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={loading} />
        </div>
      </form>

      <div className="preview-wrap">
        {preview ? <img src={preview} alt="preview" className="preview-img" /> : imageUrl ? <img src={imageUrl} alt="preview" className="preview-img" /> : (
          <div className="preview-placeholder">Image preview</div>
        )}
      </div>

      <div className="status-row">
        <div className="progress-bar-outer" aria-hidden>
          <div className="progress-bar-inner" style={{ width: `${progressPct}%` }} />
        </div>

        {loading ? (
          <div className="loading-text">
            {progressPct < 10 && "Initializing…"}
            {progressPct >= 10 && progressPct < 25 && "Preparing image…"}
            {progressPct >= 25 && progressPct < 60 && "Uploading to API…"}
            {progressPct >= 60 && progressPct < 85 && "Analyzing with AWS Rekognition…"}
            {progressPct >= 85 && progressPct < 100 && "Finalizing results…"}
            <span> ({Math.round(progressPct)}%)</span>
          </div>
        ) : (
          <div className="idle-text">Ready</div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="labels-grid">
        {labels.length === 0 && !loading && <div className="hint">No labels yet — run an analysis.</div>}
        {labels.map((l, i) => {
          const pct = Math.round((l.confidence || 0) * 100) / 100;
          const bg = percentToColor(pct);
          return (
            <div className="label-card" key={i} style={{ borderTop: `6px solid ${bg}` }}>
              <div className="label-name">{l.name}</div>
              <div className="label-confidence">{pct}%</div>
              <div className="confidence-bar-outer">
                <div className="confidence-bar-inner" style={{ width: `${pct}%`, background: bg }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
