"use client";

import {
  loginSchema,
  registrationSchema,
  validationErrorsByField,
} from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
} from "react";

type AuthMode = "register" | "login";
type ValidationErrors = Record<string, string>;

function inputClassName(hasError = false) {
  return `mt-1.5 w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-sm text-journal-text outline-none transition placeholder:text-journal-muted/60 focus:ring-3 ${
    hasError
      ? "border-red-500 focus:border-red-600 focus:ring-red-200/60"
      : "border-journal-border focus:border-journal-muted focus:ring-journal-accent/30"
  }`;
}

const labelClassName = "text-sm font-medium text-journal-text";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span
      id={id}
      role="alert"
      className="mt-1.5 block text-xs font-normal text-red-700"
    >
      {message}
    </span>
  ) : null;
}

export function AuthEntry() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("register");
  const [formMessage, setFormMessage] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function closeDialog() {
    setIsOpen(false);
    setFormMessage("");
    setValidationErrors({});
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormMessage("");
    setValidationErrors({});
  }

  function clearFieldError(fieldName: string) {
    setValidationErrors((currentErrors) => {
      if (!currentErrors[fieldName]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }

  function focusFirstInvalid(
    form: HTMLFormElement,
    errors: ValidationErrors,
  ) {
    const firstFieldName = Object.keys(errors)[0];
    const field = form.elements.namedItem(firstFieldName);
    if (field instanceof HTMLElement) field.focus();
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = registrationSchema.safeParse(Object.fromEntries(data));
    const errors = result.success
      ? {}
      : validationErrorsByField(result.error.issues);

    setValidationErrors(errors);
    setFormMessage("");
    if (!result.success) {
      focusFirstInvalid(form, errors);
      return;
    }

    setIsRegistering(true);

    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          data: {
            username: result.data.username,
            first_name: result.data.firstName || null,
            last_name: result.data.lastName || null,
            phone: result.data.phone || null,
            address_line_1: result.data.addressLine1 || null,
            address_line_2: result.data.addressLine2 || null,
            city: result.data.city || null,
            region: result.data.region || null,
            postal_code: result.data.postalCode || null,
            country: result.data.country || null,
          },
        },
      });

      if (error) {
        setFormMessage(error.message);
        return;
      }

      form.reset();
      if (authData.session) {
        window.location.assign("/journal");
        return;
      }

      setFormMessage(
        "Account created. Check your email to confirm your account before logging in.",
      );
    } catch {
      setFormMessage(
        "We could not create your account. Check your connection and try again.",
      );
    } finally {
      setIsRegistering(false);
    }
  }

  function handlePhoneBlur(event: FocusEvent<HTMLInputElement>) {
    const phone = event.currentTarget.value.trim();
    const digits = phone.replace(/\D/g, "");

    if (digits.length === 10 && !phone.startsWith("+")) {
      event.currentTarget.value = `+1 ${digits.slice(0, 3)} ${digits.slice(
        3,
        6,
      )} ${digits.slice(6)}`;
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = loginSchema.safeParse(Object.fromEntries(data));
    const errors = result.success
      ? {}
      : validationErrorsByField(result.error.issues);

    setValidationErrors(errors);
    setFormMessage("");
    if (!result.success) {
      focusFirstInvalid(form, errors);
      return;
    }

    setIsLoggingIn(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        setFormMessage(error.message);
        return;
      }

      form.reset();
      window.location.assign("/journal");
    } catch {
      setFormMessage(
        "We could not log you in. Check your connection and try again.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode("register");
          setIsOpen(true);
        }}
        className="rounded-full bg-journal-text px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(47,89,67,0.8)] transition hover:-translate-y-0.5 hover:bg-[#244b36] hover:shadow-[0_12px_28px_-10px_rgba(47,89,67,0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text"
      >
        Register
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="auth-dialog-title"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => event.preventDefault()}
        className="m-auto max-h-[min(90vh,760px)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl border border-white/70 bg-[#f8fdf9] p-0 text-journal-text shadow-[0_30px_90px_-25px_rgba(24,61,41,0.55)] backdrop:bg-[#173c2a]/45 backdrop:backdrop-blur-sm"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-journal-border/80 bg-[#f8fdf9]/95 px-5 py-5 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-journal-muted uppercase">
              My Journal
            </p>
            <h2
              id="auth-dialog-title"
              className="mt-1 text-2xl font-semibold tracking-tight"
            >
              {mode === "register" ? "Create your space" : "Welcome back"}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close authentication dialog"
            className="grid size-9 place-items-center rounded-full text-xl text-journal-muted transition hover:bg-journal-bg hover:text-journal-text focus-visible:outline-2 focus-visible:outline-journal-text"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7">
          <div
            className="grid grid-cols-2 rounded-xl bg-journal-bg/70 p-1"
            role="tablist"
            aria-label="Authentication options"
          >
            {(["register", "login"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                onClick={() => changeMode(option)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${
                  mode === option
                    ? "bg-white text-journal-text shadow-sm"
                    : "text-journal-muted hover:text-journal-text"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {mode === "register" ? (
            <form
              className="mt-6 space-y-6"
              noValidate
              onSubmit={handleRegisterSubmit}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClassName}>
                  First name
                  <input
                    autoFocus
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="Your first name"
                    className={inputClassName()}
                  />
                </label>
                <label className={labelClassName}>
                  Last name
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    placeholder="Your last name"
                    className={inputClassName()}
                  />
                </label>
                <label className={labelClassName}>
                  Username <span className="text-red-700">*</span>
                  <input
                    name="username"
                    autoComplete="username"
                    placeholder="Choose a username"
                    aria-invalid={Boolean(validationErrors.username)}
                    aria-describedby={
                      validationErrors.username
                        ? "register-username-error"
                        : undefined
                    }
                    onInput={() => clearFieldError("username")}
                    className={inputClassName(Boolean(validationErrors.username))}
                  />
                  <FieldError
                    id="register-username-error"
                    message={validationErrors.username}
                  />
                </label>
                <label className={labelClassName}>
                  Password <span className="text-red-700">*</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    aria-invalid={Boolean(validationErrors.password)}
                    aria-describedby={
                      validationErrors.password
                        ? "register-password-error register-password-help"
                        : "register-password-help"
                    }
                    onInput={() => clearFieldError("password")}
                    className={inputClassName(Boolean(validationErrors.password))}
                  />
                  <FieldError
                    id="register-password-error"
                    message={validationErrors.password}
                  />
                  <span
                    id="register-password-help"
                    className="mt-1.5 block text-xs font-normal text-journal-muted"
                  >
                    8+ characters with uppercase, lowercase, a number, and a
                    special character.
                  </span>
                </label>
                <label className={labelClassName}>
                  Confirm password <span className="text-red-700">*</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Enter your password again"
                    aria-invalid={Boolean(validationErrors.confirmPassword)}
                    aria-describedby={
                      validationErrors.confirmPassword
                        ? "register-confirm-password-error"
                        : undefined
                    }
                    onInput={() => clearFieldError("confirmPassword")}
                    className={inputClassName(
                      Boolean(validationErrors.confirmPassword),
                    )}
                  />
                  <FieldError
                    id="register-confirm-password-error"
                    message={validationErrors.confirmPassword}
                  />
                </label>
                <label className={labelClassName}>
                  Email <span className="text-red-700">*</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(validationErrors.email)}
                    aria-describedby={
                      validationErrors.email
                        ? "register-email-error"
                        : undefined
                    }
                    onInput={() => clearFieldError("email")}
                    className={inputClassName(Boolean(validationErrors.email))}
                  />
                  <FieldError
                    id="register-email-error"
                    message={validationErrors.email}
                  />
                </label>
                <label className={labelClassName}>
                  Phone number
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    placeholder="+1 555 000 0000"
                    aria-invalid={Boolean(validationErrors.phone)}
                    aria-describedby={
                      validationErrors.phone
                        ? "register-phone-error register-phone-help"
                        : "register-phone-help"
                    }
                    onInput={() => clearFieldError("phone")}
                    onBlur={handlePhoneBlur}
                    className={inputClassName(Boolean(validationErrors.phone))}
                  />
                  <FieldError
                    id="register-phone-error"
                    message={validationErrors.phone}
                  />
                  <span
                    id="register-phone-help"
                    className="mt-1.5 block text-xs font-normal text-journal-muted"
                  >
                    A 10-digit number automatically receives the +1 country
                    code.
                  </span>
                </label>
              </div>

              <fieldset className="rounded-2xl border border-journal-border bg-white/45 p-4 sm:p-5">
                <legend className="px-2 text-sm font-semibold">
                  Address <span className="font-normal text-journal-muted">(optional)</span>
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={`${labelClassName} sm:col-span-2`}>
                    Address line 1
                    <input
                      name="addressLine1"
                      autoComplete="address-line1"
                      placeholder="Street address"
                      className={inputClassName()}
                    />
                  </label>
                  <label className={`${labelClassName} sm:col-span-2`}>
                    Address line 2
                    <input
                      name="addressLine2"
                      autoComplete="address-line2"
                      placeholder="Apartment, suite, unit"
                      className={inputClassName()}
                    />
                  </label>
                  <label className={labelClassName}>
                    City
                    <input
                      name="city"
                      autoComplete="address-level2"
                      className={inputClassName()}
                    />
                  </label>
                  <label className={labelClassName}>
                    State / province
                    <input
                      name="region"
                      autoComplete="address-level1"
                      className={inputClassName()}
                    />
                  </label>
                  <label className={labelClassName}>
                    Postal code
                    <input
                      name="postalCode"
                      autoComplete="postal-code"
                      className={inputClassName()}
                    />
                  </label>
                  <label className={labelClassName}>
                    Country
                    <input
                      name="country"
                      autoComplete="country-name"
                      className={inputClassName()}
                    />
                  </label>
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full rounded-xl bg-journal-text px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(47,89,67,0.75)] transition hover:bg-[#244b36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text"
              >
                {isRegistering ? "Creating account…" : "Create account"}
              </button>
            </form>
          ) : (
            <form
              className="mt-6 space-y-4"
              noValidate
              onSubmit={handleLoginSubmit}
            >
              <label className={labelClassName}>
                Email
                <input
                  autoFocus
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(validationErrors.email)}
                  aria-describedby={
                    validationErrors.email
                      ? "login-email-error"
                      : undefined
                  }
                  onInput={() => clearFieldError("email")}
                  className={inputClassName(
                    Boolean(validationErrors.email),
                  )}
                />
                <FieldError
                  id="login-email-error"
                  message={validationErrors.email}
                />
              </label>
              <label className={labelClassName}>
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={Boolean(validationErrors.password)}
                  aria-describedby={
                    validationErrors.password
                      ? "login-password-error"
                      : undefined
                  }
                  onInput={() => clearFieldError("password")}
                  className={inputClassName(Boolean(validationErrors.password))}
                />
                <FieldError
                  id="login-password-error"
                  message={validationErrors.password}
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-journal-muted underline-offset-4 hover:text-journal-text hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-xl bg-journal-text px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244b36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text"
              >
                {isLoggingIn ? "Logging in…" : "Log in"}
              </button>
            </form>
          )}

          {formMessage ? (
            <p
              role="status"
              className="mt-5 rounded-xl border border-journal-border bg-journal-bg/60 px-4 py-3 text-sm text-journal-text"
            >
              {formMessage}
            </p>
          ) : null}

          <p className="mt-5 text-center text-xs leading-5 text-journal-muted">
            {mode === "register"
              ? "Registration is securely handled by Supabase Auth."
              : "Login is securely handled by Supabase Auth."}
          </p>
        </div>
      </dialog>
    </>
  );
}
