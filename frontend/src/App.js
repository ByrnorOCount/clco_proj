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

  async function handleAnalyze(e) {
    e && e.preventDefault();
    resetStateForNewRun();

    if (!imageUrl && !file && !preview) {
      setError("Provide an image URL or upload a file.");
      return;
    }

    setLoading(true);
    setProgressPct(10);

    try {
      let body;
      if (file || preview) {
        // send base64 string
        const b64 = preview || await toDataUrl(file);
        // b64 is like data:image/png;base64,AAA...
        body = { imageBase64: b64 };
      } else {
        body = { imageUrl: imageUrl };
      }

      setProgressPct(30);

      // Simulate progress improvements
      const controller = new AbortController();
      const signal = controller.signal;

      const resp = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      setProgressPct(65);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API error: ${resp.status} ${text}`);
      }

      const json = await resp.json();
      // handle both { labels: [...] } and raw arrays
      const got = json.labels || json.Labels || json || [];
      // Normalize
      const normalized = (Array.isArray(got) ? got : []).map((l) => {
        if (l.name) return l;
        if (l.Name) return { name: l.Name, confidence: l.Confidence };
        if (l.label) return { name: l.label, confidence: l.confidence };
        // unknown shape — try best guess
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
      }, 300);
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
        {loading ? <div className="loading-text">Analyzing… {progressPct}%</div> : <div className="idle-text">Ready</div>}
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
