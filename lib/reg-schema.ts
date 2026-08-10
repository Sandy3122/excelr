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
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone number is too long")
    .regex(/^[+\d][\d\s-]{6,}$/, "Enter a valid phone number"),
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
