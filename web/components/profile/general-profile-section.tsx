"use client";

import { ApiRequestError } from "@/lib/api/client";
import { profileUpdateSchema, validationErrorsByField } from "@/lib/auth-validation";
import { updateProfile, type Profile, type ProfileUpdate } from "@/lib/profile-api";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { type FocusEvent, type FormEvent, useState } from "react";

type GeneralProfileSectionProps = { initialProfile: Profile };

type ProfileFieldProps = {
  autoComplete?: string;
  defaultValue: string;
  label: string;
  name: keyof ProfileUpdate;
  error?: string;
  onClearError: (name: keyof ProfileUpdate) => void;
  onValidate: (
    name: keyof ProfileUpdate,
    event: FocusEvent<HTMLInputElement>,
  ) => void;
  placeholder?: string;
  required?: boolean;
  type?: "email" | "tel" | "text";
};

function ProfileField({ autoComplete, defaultValue, error, label, name, onClearError, onValidate, placeholder, required = false, type = "text" }: ProfileFieldProps) {
  const errorId = `profile-${name}-error`;
  return (
    <label className="grid gap-2 text-sm font-semibold text-journal-text">
      <span>{label}{required ? <span className="text-red-700"> *</span> : null}</span>
      <input type={type} name={name} defaultValue={defaultValue} autoComplete={autoComplete} placeholder={placeholder} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onInput={() => onClearError(name)} onBlur={(event) => onValidate(name, event)} className={`h-12 rounded-2xl border bg-white/75 px-4 font-normal text-journal-text outline-none transition placeholder:text-journal-muted/65 focus:ring-4 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-200/60" : "border-journal-border focus:border-journal-muted focus:ring-journal-accent/20"}`} />
      {error ? <span id={errorId} role="alert" className="text-xs font-normal text-red-700">{error}</span> : null}
    </label>
  );
}

export function GeneralProfileSection({ initialProfile }: GeneralProfileSectionProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  function clearFieldError(name: keyof ProfileUpdate) {
    setValidationErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validateField(
    name: keyof ProfileUpdate,
    event: FocusEvent<HTMLInputElement>,
  ) {
    if (name === "phone") {
      const phone = event.currentTarget.value.trim();
      const digits = phone.replace(/\D/g, "");
      if (digits.length === 10 && !phone.startsWith("+")) {
        event.currentTarget.value = `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      }
    }

    const result = profileUpdateSchema.shape[name].safeParse(
      event.currentTarget.value,
    );
    setValidationErrors((current) => {
      const next = { ...current };
      if (result.success) delete next[name];
      else next[name] = result.error.issues[0]?.message ?? "Invalid value.";
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const result = profileUpdateSchema.safeParse(Object.fromEntries(data));
    const fieldErrors = result.success ? {} : validationErrorsByField(result.error.issues);
    setValidationErrors(fieldErrors);
    if (!result.success) {
      const firstField = form.elements.namedItem(Object.keys(fieldErrors)[0]);
      if (firstField instanceof HTMLElement) firstField.focus();
      return;
    }
    const update: ProfileUpdate = result.data;

    setIsSaving(true); setMessage(""); setError("");
    try {
      await updateProfile(update);
      await createClient().auth.refreshSession();
      setMessage("Profile updated successfully.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof ApiRequestError ? caughtError.message : "We could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const initial = initialProfile.firstName[0] || initialProfile.username[0] || "U";

  return (
    <main className="rounded-[2rem] border border-white/75 bg-journal-surface/90 p-5 shadow-[0_22px_70px_-40px_rgba(47,89,67,0.55)] backdrop-blur-xl sm:p-8 lg:p-10">
      <header className="flex flex-col gap-5 border-b border-journal-border pb-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-journal-muted uppercase">Profile</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Personal details</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-journal-muted">Review and update the personal details associated with your journal account.</p>
        </div>
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-journal-bg text-xl font-semibold shadow-inner">{initial.toUpperCase()}</div>
      </header>

      <form className="mt-8 space-y-8" noValidate onSubmit={handleSubmit}>
        <section>
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileField label="First name" name="firstName" defaultValue={initialProfile.firstName} autoComplete="given-name" placeholder="Your first name" error={validationErrors.firstName} onClearError={clearFieldError} onValidate={validateField} />
            <ProfileField label="Last name" name="lastName" defaultValue={initialProfile.lastName} autoComplete="family-name" placeholder="Your last name" error={validationErrors.lastName} onClearError={clearFieldError} onValidate={validateField} />
            <ProfileField label="Username" name="username" defaultValue={initialProfile.username} autoComplete="username" placeholder="Your username" required error={validationErrors.username} onClearError={clearFieldError} onValidate={validateField} />
            <div className="sm:col-span-2"><ProfileField label="Phone number" name="phone" type="tel" defaultValue={initialProfile.phone} autoComplete="tel" placeholder="+1 555 000 0000" error={validationErrors.phone} onClearError={clearFieldError} onValidate={validateField} /></div>
            <div className="sm:col-span-2"><ProfileField label="Address line 1" name="addressLine1" defaultValue={initialProfile.addressLine1} autoComplete="address-line1" placeholder="Street address" error={validationErrors.addressLine1} onClearError={clearFieldError} onValidate={validateField} /></div>
            <div className="sm:col-span-2"><ProfileField label="Address line 2" name="addressLine2" defaultValue={initialProfile.addressLine2} autoComplete="address-line2" placeholder="Apartment, suite, or unit" error={validationErrors.addressLine2} onClearError={clearFieldError} onValidate={validateField} /></div>
            <ProfileField label="City" name="city" defaultValue={initialProfile.city} autoComplete="address-level2" placeholder="City" error={validationErrors.city} onClearError={clearFieldError} onValidate={validateField} />
            <ProfileField label="State or region" name="region" defaultValue={initialProfile.region} autoComplete="address-level1" placeholder="State or region" error={validationErrors.region} onClearError={clearFieldError} onValidate={validateField} />
            <ProfileField label="Postal code" name="postalCode" defaultValue={initialProfile.postalCode} autoComplete="postal-code" placeholder="Postal code" error={validationErrors.postalCode} onClearError={clearFieldError} onValidate={validateField} />
            <ProfileField label="Country" name="country" defaultValue={initialProfile.country} autoComplete="country-name" placeholder="Country" error={validationErrors.country} onClearError={clearFieldError} onValidate={validateField} />
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-journal-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-h-5 text-sm">
            {error ? <p role="alert" className="font-medium text-red-700">{error}</p> : null}
            {message ? <p className="font-medium text-journal-text">{message}</p> : null}
          </div>
          <button type="submit" disabled={isSaving} className="shrink-0 rounded-full bg-journal-text px-6 py-3 text-sm font-semibold text-journal-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60">
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </main>
  );
}
