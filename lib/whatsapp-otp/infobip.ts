import { getInfobipConfig, type InfobipConfig } from "./config";

/**
 * Infobip WhatsApp template send service (server-side only).
 *
 * Endpoint:  POST {baseUrl}/whatsapp/1/message/template
 * Auth:      Authorization: App <INFOBIP_API_KEY>
 */

export type InfobipTemplatePayload = {
  messages: Array<{
    from: string;
    to: string;
    content: {
      templateName: string;
      templateData: {
        body: { placeholders: string[] };
        buttons?: Array<{ type: "URL"; parameter: string }>;
      };
      language: string;
    };
  }>;
};

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

/** OTP template `fsd_website_otp_11082026` — body placeholder + URL button. */
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
 * Confirmation template `fsd_placement_drive_confirmation_message_a`
 * (template ID 2283037602514705) — body placeholder only, no buttons.
 */
export function buildConfirmationPayload(
  cfg: InfobipConfig,
  toInfobip: string,
  firstName: string,
): InfobipTemplatePayload {
  return {
    messages: [
      {
        from: cfg.sender,
        to: toInfobip,
        content: {
          templateName: cfg.confirmationTemplateName,
          templateData: {
            body: { placeholders: [firstName] },
          },
          language: cfg.language,
        },
      },
    ],
  };
}

export async function sendWhatsAppOtp(
  toInfobip: string,
  otp: string,
): Promise<SendResult> {
  const cfg = getInfobipConfig();
  return postTemplate(cfg, buildTemplatePayload(cfg, toInfobip, otp), "otp");
}

export async function sendRegistrationConfirmationWhatsApp(
  toInfobip: string,
  firstName: string,
): Promise<SendResult> {
  const cfg = getInfobipConfig();
  return postTemplate(
    cfg,
    buildConfirmationPayload(cfg, toInfobip, firstName),
    "confirmation",
  );
}

async function postTemplate(
  cfg: InfobipConfig,
  payload: InfobipTemplatePayload,
  kind: "otp" | "confirmation",
): Promise<SendResult> {
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
      `[whatsapp-${kind}] Infobip send failed: HTTP ${res.status}` +
        (providerStatus ? ` (${providerStatus})` : ""),
    );
    return { ok: false, error: "WHATSAPP_SEND_FAILED" };
  }

  // HTTP 200 only means Infobip ACCEPTED the request — the per-message status
  // can still be REJECTED/UNDELIVERABLE.
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
        `[whatsapp-${kind}] Infobip rejected message: ${status.groupName}/${status.name} — ${status.description}`,
      );
      return { ok: false, error: "WHATSAPP_SEND_FAILED" };
    }
    return { ok: true, providerMessageId: msg?.messageId };
  } catch {
    return { ok: true };
  }
}
