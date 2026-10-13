/**
 * Error translation + normalization layer.
 *
 * Services throw AppError instances so the UI layer never has to parse
 * raw Supabase strings. Every service call funnels through `normalize()`
 * which turns a Supabase / network / unknown error into an AppError with
 * a stable `code` and a Persian `message` suitable for a toast.
 */

export class AppError extends Error {
  constructor(code, message, { cause, details, status } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
    this.details = details;
    this.status = status;
  }
}

export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_CONFIRMED: "AUTH_EMAIL_NOT_CONFIRMED",
  AUTH_EMAIL_EXISTS: "AUTH_EMAIL_EXISTS",
  AUTH_WEAK_PASSWORD: "AUTH_WEAK_PASSWORD",
  AUTH_RATE_LIMITED: "AUTH_RATE_LIMITED",
  NETWORK: "NETWORK",
  OFFLINE: "OFFLINE",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION: "PERMISSION",
  CONFLICT: "CONFLICT",
  VALIDATION: "VALIDATION",
  UNKNOWN: "UNKNOWN",
};

const PERSIAN_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: "برای انجام این عملیات باید وارد شوید",
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: "ایمیل یا رمز عبور اشتباه است",
  [ERROR_CODES.AUTH_EMAIL_NOT_CONFIRMED]: "ایمیل شما هنوز تأیید نشده است",
  [ERROR_CODES.AUTH_EMAIL_EXISTS]: "این ایمیل قبلاً ثبت شده است",
  [ERROR_CODES.AUTH_WEAK_PASSWORD]: "رمز عبور ضعیف است",
  [ERROR_CODES.AUTH_RATE_LIMITED]: "تلاش‌های زیاد — کمی بعد دوباره امتحان کنید",
  [ERROR_CODES.NETWORK]: "خطای شبکه — اتصال خود را بررسی کنید",
  [ERROR_CODES.OFFLINE]: "اتصال اینترنت قطع است",
  [ERROR_CODES.NOT_FOUND]: "موردی یافت نشد",
  [ERROR_CODES.PERMISSION]: "دسترسی به این بخش مجاز نیست",
  [ERROR_CODES.CONFLICT]: "این مورد از قبل وجود دارد",
  [ERROR_CODES.VALIDATION]: "اطلاعات وارد شده معتبر نیست",
  [ERROR_CODES.UNKNOWN]: "خطای غیرمنتظره رخ داد",
};

export function appError(code, overrides = {}) {
  const message = overrides.message || PERSIAN_MESSAGES[code] || PERSIAN_MESSAGES[ERROR_CODES.UNKNOWN];
  return new AppError(code, message, overrides);
}

/**
 * Turn any thrown value into an AppError.
 * Recognized shapes:
 *  - Supabase PostgrestError  { code: "PGRST…", message, details }
 *  - Supabase AuthError       { message, status, code }
 *  - TypeError from fetch     (message includes "Failed to fetch")
 *  - our own AppError         (returned as-is)
 */
export function normalize(err) {
  if (!err) return appError(ERROR_CODES.UNKNOWN);
  if (err instanceof AppError) return err;

  // Offline shortcut
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return appError(ERROR_CODES.OFFLINE, { cause: err });
  }

  const msg = String(err.message || err.error_description || err.error || "").toLowerCase();
  const code = String(err.code || "").toUpperCase();
  const status = err.status || err.statusCode;

  // Auth
  if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
    return appError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, { cause: err, status });
  }
  if (msg.includes("email not confirmed")) {
    return appError(ERROR_CODES.AUTH_EMAIL_NOT_CONFIRMED, { cause: err, status });
  }
  if (msg.includes("already registered") || msg.includes("user already")) {
    return appError(ERROR_CODES.AUTH_EMAIL_EXISTS, { cause: err, status });
  }
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("at least"))) {
    return appError(ERROR_CODES.AUTH_WEAK_PASSWORD, { cause: err, status });
  }
  if (msg.includes("rate limit") || status === 429) {
    return appError(ERROR_CODES.AUTH_RATE_LIMITED, { cause: err, status });
  }

  // PostgREST
  if (code.startsWith("PGRST")) {
    if (code === "PGRST116") return appError(ERROR_CODES.NOT_FOUND, { cause: err });
    return appError(ERROR_CODES.UNKNOWN, { cause: err, details: err.details });
  }
  // 23505 unique_violation, 23503 foreign_key_violation, 42P01 undefined_table
  if (code === "23505") return appError(ERROR_CODES.CONFLICT, { cause: err });
  if (code === "23503") return appError(ERROR_CODES.VALIDATION, { cause: err });
  if (code === "42501" || status === 403) return appError(ERROR_CODES.PERMISSION, { cause: err, status });

  // Network
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed")
  ) {
    return appError(ERROR_CODES.NETWORK, { cause: err });
  }

  if (status === 401) return appError(ERROR_CODES.AUTH_REQUIRED, { cause: err, status });
  if (status === 404) return appError(ERROR_CODES.NOT_FOUND, { cause: err, status });

  return new AppError(ERROR_CODES.UNKNOWN, err.message || PERSIAN_MESSAGES[ERROR_CODES.UNKNOWN], {
    cause: err,
    details: err.details,
    status,
  });
}

/**
 * Wrap a Supabase call: throws AppError on error, returns data on success.
 *   const data = await run(supabase.from("x").select("*"));
 */
export async function run(queryBuilder) {
  const { data, error } = await queryBuilder;
  if (error) throw normalize(error);
  return data;
}

/** Same as run() but returns { data, error } so callers can handle soft failures. */
export async function tryRun(queryBuilder) {
  try {
    const data = await run(queryBuilder);
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}