import React, { useState } from "react";
import "./App.css";

const API_ENDPOINT = "https://b1dph4kf0a.execute-api.ap-southeast-2.amazonaws.com/dev/label";

function percentToColor(pct) {
  // Maps a percentage to a color in the HSL color space.
  // 0% is red (hue 0), 50% is yellow (hue 60), 100% is green (hue 120).
  const hue = (pct / 100) * 120;
  return `hsl(${hue}, 90%, 45%)`;
}

export default function App() {
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [labels, setLabels] = useState([]);
  const [imageProps, setImageProps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [maxLabels, setMaxLabels] = useState(100);
  const [maxDominantColors, setMaxDominantColors] = useState(5);
  const [expanded, setExpanded] = useState({ labels: false, props: false });
  const [tooltip, setTooltip] = useState(null);

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
    setImageProps(null);
    setError("");
    setProgressPct(0);
  }

  function uploadWithProgress(url, body, { setProgress, progressStart, progressEnd }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");

      // Track upload progress within the given range
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = progressStart + (e.loaded / e.total) * (progressEnd - progressStart);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(progressEnd);
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

  // Utility to add a small delay
  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // Simulates smooth progress for non-upload stages
  const simulateProgress = async (start, end, duration, onProgress) => {
    const stepTime = 16; // ~60fps
    const steps = Math.max(1, Math.floor(duration / stepTime));
    const increment = (end - start) / steps;
    let currentProgress = start;

    for (let i = 0; i < steps; i++) {
      currentProgress += increment;
      onProgress(Math.min(currentProgress, end));
      await wait(stepTime);
    }
  };

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
      let uploadStartPct = 5;
      if (file || preview) {
        await simulateProgress(5, 10, 100, setProgressPct);
        const b64 = preview || await toDataUrl(file);
        await simulateProgress(10, 20, 100, setProgressPct);
        body = { 
          imageBase64: b64, 
          minConfidence, 
          maxLabels, 
          maxDominantColors
        };
        await wait(100); uploadStartPct = 20;
      } else {
        body = { 
          imageUrl: imageUrl, 
          minConfidence, 
          maxLabels, 
          maxDominantColors
        };
      }

      // Upload contributes to progress from its start point up to 80%
      const json = await uploadWithProgress(
        API_ENDPOINT, 
        JSON.stringify(body), 
        { setProgress: setProgressPct, progressStart: uploadStartPct, progressEnd: 80 }
      );

      await simulateProgress(80, 95, 500, setProgressPct); // "Analyzing..."

      const gotLabels = json.Labels || [];
      const gotProps = json.ImageProperties || null;

      setLabels(Array.isArray(gotLabels) ? gotLabels : []);
      setImageProps(gotProps);
      await simulateProgress(95, 100, 200, setProgressPct); // "Finalizing..."
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

  function renderImageProperties(props) {
    if (!props) return null;
    return (
      <div className="properties-container">
        {props.DominantColors && (
          <>
            <h3>Dominant Colors</h3>
            <div className="colors-grid">
              {props.DominantColors.map((color, i) => (
                <div key={i} className="color-card">
                  <div
                    className="color-swatch"
                    style={{ backgroundColor: color.CSSColor }}
                  />
                  <div className="color-info">
                    <b>{color.CSSColor}</b>
                    <span>{color.HexCode}</span>
                    <span>{color.PixelPercent.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {props.Quality && (
          <>
            <h3>Image Quality</h3>
            <div className="quality-grid">
              <div className="quality-item">
                <span>Brightness: </span>
                <span>{props.Quality.Brightness.toFixed(1)}</span>
              </div>
              <div className="quality-item">
                <span>Sharpness: </span>
                <span>{props.Quality.Sharpness.toFixed(1)}</span>
              </div>
              <div className="quality-item">
                <span>Contrast: </span>
                <span>{props.Quality.Contrast.toFixed(1)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <h1>🧪 Rekognition Image Analyzer</h1>

      <form onSubmit={handleAnalyze} className="controls">
        <div className="input-row">
          <input
            className="url-input"
            placeholder="Enter image URL..."
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setPreview("");
              setFile(null);
            }}
            disabled={loading}
          />
          <button className="btn" type="submit" disabled={loading}>
            Analyze
          </button>
        </div>

        <div className="or-row">— or upload an image —</div>

        <div className="upload-row">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>

        <div className="slider-row">
          <label>Min Confidence: {minConfidence}%</label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={minConfidence}
            onChange={(e) => setMinConfidence(+e.target.value)}
          />
          <label>Max Labels: {maxLabels}</label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={maxLabels}
            onChange={(e) => setMaxLabels(+e.target.value)}
          />
          <label>Max Dominant Colors: {maxDominantColors}</label>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={maxDominantColors}
            onChange={(e) => setMaxDominantColors(+e.target.value)}
          />
        </div>
      </form>

      <div className="preview-wrap">
        {(preview || imageUrl) ? (
          <div className="image-overlay-wrap">
            <img
              src={preview || imageUrl}
              alt="preview"
              className="preview-img"
            />
            {labels
              .filter((l) => l.Instances && l.Instances.length)
              .map((l, i) =>
                l.Instances.map((inst, j) => (
                  <div
                    key={`${i}-${j}`}
                    className="bbox"                    
                    style={{
                      left: `${inst.BoundingBox.Left * 100}%`,
                      top: `${inst.BoundingBox.Top * 100}%`,
                      width: `${inst.BoundingBox.Width * 100}%`,
                      height: `${inst.BoundingBox.Height * 100}%`,
                      borderColor: percentToColor(l.Confidence),
                    }}
                    onMouseEnter={(e) => {
                      // Get the parent container's position
                      const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
                      // Calculate cursor position relative to the parent container
                      const left = e.clientX - parentRect.left + 12; // a bit right of the cursor
                      const top = e.clientY - parentRect.top - 28;  // above the cursor
                      setTooltip({
                        x: left,
                        y: top,
                        label: l,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))
              )}
            {tooltip && (
              <div className="bbox-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
                <b>{tooltip.label.Name}</b> ({tooltip.label.Confidence.toFixed(1)}%)<br/>
                <i>{tooltip.label.Categories?.map(c => c.Name).join(', ')}</i>
              </div>
            )}
          </div>
        ) : (
          <div className="preview-placeholder">Image preview</div>
        )}
      </div>

      <div className="status-row">
        <div className="progress-bar-outer" aria-hidden>
          <div
            className="progress-bar-inner"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {loading ? (
          <div className="loading-text">
            {progressPct < 10 && "Initializing…"}
            {progressPct >= 10 && progressPct < 25 && "Preparing image…"}
            {progressPct >= 25 && progressPct < 80 && "Uploading to API…"}
            {progressPct >= 80 && progressPct < 95 && "Analyzing with AWS Rekognition…"}
            {progressPct >= 95 && progressPct < 100 && "Finalizing results…"}
            <span> ({Math.round(progressPct)}%)</span>
          </div>
        ) : (
          <div className="idle-text">Ready</div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {/* Collapsible - Full Label Info */}
      <div className="collapsible">
        <div
          className="collapsible-header"
          onClick={() => setExpanded((p) => ({ ...p, labels: !p.labels }))}
        >
          <span>Detected Labels (Full Info)</span>
          <span className={`arrow ${expanded.labels ? "open" : ""}`}>▶</span>
        </div>
        {expanded.labels && (
          <div className="collapsible-content">
            {labels.map((l, i) => (
              <div key={i} className="label-detail">
                <b>{l.Name}</b> – {l.Confidence?.toFixed(2)}%
                {l.Parents?.length > 0 && (
                  <div>Parents: {l.Parents.map((p) => p.Name).join(", ")}</div>
                )}
                {l.Categories?.length > 0 && (
                  <div>Categories: {l.Categories.map((c) => c.Name).join(", ")}</div>
                )}
                {l.Aliases?.length > 0 && (
                  <div>Aliases: {l.Aliases.map((a) => a.Name).join(", ")}</div>
                )}
                {l.Instances?.length > 0 && (
                  <div>Instances: {l.Instances.length} (with bounding boxes)</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible - Image Properties */}
      <div className="collapsible">
        <div
          className="collapsible-header"
          onClick={() => setExpanded((p) => ({ ...p, props: !p.props }))}
        >
          <span>Image Properties</span>
          <span className={`arrow ${expanded.props ? "open" : ""}`}>▶</span>
        </div>
        {expanded.props && imageProps && (
          <div className="collapsible-content">{renderImageProperties(imageProps)}</div>
        )}
      </div>

      {/* Simple Label Cards */}
      <div className="labels-grid">
        {labels.length === 0 && !loading && (
          <div className="hint">No labels yet — run an analysis.</div>
        )}
        {labels.map((l, i) => {
          const pct = Math.round((l.Confidence || 0) * 100) / 100;
          const bg = percentToColor(pct);
          return (
            <div
              className="label-card"
              key={i}
              style={{ borderTop: `6px solid ${bg}` }}
            >
              <div className="label-name">{l.Name}</div>
              {l.Categories && l.Categories.length > 0 && (
                <div className="label-category">{l.Categories.map(c => c.Name).join(', ')}</div>
              )}
              <div className="label-confidence">{pct}%</div>
              <div className="confidence-bar-outer">
                <div
                  className="confidence-bar-inner"
                  style={{ width: `${pct}%`, background: bg }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}