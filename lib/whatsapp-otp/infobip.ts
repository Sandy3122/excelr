import { getInfobipConfig, type InfobipConfig } from "./config";

/**
 * Infobip WhatsApp template send service (server-side only).
 *
 * Endpoint:  POST {baseUrl}/whatsapp/1/message/template
 * Auth:      Authorization: App <INFOBIP_API_KEY>
 *
 * Payload matches the approved template `fsd_website_otp_11082026`
 * (template ID 884804994387290):
 *
 * {
 *   "messages": [{
 *     "from": "918050162541",
 *     "to": "<digits, no +>",
 *     "content": {
 *       "templateName": "fsd_website_otp_11082026",
 *       "templateData": {
 *         "body": { "placeholders": ["<otp>"] },
 *         "buttons": [{ "type": "URL", "parameter": "<otp>" }]
 *       },
 *       "language": "en_IN"
 *     }
 *   }]
 * }
 *
 * The URL button is always included. INFOBIP_TEMPLATE_URL_BUTTON_PARAM defaults
 * to the OTP; set a literal only if the approved suffix is not the code.
 */

export type InfobipTemplatePayload = {
  messages: Array<{
    from: string;
    to: string;
    content: {
      templateName: string;
      templateData: {
        body: { placeholders: string[] };
        buttons: Array<{ type: "URL"; parameter: string }>;
      };
      language: string;
    };
  }>;
};

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

/** Build the exact JSON payload Infobip expects for the OTP template. */
export function buildTemplatePayload(
  cfg: InfobipConfig,
  toInfobip: string,
  otp: string,
): InfobipTemplatePayload {
  const parameter =
    cfg.urlButtonParam.toLowerCase() === "otp" ? otp : cfg.urlButtonParam;

  return {
    messages: [
      {
        from: cfg.sender,
        to: toInfobip,
        content: {
          templateName: cfg.templateName,
          templateData: {
            body: { placeholders: [otp] },
            buttons: [{ type: "URL", parameter }],
          },
          language: cfg.language,
        },
      },
    ],
  };
}

/**
 * Send the OTP via Infobip. Returns a safe result; the OTP is never logged and
 * raw provider error bodies are never propagated to callers/clients.
 */
export async function sendWhatsAppOtp(
  toInfobip: string,
  otp: string,
): Promise<SendResult> {
  const cfg = getInfobipConfig();
  const payload = buildTemplatePayload(cfg, toInfobip, otp);
  const endpoint = `${cfg.baseUrl}/whatsapp/1/message/template`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `App ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "WHATSAPP_SEND_FAILED" };
  }

  if (!res.ok) {
    let providerStatus: string | undefined;
    try {
      const data = (await res.json()) as {
        requestError?: { serviceException?: { messageId?: string } };
      };
      providerStatus = data?.requestError?.serviceException?.messageId;
    } catch {
      /* ignore body parse errors */
    }
    console.error(
      `[whatsapp-otp] Infobip send failed: HTTP ${res.status}` +
        (providerStatus ? ` (${providerStatus})` : ""),
    );
    return { ok: false, error: "WHATSAPP_SEND_FAILED" };
  }

  // HTTP 200 only means Infobip ACCEPTED the request — the per-message status
  // can still be REJECTED/UNDELIVERABLE. Fail those so the UI never claims
  // "OTP sent" when it wasn't.
  //  groupId 2 = UNDELIVERABLE, 5 = REJECTED  → failure
  //  groupId 1 = PENDING, 3 = DELIVERED       → success
  try {
    const data = (await res.json()) as {
      messages?: Array<{
        messageId?: string;
        status?: {
          groupId?: number;
          groupName?: string;
          name?: string;
          description?: string;
        };
      }>;
    };
    const msg = data?.messages?.[0];
    const status = msg?.status;
    if (status && (status.groupId === 2 || status.groupId === 5)) {
      console.error(
        `[whatsapp-otp] Infobip rejected message: ${status.groupName}/${status.name} — ${status.description}`,
      );
      return { ok: false, error: "WHATSAPP_SEND_FAILED" };
    }
    return { ok: true, providerMessageId: msg?.messageId };
  } catch {
    return { ok: true };
  }
}
