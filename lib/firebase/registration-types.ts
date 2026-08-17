import type { RegistrationMessages } from "@/lib/automations/types";

export interface RegistrationRecord {
  fullName: string;
  firstName: string;
  email: string;
  emailLower: string;
  phone: string;
  college: string;
  qualification: string;
  pageUrl: string;
  submittedAtIso: string;
  event: string;
}

export interface StoredRegistration extends RegistrationRecord {
  id: string;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  thingsToCarryDueAt: string | null;
  messages: RegistrationMessages | null;
}
