const SCENARIO_PROMPTS = {
  sold:
    'You are writing a warm post-purchase follow-up from Babak Mohammadi, GM at Clark Hyundai. Thank the customer, reinforce confidence in their vehicle choice, and invite questions. Keep tone friendly, concise, and conversational for video delivery.',
  unsold_visit:
    'You are writing a follow-up from Babak Mohammadi, GM at Clark Hyundai, to a customer who visited but did not purchase. Thank them for visiting, invite a return visit, and offer help finding the right fit. Keep tone welcoming and pressure-free.',
  special_finance:
    'You are writing a congratulatory follow-up from Babak Mohammadi, GM at Clark Hyundai, for a Big Sky Fresh Start Approval customer. Be encouraging, clear, and supportive. Emphasize next steps and confidence without making legal or financial guarantees.',
  service_followup:
    'You are writing a service follow-up from Babak Mohammadi, GM at Clark Hyundai. Thank the customer for servicing with the dealership, mention commitment to care, and invite feedback or future needs in a genuine, professional tone.'
};

const SCENARIO_LABELS = {
  sold: 'Sold',
  unsold_visit: 'Unsold Visit',
  special_finance: 'Big Sky Fresh Start Approval',
  service_followup: 'Service Follow-up'
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function extractGeminiText(result) {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts.map((part) => part?.text || '').join(' ').trim();
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function generateScript({ env, scenario, repName, customerName, vehicle }) {
  const baseInstruction = SCENARIO_PROMPTS[scenario];
  const scenarioLabel = SCENARIO_LABELS[scenario];

  const userText = [
    `Rep Name: ${repName}`,
    `Customer Name: ${customerName}`,
    `Vehicle: ${vehicle || 'Not provided'}`,
    `Scenario: ${scenarioLabel}`
  ].join('\n');

  async function requestGemini(userMessage, systemInstruction) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini request failed:', response.status, errorText.slice(0, 300));
      throw new Error('Failed to generate script with Gemini.');
    }

    const data = await response.json();
    const script = extractGeminiText(data);

    if (!script) {
      console.error('Gemini response missing text');
      throw new Error('Gemini returned an empty script.');
    }

    return script;
  }

  let script = await requestGemini(
    `${userText}\n\nReturn ONLY the final script text for a video. No JSON. No quotes.`,
    `${baseInstruction} The script must be exactly 35 words.`
  );

  if (wordCount(script) !== 35) {
    script = await requestGemini(
      `${script}\n\nRewrite to exactly 35 words. Return only the script.`,
      `${baseInstruction} The script must be exactly 35 words.`
    );
  }

  return script.trim();
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    if (!env.GEMINI_API_KEY || !env.HEYGEN_API_KEY || !env.AVATAR_ID || !env.VOICE_ID) {
      return jsonResponse({ ok: false, error: 'Server is missing required environment variables.' }, 500);
    }

    const body = await request.json().catch(() => null);
    const repName = String(body?.repName || '').trim();
    const customerName = String(body?.customerName || '').trim();
    const vehicle = String(body?.vehicle || '').trim();
    const scenario = String(body?.scenario || '').trim();

    if (!repName || !customerName || !scenario) {
      return jsonResponse({ ok: false, error: 'repName, customerName, and scenario are required.' }, 400);
    }

    if (!Object.hasOwn(SCENARIO_PROMPTS, scenario)) {
      return jsonResponse({ ok: false, error: 'Invalid scenario value.' }, 400);
    }

    const script = await generateScript({ env, scenario, repName, customerName, vehicle });

    const heygenRes = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': env.HEYGEN_API_KEY
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: env.AVATAR_ID,
              avatar_style: 'normal'
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: env.VOICE_ID
            }
          }
        ]
      })
    });

    if (!heygenRes.ok) {
      const errorText = await heygenRes.text();
      console.error('HeyGen generate failed:', heygenRes.status, errorText.slice(0, 300));
      throw new Error('Failed to start HeyGen video generation.');
    }

    const heygenData = await heygenRes.json();
    const videoId =
      heygenData?.data?.video_id ||
      heygenData?.video_id ||
      heygenData?.data?.id ||
      '';

    if (!videoId) {
      console.error('HeyGen response missing video_id');
      throw new Error('HeyGen did not return a video id.');
    }

    return jsonResponse({ ok: true, script, video_id: videoId });
  } catch (error) {
    console.error('POST /api/generate failed:', error.message);
    return jsonResponse({ ok: false, error: error.message || 'Unexpected server error.' }, 500);
  }
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;

    if (!env.HEYGEN_API_KEY) {
      return jsonResponse({ ok: false, error: 'Server is missing HEYGEN_API_KEY.' }, 500);
    }

    const url = new URL(request.url);
    const videoId = url.searchParams.get('video_id')?.trim();

    if (!videoId) {
      return jsonResponse({ ok: false, error: 'video_id is required.' }, 400);
    }

    const statusRes = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': env.HEYGEN_API_KEY
        }
      }
    );

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      console.error('HeyGen status failed:', statusRes.status, errorText.slice(0, 300));
      throw new Error('Failed to fetch HeyGen video status.');
    }

    const statusData = await statusRes.json();
    const status = statusData?.data?.status || statusData?.status || 'unknown';
    const videoUrl = statusData?.data?.video_url || statusData?.video_url;

    const payload = { ok: true, status };
    if (videoUrl) {
      payload.video_url = videoUrl;
    }

    return jsonResponse(payload);
  } catch (error) {
    console.error('GET /api/generate failed:', error.message);
    return jsonResponse({ ok: false, error: error.message || 'Unexpected server error.' }, 500);
  }
}
