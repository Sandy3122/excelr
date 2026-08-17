/**
 * Greeting name used in every WhatsApp template and email.
 * Spec: first word of Full Name, or "there" if blank.
 */
export function firstNameFrom(fullName: string | null | undefined): string {
  const part = String(fullName || "")
    .trim()
    .split(/\s+/)[0];
  return part || "there";
}
