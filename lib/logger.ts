import fs from "fs"
import path from "path"

const LOG_FILE = path.join(process.cwd(), "sonara.log")

export function logToFile(source: "SERVER" | "CLIENT", level: "INFO" | "WARN" | "ERROR", message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const dataString = data ? ` | Data: ${JSON.stringify(data)}` : ""
  const logLine = `[${timestamp}] [${source}] [${level}] ${message}${dataString}\n`

  try {
    // Append to file, create if doesn't exist
    fs.appendFileSync(LOG_FILE, logLine, "utf8")
    
    // Also log to console for development visibility
    if (source === "SERVER") {
       console.log(`${level === 'ERROR' ? '❌' : '📝'} [LOG-FILE] ${message}`)
    }
  } catch (err) {
    console.error("Failed to write to log file:", err)
  }
}
