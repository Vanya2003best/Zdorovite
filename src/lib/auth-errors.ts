// Polish translations for Supabase auth errors.
//
// Supabase returns raw English messages ("Invalid login credentials") that
// used to be shown to users verbatim. Every auth action passes its error
// through translateAuthError() so the UI stays Polish end-to-end.
//
// Matching order:
//   1. error.code — stable machine-readable codes (supabase-js v2.43+),
//   2. HTTP status (429 → rate limit),
//   3. message substrings — older GoTrue responses + fetch failures,
//   4. generic fallback — never leak raw English to the UI.

type AuthErrorLike =
  | {
      message?: string;
      code?: string;
      status?: number;
      name?: string;
    }
  | null
  | undefined;

const GENERIC = "Coś poszło nie tak. Spróbuj ponownie.";
const INVALID_CREDENTIALS = "Nieprawidłowy e-mail lub hasło.";
const ALREADY_REGISTERED = "Konto z tym adresem już istnieje — zaloguj się.";
const EMAIL_NOT_CONFIRMED =
  "E-mail nie został jeszcze potwierdzony. Kliknij link aktywacyjny, który wysłaliśmy na Twoją skrzynkę.";
const RATE_LIMIT = "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
const WEAK_PASSWORD = "Hasło jest zbyt słabe — użyj co najmniej 8 znaków.";
const NETWORK = "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.";
const LINK_EXPIRED = "Link wygasł lub jest nieprawidłowy. Poproś o nowy.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: INVALID_CREDENTIALS,
  email_not_confirmed: EMAIL_NOT_CONFIRMED,
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  phone_exists: ALREADY_REGISTERED,
  weak_password: WEAK_PASSWORD,
  same_password: "Nowe hasło musi różnić się od poprzedniego.",
  over_request_rate_limit: RATE_LIMIT,
  over_email_send_rate_limit:
    "Wysłaliśmy już wiadomość na ten adres. Odczekaj chwilę przed kolejną próbą.",
  over_sms_send_rate_limit: RATE_LIMIT,
  email_address_invalid: "Podaj poprawny adres e-mail.",
  validation_failed: "Sprawdź poprawność wpisanych danych i spróbuj ponownie.",
  signup_disabled: "Rejestracja jest obecnie wyłączona. Spróbuj później.",
  otp_expired: LINK_EXPIRED,
  otp_disabled: LINK_EXPIRED,
  session_expired: "Sesja wygasła — zaloguj się ponownie.",
  session_not_found: "Sesja wygasła — zaloguj się ponownie.",
  user_banned: "To konto zostało zablokowane. Skontaktuj się z pomocą NaZdrow!.",
  request_timeout: NETWORK,
};

/** Maps a Supabase auth error to a user-facing Polish message. */
export function translateAuthError(error: AuthErrorLike): string {
  if (!error) return GENERIC;

  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];

  if (error.status === 429) return RATE_LIMIT;

  const msg = (error.message ?? "").toLowerCase();
  if (!msg) return GENERIC;

  if (msg.includes("invalid login credentials")) return INVALID_CREDENTIALS;
  if (msg.includes("email not confirmed")) return EMAIL_NOT_CONFIRMED;
  if (msg.includes("already registered") || msg.includes("already exists"))
    return ALREADY_REGISTERED;
  if (msg.includes("password should")) return WEAK_PASSWORD;
  if (msg.includes("rate limit") || msg.includes("for security purposes"))
    return RATE_LIMIT;
  if (
    (msg.includes("link") || msg.includes("token") || msg.includes("otp")) &&
    (msg.includes("expired") || msg.includes("invalid"))
  )
    return LINK_EXPIRED;
  if (
    error.name === "AuthRetryableFetchError" ||
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("getaddrinfo")
  )
    return NETWORK;

  return GENERIC;
}
