import * as v from "valibot"

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export class ApiNetworkError extends Error {
  constructor(cause: unknown) {
    super("通信に失敗しました。", { cause })
    this.name = "ApiNetworkError"
  }
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { cache: "no-store", ...init })
  } catch (error) {
    throw new ApiNetworkError(error)
  }
}

/** The API error a failed response describes, or one for its status. */
function bodyError(status: number, body: string): ApiError {
  try {
    const value: unknown = JSON.parse(body)
    if (typeof value === "object" && value !== null && "error" in value) {
      const error = value.error
      if (typeof error === "string") {
        return new ApiError(error, status, "REQUEST_FAILED")
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error &&
        typeof error.code === "string" &&
        typeof error.message === "string"
      ) {
        return new ApiError(error.message, status, error.code)
      }
    }
  } catch {
    // Use the status fallback when the body is not JSON.
  }
  return new ApiError(
    `操作に失敗しました（${status}）`,
    status,
    "REQUEST_FAILED"
  )
}

async function responseError(response: Response): Promise<ApiError> {
  return bodyError(response.status, await response.text().catch(() => ""))
}

/**
 * Posts a file and reports how much of it has been sent, which fetch cannot,
 * resolving with the parsed response like `apiJson`.
 */
export function apiUpload<TSchema extends v.GenericSchema>(
  url: string,
  schema: TSchema,
  body: Blob,
  options: {
    signal?: AbortSignal | undefined
    onProgress?: ((sent: number, total: number) => void) | undefined
  } = {}
): Promise<v.InferOutput<TSchema>> {
  const { signal, onProgress } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    signal?.addEventListener("abort", abort, { once: true })
    const settle = () => signal?.removeEventListener("abort", abort)
    request.open("POST", url)
    request.setRequestHeader(
      "Content-Type",
      body.type || "application/octet-stream"
    )
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total)
    })
    request.addEventListener("load", () => {
      settle()
      if (request.status < 200 || request.status >= 300) {
        reject(bodyError(request.status, request.responseText))
        return
      }
      try {
        resolve(v.parse(schema, JSON.parse(request.responseText)))
      } catch (error) {
        reject(error)
      }
    })
    request.addEventListener("error", () => {
      settle()
      reject(new ApiNetworkError(new Error("Upload failed")))
    })
    request.addEventListener("abort", () => {
      settle()
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"))
    })
    request.send(body)
  })
}

export async function apiJson<TSchema extends v.GenericSchema>(
  url: string,
  schema: TSchema,
  init?: RequestInit
): Promise<v.InferOutput<TSchema>> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const response = await apiFetch(url, { ...init, headers })
  if (!response.ok) {
    throw await responseError(response)
  }
  return v.parse(schema, await response.json())
}

export async function apiVoid(url: string, init: RequestInit): Promise<void> {
  const response = await apiFetch(url, init)
  if (!response.ok) {
    throw await responseError(response)
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof ApiNetworkError
    ? error.message
    : "予期しないエラーが発生しました。"
}

export async function apiBlob(url: string, signal?: AbortSignal) {
  const response = await apiFetch(url, signal ? { signal } : undefined)
  if (!response.ok) throw await responseError(response)
  return response.blob()
}
