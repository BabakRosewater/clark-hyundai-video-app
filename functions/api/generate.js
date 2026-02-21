export async function onRequestPost(context) {
    const { request, env } = context;
    
    const SCENARIO_PROMPTS = {
        "sold": "Role: Assistant to Babak Mohammadi, GM at Clark Hyundai. Task: Write a strict 35-word thank you script for purchasing.",
        "unsold_visit": "Role: Assistant to Babak Mohammadi, GM at Clark Hyundai. Task: Write a strict 35-word follow-up script for visiting.",
        "special_finance": "Role: Assistant to Babak Mohammadi, GM at Clark Hyundai. Task: Write a strict 35-word script congratulating the customer on their Big Sky Fresh Start special finance approval.",
        "service_followup": "Role: Assistant to Babak Mohammadi, GM at Clark Hyundai. Task: Write a strict 35-word script thanking them for using our service drive today."
    };

    try {
        const body = await request.json();
        const { repName, customerName, vehicle, scenario } = body;
        
        if (!repName || !customerName || !scenario || !SCENARIO_PROMPTS[scenario]) {
            return new Response(JSON.stringify({ ok: false, error: "Invalid input." }), { status: 400 });
        }

        const getGeminiScript = async (sysPrompt, userText) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${env.GEMINI_API_KEY}`;
            const payload = {
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [{ role: "user", parts: [{ text: userText }] }]
            };
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error(`Gemini API error`);
            const data = await res.json();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return rawText.replace(/^["']|["']$/g, '').trim(); 
        };

        const baseInstruction = SCENARIO_PROMPTS[scenario] + " Return ONLY the final script text (no JSON, no quotes, no extra commentary).";
        const userMessage = `Rep: ${repName}\nCustomer: ${customerName}\nVehicle: ${vehicle || "None"}\nScenario: ${scenario}`;
        
        // 1. Initial Script Generation
        let script = await getGeminiScript(baseInstruction, userMessage);
        
        // 2. Exact 35-Word Enforcement
        let wordCount = script.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount !== 35) {
            console.log(`Retry triggered. Word count was ${wordCount}.`); // Safe diagnostic log
            script = await getGeminiScript(
                baseInstruction, 
                userMessage + `\n\nYour previous draft was ${wordCount} words. Rewrite to EXACTLY 35 words. Return only the script.`
            );
        }

        // 3. HeyGen Video Rendering
        const heygenUrl = "https://api.heygen.com/v2/video/generate";
        const heygenPayload = {
            video_inputs: [{
                character: {
                    type: "avatar",
                    avatar_id: env.AVATAR_ID,
                    avatar_style: "normal"
                },
                voice: {
                    type: "text",
                    input_text: script,
                    voice_id: env.VOICE_ID
                }
            }],
            dimension: { width: 720, height: 1280 }
        };

        const heygenRes = await fetch(heygenUrl, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "x-api-key": env.HEYGEN_API_KEY
            },
            body: JSON.stringify(heygenPayload)
        });

        const heygenData = await heygenRes.json();
        if (heygenData.error) throw new Error(heygenData.error.message || "HeyGen failed.");

        return new Response(JSON.stringify({ 
            ok: true, 
            script: script, 
            video_id: heygenData.data?.video_id 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("Generate Route Error:", err.message);
        return new Response(JSON.stringify({ ok: false, error: "Internal Error" }), { status: 500 });
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;
    try {
        const url = new URL(request.url);
        const videoId = url.searchParams.get("video_id");
        
        if (!videoId) return new Response(JSON.stringify({ ok: false, error: "Missing video_id." }), { status: 400 });

        const heygenUrl = `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`;
        const res = await fetch(heygenUrl, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "x-api-key": env.HEYGEN_API_KEY
            }
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return new Response(JSON.stringify({ 
            ok: true, 
            status: data.data?.status, 
            video_url: data.data?.video_url || null
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("Status Error:", err.message);
        return new Response(JSON.stringify({ ok: false, error: "Failed to check status." }), { status: 500 });
    }
}
