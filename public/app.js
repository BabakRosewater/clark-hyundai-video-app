import React, { useState } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  Video,
  AlertTriangle
} from 'https://esm.sh/lucide-react@0.469.0';

const html = htm.bind(React.createElement);

const SCENARIO_OPTIONS = [
  { value: 'sold', label: 'Sold' },
  { value: 'unsold_visit', label: 'Unsold Visit' },
  { value: 'special_finance', label: 'Big Sky Fresh Start Approval' },
  { value: 'service_followup', label: 'Service Follow-up' }
];

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function MasterHubFrame({ children }) {
  return html`
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-slate-950 text-slate-100">
      <header className="border-b border-blue-900/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-4">
          <div className="rounded-lg bg-blue-600/20 p-2 text-blue-300">
            <${Building2} size=${20} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-blue-200">Clark Hyundai</p>
            <h1 className="text-xl font-bold">Video Follow-up Hub</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 py-8">${children}</main>
    </div>
  `;
}

function FollowUpCard() {
  const [form, setForm] = useState({
    repName: '',
    customerName: '',
    vehicle: '',
    scenario: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setStatusText('');

    try {
      setLoading(true);
      const data = await fetchJson('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repName: form.repName.trim(),
          customerName: form.customerName.trim(),
          vehicle: form.vehicle.trim(),
          scenario: form.scenario
        })
      });

      setResult({ script: data.script, video_id: data.video_id, video_url: '' });
    } catch (submitError) {
      setError(submitError.message || 'Unable to generate video.');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!result?.video_id) {
      return;
    }

    setError('');
    setStatusBusy(true);
    setStatusText('Checking status...');

    const startedAt = Date.now();
    const timeoutMs = 90_000;

    try {
      while (Date.now() - startedAt < timeoutMs) {
        const data = await fetchJson(`/api/generate?video_id=${encodeURIComponent(result.video_id)}`);
        const status = data.status || 'unknown';
        setStatusText(`Status: ${status}`);

        if (status === 'completed' && data.video_url) {
          setResult((prev) => ({ ...prev, video_url: data.video_url }));
          setStatusText('Status: completed');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      setStatusText('Timed out after 90 seconds. Please check again.');
    } catch (statusError) {
      setError(statusError.message || 'Unable to check status.');
    } finally {
      setStatusBusy(false);
    }
  };

  return html`
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-blue-900/80 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/40">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-blue-500/20 p-2 text-blue-300"><${Video} size=${20} /></div>
        <div>
          <h2 className="text-lg font-semibold">Generate GM Follow-up Video</h2>
          <p className="text-sm text-slate-300">Create a personalized script and HeyGen avatar video.</p>
        </div>
      </div>

      <form onSubmit=${onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-300">Rep Name</span>
            <input className="w-full rounded-lg border border-blue-900 bg-slate-950 px-3 py-2" name="repName" required value=${form.repName} onChange=${onChange} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-300">Customer Name</span>
            <input className="w-full rounded-lg border border-blue-900 bg-slate-950 px-3 py-2" name="customerName" required value=${form.customerName} onChange=${onChange} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-300">Vehicle (optional)</span>
            <input className="w-full rounded-lg border border-blue-900 bg-slate-950 px-3 py-2" name="vehicle" value=${form.vehicle} onChange=${onChange} placeholder="2024 Hyundai Tucson" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-300">Scenario</span>
            <select className="w-full rounded-lg border border-blue-900 bg-slate-950 px-3 py-2" name="scenario" required value=${form.scenario} onChange=${onChange}>
              <option value="">Select one</option>
              ${SCENARIO_OPTIONS.map(
                (option) => html`<option key=${option.value} value=${option.value}>${option.label}</option>`
              )}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled=${loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          ${loading ? html`<${LoaderCircle} className="animate-spin" size=${18} />` : html`<${Video} size=${18} />`}
          ${loading ? 'Generating...' : 'Generate Video'}
        </button>
      </form>

      ${error
        ? html`<div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-700/70 bg-rose-950/60 p-3 text-sm text-rose-200"><${AlertTriangle} size=${16} />${error}</div>`
        : null}

      ${result
        ? html`
            <div className="mt-6 space-y-4 rounded-xl border border-blue-900/80 bg-slate-950/60 p-4">
              <div>
                <h3 className="text-sm font-semibold text-blue-200">Generated Script</h3>
                <p className="mt-1 text-sm text-slate-200">${result.script}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-200">Video ID</h3>
                <p className="mt-1 font-mono text-xs text-slate-300">${result.video_id}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick=${checkStatus}
                  disabled=${statusBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  ${statusBusy ? html`<${LoaderCircle} className="animate-spin" size=${18} />` : html`<${CheckCircle2} size=${18} />`}
                  Check Status
                </button>
                <span className="text-sm text-slate-300">${statusText}</span>
              </div>

              ${result.video_url
                ? html`<p className="text-sm">Video URL: <a href=${result.video_url} className="text-blue-300 underline" target="_blank" rel="noopener noreferrer">${result.video_url}</a></p>`
                : null}
            </div>
          `
        : null}
    </section>
  `;
}

function App() {
  return html`
    <${MasterHubFrame}>
      <div className="flex min-h-[70vh] w-full items-center justify-center">
        <${FollowUpCard} />
      </div>
    </${MasterHubFrame}>
  `;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
