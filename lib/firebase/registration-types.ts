import type { RegistrationMessages } from "@/lib/automations/types";
import type { RegistrationGeo } from "@/lib/geo";

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
  /** Campaign key echoed to the webhook; comes from the drive's `eventKey`. */
  event: string;
  /** Owning placement drive. Stored on the document as well as implied by path. */
  placementDriveId: string;
  placementDriveSlug: string;
  /** Approximate submitter location from the request IP. Absent on older leads. */
  geo?: RegistrationGeo | null;
}

export interface StoredRegistration extends RegistrationRecord {
  id: string;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  thingsToCarryDueAt: string | null;
  messages: RegistrationMessages | null;
}
