// lib/api/fetchApi.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function fetchApi<T>(
  endpoint: string,
  token: string | null,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      let errorMsg = "An error occurred"
      try {
        const errorData = await response.json() as Record<string, unknown>
        errorMsg = (errorData.error as string) || (errorData.message as string) || errorMsg
      } catch {
        errorMsg = response.statusText
      }
      return { error: errorMsg }
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return { data: { success: true } as unknown as T }
    }

    let json: unknown
    try {
      json = await response.json()
    } catch {
      return { data: {} as T }
    }

    const data = (json as Record<string, unknown>).data !== undefined
      ? (json as Record<string, unknown>).data
      : json

    return { data: data as T }
  } catch (error: unknown) {
    console.error(`[fetchApi] Error calling ${endpoint}:`, error)
    return { error: error instanceof Error ? error.message : "Network error" }
  }
}
