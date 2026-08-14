import type { z } from "zod"

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

async function responseError(response: Response): Promise<ApiError> {
  try {
    const value: unknown = await response.json()
    if (typeof value === "object" && value !== null && "error" in value) {
      const error = value.error
      if (typeof error === "string") {
        return new ApiError(error, response.status, "REQUEST_FAILED")
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error &&
        typeof error.code === "string" &&
        typeof error.message === "string"
      ) {
        return new ApiError(error.message, response.status, error.code)
      }
    }
  } catch {
    // Use the status fallback when the body is not JSON.
  }
  return new ApiError(
    `操作に失敗しました（${response.status}）`,
    response.status,
    "REQUEST_FAILED"
  )
}

export async function apiJson<TSchema extends z.ZodType>(
  url: string,
  schema: TSchema,
  init?: RequestInit
): Promise<z.output<TSchema>> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  })
  if (!response.ok) {
    throw await responseError(response)
  }
  return schema.parse(await response.json())
}

export async function apiVoid(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, { cache: "no-store", ...init })
  if (!response.ok) {
    throw await responseError(response)
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "予期しないエラーが発生しました。"
}
