// app/api/ai/autoplay/route.ts
// AI-powered genre expansion for autoplay

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    }

    const { genre } = await req.json() as { genre?: string }
    if (!genre) {
      return NextResponse.json({ error: "No genre provided" }, { status: 400 })
    }

    console.info(`[AI Autoplay] Expanding genre: ${genre}`)

    const systemPrompt = `You are a music discovery expert. You respond ONLY with a raw JSON array of 3-4 music artists or specific sub-genres related to the input genre. No explanation.`

    const userPrompt = `The user is listening to: ${genre}. 
Suggest 3-4 specific artists or sub-genres that sound exactly like this or complement it perfectly. 
Return ONLY a raw JSON array of strings. 
Example: ["Artist One", "Subgenre Two", "Artist Three"]`

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 128,
      }),
    })

    if (!groqRes.ok) {
        const errText = await groqRes.text()
        console.error("[AI Autoplay] Groq error:", errText)
        return NextResponse.json({ error: "Groq failed" }, { status: 500 })
    }

    const groqData = (await groqRes.json()) as {
      choices: Array<{
        message: {
          content: string
        }
      }>
    }
    console.info("[AI Autoplay] Groq Response Object:", JSON.stringify(groqData, null, 2))

    const text = groqData.choices?.[0]?.message?.content ?? ""
    console.info("[AI Autoplay] Extracted AI Content:", text)

    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) {
      console.warn("[AI Autoplay] Failed to find JSON array in AI response")
      return NextResponse.json({ error: "Failed to parse AI" }, { status: 500 })
    }

    const suggestions = JSON.parse(match[0]) as string[]
    console.info("[AI Autoplay] Final Parsed Suggestions:", suggestions)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("[AI Autoplay] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
