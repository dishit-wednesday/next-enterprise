// app/api/ai/autoplay/route.ts
// AI-powered genre expansion for autoplay

import { NextRequest, NextResponse } from "next/server"
import { logToFile } from "lib/logger"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    }

    const { genre, likedArtists, likedGenres, skippedGenres, engagedGenres } = await req.json() as {
      genre?: string
      likedArtists?: string[]
      likedGenres?: string[]
      skippedGenres?: string[]
      engagedGenres?: string[]
    }

    logToFile("SERVER", "INFO", `Expanding genre: ${genre}`, {
      likedArtists: likedArtists?.length,
      likedGenres: likedGenres?.length,
      skipped: skippedGenres?.length,
      engaged: engagedGenres?.length
    })

    if (!genre) {
      return NextResponse.json({ error: "No genre provided" }, { status: 400 })
    }

    console.info(`[AI Autoplay] Expanding genre: ${genre}`)
    console.info(`[AI Autoplay] Personalized Context -> Liked Artists: ${likedArtists?.length || 0}, Liked Genres: ${likedGenres?.length || 0}, Skipped: ${skippedGenres?.length || 0}, Engaged: ${engagedGenres?.length || 0}`)

    const systemPrompt = `You are a music discovery expert. You respond ONLY with a raw JSON object containing "suggestions" (an array of 6 artist names) and "reasoning" (a short explanation of why you chose these based on the user's taste and session). No other text.`

    const likedArtistsList = (likedArtists ?? []).slice(0, 10).join(", ") || "unknown"
    const likedGenresList = (likedGenres ?? []).slice(0, 5).join(", ") || "unknown"
    const skippedGenresList = (skippedGenres ?? []).join(", ") || "none"
    const engagedGenresList = (engagedGenres ?? []).join(", ") || "none"

    const userPrompt = `You are a smart music DJ.
    
CURRENT TRACK GENRE: ${genre}

USER PROFILE & SESSION:
- Liked artists: ${likedArtistsList}
- Liked genres: ${likedGenresList}
- Recently skipped genres: ${skippedGenresList}
- Currently engaged/enjoying: ${engagedGenresList}

TASK: Suggest exactly 6 SHUFFLED artists for autoplay and explain your logic.
Rules:
1. 4 artists: Core matches.
2. 1 artist: Adjacent discovery.
3. 1 artist: Wildcard.
4. NEVER suggest artists from the "Liked artists" list.
5. Avoid genres the user has been skipping.

Return ONLY a raw JSON object: { "suggestions": ["Artist1", ...], "reasoning": "Because you like X and avoided Y, I chose Z..." }`

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
        max_tokens: 300,
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

    const text = groqData.choices?.[0]?.message?.content ?? ""
    console.info("[AI Autoplay] Raw AI Response:", text)

    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) {
      console.warn("[AI Autoplay] Failed to find JSON object in AI response")
      return NextResponse.json({ error: "Failed to parse AI" }, { status: 500 })
    }

    const result = JSON.parse(match[0]) as { suggestions: string[], reasoning: string }
    logToFile("SERVER", "INFO", "AI Decision Logic", { reasoning: result.reasoning, suggestions: result.suggestions })

    return NextResponse.json({ suggestions: result.suggestions, reasoning: result.reasoning })
  } catch (err) {
    console.error("[AI Autoplay] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
