const form = document.getElementById('videoForm');
const submitBtn = document.getElementById('submitBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const outputArea = document.getElementById('outputArea');
const scriptOutput = document.getElementById('scriptOutput');
const videoIdOutput = document.getElementById('videoIdOutput');
const statusBtn = document.getElementById('statusBtn');
const statusSpinner = document.getElementById('statusSpinner');
const finalLinkArea = document.getElementById('finalLinkArea');
const videoLink = document.getElementById('videoLink');

let currentVideoId = null;
let pollInterval = null;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Loading State
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    loadingSpinner.classList.remove('hidden');
    outputArea.classList.add('hidden');
    finalLinkArea.classList.add('hidden');
    clearInterval(pollInterval);

    const payload = {
        repName: document.getElementById('repName').value.trim(),
        customerName: document.getElementById('customerName').value.trim(),
        vehicle: document.getElementById('vehicle').value.trim(),
        scenario: document.getElementById('scenario').value
    };

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.ok) {
            alert("Error: " + data.error);
            return;
        }

        scriptOutput.textContent = `"${data.script}"`;
        videoIdOutput.textContent = data.video_id;
        currentVideoId = data.video_id;
        outputArea.classList.remove('hidden');

    } catch (error) {
        alert("Failed to generate video. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        loadingSpinner.classList.add('hidden');
    }
});

statusBtn.addEventListener('click', () => {
    if (!currentVideoId) return;
    
    statusBtn.disabled = true;
    statusSpinner.classList.remove('hidden');
    statusBtn.querySelector('span').textContent = 'Polling...';
    
    const startTime = Date.now();
    const maxDuration = 90000; // 90-second timeout
    
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/generate?video_id=${currentVideoId}`);
            const data = await res.json();
            
            if (data.ok && data.status === 'completed') {
                clearInterval(pollInterval);
                videoLink.href = data.video_url;
                finalLinkArea.classList.remove('hidden');
                resetStatusBtn();
            } else if (data.ok && data.status === 'failed') {
                clearInterval(pollInterval);
                alert("Video generation failed at HeyGen.");
                resetStatusBtn();
            }
            
            if (Date.now() - startTime > maxDuration) {
                clearInterval(pollInterval);
                alert("Status check timed out. The video is still processing.");
                resetStatusBtn();
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, 3000);
});

function resetStatusBtn() {
    statusBtn.disabled = false;
    statusSpinner.classList.add('hidden');
    statusBtn.querySelector('span').textContent = 'Check Status';
}
