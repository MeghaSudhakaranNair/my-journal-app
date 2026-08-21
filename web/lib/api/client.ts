import { API_BASE_URL } from "@/lib/api/config";
import { createClient } from "@/lib/supabase/client";

const API_DEBUG =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_API_DEBUG === "true";

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function responseErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      detail?: string | { msg?: string }[];
    };

    if (body.error) return body.error;
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail[0].msg;
    }
  } catch {
    // Use the caller's fallback for non-JSON error responses.
  }
  return fallbackMessage;
}

async function apiFetch(
  path: string,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE_URL}${path}`;

  if (API_DEBUG) {
    console.debug("[api] request", {
      method: init?.method ?? "GET",
      url,
      body: init?.body ?? null,
      authenticated: headers.has("Authorization"),
    });
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    if (API_DEBUG) {
      console.error("[api] network failure", {
        method: init?.method ?? "GET",
        url,
        error,
      });
    }
    throw new ApiRequestError(
      "The API server could not be reached. Make sure FastAPI is running.",
    );
  }

  if (API_DEBUG) {
    console.debug("[api] response", {
      method: init?.method ?? "GET",
      url,
      status: response.status,
      statusText: response.statusText,
      body: await response.clone().text(),
    });
  }

  if (!response.ok) {
    throw new ApiRequestError(
      await responseErrorMessage(response, fallbackMessage),
      response.status,
    );
  }
  return response;
}

export function publicApiFetch(
  path: string,
  init?: RequestInit,
  fallbackMessage = "The request failed.",
) {
  return apiFetch(path, init, fallbackMessage);
}

export async function authenticatedApiFetch(
  path: string,
  init?: RequestInit,
  fallbackMessage = "The authenticated request failed.",
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new ApiRequestError(
      "Your session expired. Please log in again.",
      401,
    );
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return apiFetch(
    path,
    {
      ...init,
      headers,
    },
    fallbackMessage,
  );
}
