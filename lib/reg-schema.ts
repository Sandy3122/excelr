import { z } from "zod";
import { QUALIFICATION_OPTIONS } from "./reg-content";

/**
 * Client form fields — used by react-hook-form.
 */
export const registrationFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(80, "Name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  // 10-digit Indian mobile number. The UI prepends +91 before sending to
  // Infobip; the stored/validated value here is the local 10-digit number.
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
  college: z
    .string()
    .trim()
    .min(2, "Please enter your college / university")
    .max(120, "College name is too long"),
  qualification: z.enum(QUALIFICATION_OPTIONS, {
    errorMap: () => ({ message: "Please select your highest qualification" }),
  }),
});

export type RegistrationFormInput = z.infer<typeof registrationFormSchema>;

/**
 * Full registration payload — form fields + the page URL (with query params)
 * where the user submitted. Re-validated on the server.
 */
export const registrationSchema = registrationFormSchema.extend({
  pageUrl: z
    .string()
    .trim()
    .min(1, "Page URL is required")
    .max(2048, "Page URL is too long")
    .url("Invalid page URL"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
