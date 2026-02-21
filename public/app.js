const form = document.getElementById('videoForm');
const submitBtn = document.getElementById('submitBtn');
const spinner = document.getElementById('spinner');
const output = document.getElementById('output');
const errorBox = document.getElementById('errorBox');
const scriptText = document.getElementById('scriptText');
const videoIdEl = document.getElementById('videoId');
const statusBtn = document.getElementById('statusBtn');
const statusText = document.getElementById('statusText');
const videoLinkWrap = document.getElementById('videoLinkWrap');
const videoLink = document.getElementById('videoLink');

let activeVideoId = '';

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  spinner.classList.toggle('hidden', !isLoading);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  output.classList.add('hidden');
  statusText.textContent = '';
  videoLinkWrap.classList.add('hidden');

  const formData = new FormData(form);
  const payload = {
    repName: String(formData.get('repName') || '').trim(),
    customerName: String(formData.get('customerName') || '').trim(),
    vehicle: String(formData.get('vehicle') || '').trim(),
    scenario: String(formData.get('scenario') || '').trim()
  };

  try {
    setLoading(true);

    const data = await fetchJson('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    activeVideoId = data.video_id;
    scriptText.textContent = data.script;
    videoIdEl.textContent = data.video_id;
    output.classList.remove('hidden');
  } catch (error) {
    showError(error.message || 'Unable to generate video.');
  } finally {
    setLoading(false);
  }
});

statusBtn.addEventListener('click', async () => {
  clearError();

  if (!activeVideoId) {
    showError('Generate a video first.');
    return;
  }

  statusBtn.disabled = true;
  statusText.textContent = 'Checking status...';

  const startedAt = Date.now();
  const timeoutMs = 90_000;

  try {
    while (Date.now() - startedAt < timeoutMs) {
      const data = await fetchJson(`/api/generate?video_id=${encodeURIComponent(activeVideoId)}`);
      const currentStatus = data.status || 'unknown';
      statusText.textContent = `Status: ${currentStatus}`;

      if (currentStatus === 'completed' && data.video_url) {
        videoLink.href = data.video_url;
        videoLink.textContent = data.video_url;
        videoLinkWrap.classList.remove('hidden');
        statusText.textContent = 'Status: completed';
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    statusText.textContent = 'Timed out after 90 seconds. Please check again.';
  } catch (error) {
    showError(error.message || 'Unable to check status.');
  } finally {
    statusBtn.disabled = false;
  }
});
