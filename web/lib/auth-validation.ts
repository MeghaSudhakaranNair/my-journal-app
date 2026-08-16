import { z } from "zod";

const optionalText = z.string().trim().optional();

export const passwordSchema = z
  .string()
  .min(1, "Password is required.")
  .refine(
    (password) =>
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password),
    {
      message: "Password does not meet all of the requirements below.",
    },
  );

export const registrationSchema = z
  .object({
    firstName: optionalText,
    lastName: optionalText,
    username: z.string().trim().min(1, "Username is required."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
    email: z
      .string()
      .trim()
      .min(1, "Email is required for account recovery.")
      .email("Enter a valid email address, such as you@example.com."),
    phone: z
      .string()
      .trim()
      .refine(
        (phone) => {
          if (!phone) return true;
          const digitCount = phone.replace(/\D/g, "").length;
          return (
            /^\+?[\d\s().-]+$/.test(phone) &&
            digitCount >= 7 &&
            digitCount <= 15
          );
        },
        {
          message: "Enter a valid phone number containing 7 to 15 digits.",
        },
      ),
    addressLine1: optionalText,
    addressLine2: optionalText,
    city: optionalText,
    region: optionalText,
    postalCode: optionalText,
    country: optionalText,
  })
  .refine((data) => data.confirmPassword === data.password, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address, such as you@example.com."),
  password: z.string().min(1, "Password is required."),
});

export function validationErrorsByField(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const fieldName = String(issue.path[0] ?? "");
    if (fieldName && !errors[fieldName]) errors[fieldName] = issue.message;
  }

  return errors;
}
