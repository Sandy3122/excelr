import { z } from "zod";
import { QUALIFICATION_OPTIONS } from "./reg-content";

/**
 * Shared validation schema — used by the client form (react-hook-form)
 * AND re-validated on the server route so bad payloads never reach Sheets/email.
 */
export const registrationSchema = z.object({
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

export type RegistrationInput = z.infer<typeof registrationSchema>;
