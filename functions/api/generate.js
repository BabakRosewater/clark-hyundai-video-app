export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();

    // ==========================================
    // STEP 1: GENERATE SCRIPT (GEMINI)
    // ==========================================
    if (data.action === 'generate_script') {
      const systemInstruction = `You are Babak Mohammadi, General Manager at Clark Hyundai. 
      Task: Write a strictly 35-word customer follow-up script. 
      Tone: Highly conversational, warm, and natural. 
      Rules: Avoid abrupt questions. Use smooth, natural transitions with commas to allow the AI voice to take a 'breath' (e.g., 'So, I just wanted to ask...', 'Now, I'd love to know...', or 'Listen,'). Never include placeholders.`;

      const userPrompt = `Customer: ${data.customerName}. Vehicle: ${data.vehicle || 'None'}. Scenario: ${data.scenario}. Rep: ${data.repName}.`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemInstruction } },
          contents: [{ parts: [{ text: userPrompt }] }]
        })
      });

      const geminiData = await geminiResponse.json();
      let script = geminiData.candidates[0].content.parts[0].text.trim();
      script = script.replace(/^"|"$/g, ''); // Remove quotes

      return new Response(JSON.stringify({ ok: true, script: script }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // STEP 2: CREATE VIDEO (HEYGEN)
    // ==========================================
    if (data.action === 'generate_video') {
      // Use the exact script the user edited and passed back
      const finalScript = data.script;

      const heygenUrl = 'https://api.heygen.com/v2/video/generate';
      const heygenPayload = {
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: env.AVATAR_ID,
              avatar_style: "normal"
            },
            voice: {
              type: "text",
              input_text: finalScript,
              voice_id: env.VOICE_ID,
              speed: 1.0
            }
          }
        ],
        dimension: { width: 720, height: 1280 }
      };

      const heygenResponse = await fetch(heygenUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': env.HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(heygenPayload)
      });

      const heygenResult = await heygenResponse.json();
      
      if (heygenResult.error) {
        throw new Error(heygenResult.error.message || 'HeyGen API Error');
      }

      return new Response(JSON.stringify({ 
        ok: true, 
        video_id: heygenResult.data.video_id 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Keep your existing GET request code at the bottom of the file
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const videoId = url.searchParams.get('video_id');

  if (!videoId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing video_id" }), { status: 400 });
  }

  try {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      method: 'GET',
      headers: { 'X-Api-Key': env.HEYGEN_API_KEY }
    });

    const data = await response.json();
    return new Response(JSON.stringify({ ok: true, status: data.data.status, video_url: data.data.video_url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
}
