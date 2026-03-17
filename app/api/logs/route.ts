import { NextResponse } from "next/server"
import { logToFile } from "lib/logger"

export async function POST(req: Request) {
  try {
    const { level, message, data } = await req.json() as { level: "INFO" | "WARN" | "ERROR", message: string, data?: any }
    
    logToFile("CLIENT", level || "INFO", message, data)
    
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 })
  }
}
