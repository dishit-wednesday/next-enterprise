// app/api/ai/recommendations/route.ts
// Calls Groq REST API directly — no SDK, no Zod conflicts

import { NextRequest, NextResponse } from "next/server"

interface RecommendationRequest {
  artists: string[]
  genres: string[]
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    }

    const body = await req.json() as RecommendationRequest
    const artists: string[] = Array.isArray(body.artists) ? body.artists : []
    const genres: string[] = Array.isArray(body.genres) ? body.genres : []

    const hasContext = artists.length > 0 || genres.length > 0
    const artistList = artists.slice(0, 10).join(", ")
    const uniqueGenres = genres.filter((g, i, arr) => arr.indexOf(g) === i).slice(0, 6)
    const genreList = uniqueGenres.join(", ")

    const systemPrompt = `You are a music recommendation engine. You always respond with ONLY a valid JSON array of artist name strings — no explanation, no markdown, no extra text. Just the raw JSON array.`

    const userPrompt = hasContext
      ? `The user likes these artists: ${artistList || "various"}.
Their preferred genres are: ${genreList || "various"}.
Suggest exactly 8 different artists the user would enjoy, similar in sound or era.
Do NOT repeat any artist from the input list.
Return ONLY a JSON array like: ["Artist One", "Artist Two"]`
      : `Suggest 8 currently popular and diverse music artists across different genres.
Include a mix of pop, hip-hop, indie, and electronic artists.
Return ONLY a JSON array like: ["Artist One", "Artist Two"]`

    // Logging AI Request
    console.info("--- AI Recommendation Request ---")
    console.info("Artists:", artists)
    console.info("Genres:", genres)
    console.info("Personalized:", hasContext)
    // console.info("Prompt:", userPrompt) // Optional but nice

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
        temperature: 0.8,
        max_tokens: 256,
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error("[AI recommendations] Groq error:", errText)
      return NextResponse.json({ error: "Groq API failed", detail: errText }, { status: 500 })
    }

    const groqData = await groqRes.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const text = groqData.choices?.[0]?.message?.content ?? ""
    console.info("--- AI Raw Response ---")
    console.info(text)

    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) {
      console.error("[AI recommendations] Could not parse:", text)
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 })
    }

    const suggestedArtists = JSON.parse(match[0]) as string[]
    console.info("--- AI Suggested Artists ---")
    console.info(suggestedArtists)
    console.info("-----------------------------")

    return NextResponse.json({ artists: suggestedArtists })
  } catch (err: unknown) {
    console.error("[AI recommendations] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
