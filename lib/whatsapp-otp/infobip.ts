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

export function buildNamedTemplatePayload(
  cfg: InfobipConfig,
  toInfobip: string,
  firstName: string,
  templateName: string,
): InfobipTemplatePayload {
  return {
    messages: [
      {
        from: cfg.sender,
        to: toInfobip,
        content: {
          templateName,
          templateData: {
            body: { placeholders: [firstName] },
          },
          language: cfg.language,
        },
      },
    ],
  };
}

export function buildNamedTemplateBatchPayload(
  cfg: InfobipConfig,
  recipients: Array<{ to: string; firstName: string }>,
  templateName: string,
): InfobipTemplatePayload {
  return {
    messages: recipients.map((r) => ({
      from: cfg.sender,
      to: r.to,
      content: {
        templateName,
        templateData: {
          body: { placeholders: [r.firstName] },
        },
        language: cfg.language,
      },
    })),
  };
}

export async function sendNamedWhatsAppTemplate(
  toInfobip: string,
  firstName: string,
  templateName: string,
): Promise<SendResult> {
  const cfg = getInfobipConfig();
  return postTemplate(
    cfg,
    buildNamedTemplatePayload(cfg, toInfobip, firstName, templateName),
    templateName,
  );
}

export type BatchSendItem = {
  to: string;
  result: SendResult;
};

/**
 * Send one approved template to many recipients in a single Infobip request.
 * Results are aligned to the input order; a rejected member does not fail the rest.
 */
export async function sendNamedWhatsAppTemplateBatch(
  recipients: Array<{ to: string; firstName: string }>,
  templateName: string,
): Promise<BatchSendItem[]> {
  if (recipients.length === 0) return [];
  if (recipients.length === 1) {
    const result = await sendNamedWhatsAppTemplate(
      recipients[0].to,
      recipients[0].firstName,
      templateName,
    );
    return [{ to: recipients[0].to, result }];
  }

  const cfg = getInfobipConfig();
  const payload = buildNamedTemplateBatchPayload(cfg, recipients, templateName);
  const parsed = await postTemplateRaw(cfg, payload, templateName);
  if (!parsed.ok) {
    return recipients.map((r) => ({
      to: r.to,
      result: { ok: false, error: "WHATSAPP_SEND_FAILED" },
    }));
  }

  const byTo = new Map<string, SendResult>();
  for (const msg of parsed.messages) {
    const to = msg.to || "";
    if (!to) continue;
    if (msg.status && (msg.status.groupId === 2 || msg.status.groupId === 5)) {
      byTo.set(to, { ok: false, error: "WHATSAPP_SEND_FAILED" });
    } else {
      byTo.set(to, { ok: true, providerMessageId: msg.messageId });
    }
  }

  return recipients.map((r, i) => {
    const mapped = byTo.get(r.to);
    if (mapped) return { to: r.to, result: mapped };
    const byIndex = parsed.messages[i];
    if (
      byIndex?.status &&
      (byIndex.status.groupId === 2 || byIndex.status.groupId === 5)
    ) {
      return { to: r.to, result: { ok: false, error: "WHATSAPP_SEND_FAILED" } };
    }
    return {
      to: r.to,
      result: { ok: true, providerMessageId: byIndex?.messageId },
    };
  });
}

type InfobipMessageStatus = {
  to?: string;
  messageId?: string;
  status?: {
    groupId?: number;
    groupName?: string;
    name?: string;
    description?: string;
  };
};

type PostTemplateRaw =
  | { ok: false }
  | { ok: true; messages: InfobipMessageStatus[] };

async function postTemplateRaw(
  cfg: InfobipConfig,
  payload: InfobipTemplatePayload,
  kind: string,
): Promise<PostTemplateRaw> {
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
    return { ok: false };
  }

  if (!res.ok) {
    let providerDetail = "";
    try {
      const data = (await res.json()) as {
        requestError?: {
          serviceException?: {
            messageId?: string;
            text?: string;
            message?: string;
          };
        };
        messages?: Array<{
          status?: { groupName?: string; name?: string; description?: string };
        }>;
      };
      const ex = data?.requestError?.serviceException;
      const status = data?.messages?.[0]?.status;
      providerDetail =
        (ex &&
          [ex.messageId, ex.text || ex.message].filter(Boolean).join(" — ")) ||
        (status &&
          [status.groupName, status.name, status.description]
            .filter(Boolean)
            .join(" / ")) ||
        "";
    } catch {
      /* ignore body parse errors */
    }
    console.error(
      `[whatsapp-${kind}] Infobip send failed: HTTP ${res.status}` +
        (providerDetail ? ` (${providerDetail})` : ""),
    );
    return { ok: false };
  }

  try {
    const data = (await res.json()) as { messages?: InfobipMessageStatus[] };
    return { ok: true, messages: data.messages || [] };
  } catch {
    return { ok: true, messages: [] };
  }
}

async function postTemplate(
  cfg: InfobipConfig,
  payload: InfobipTemplatePayload,
  kind: string,
): Promise<SendResult> {
  const parsed = await postTemplateRaw(cfg, payload, kind);
  if (!parsed.ok) return { ok: false, error: "WHATSAPP_SEND_FAILED" };
  const msg = parsed.messages[0];
  const status = msg?.status;
  if (status && (status.groupId === 2 || status.groupId === 5)) {
    console.error(
      `[whatsapp-${kind}] Infobip rejected message: ${status.groupName}/${status.name} — ${status.description}`,
    );
    return { ok: false, error: "WHATSAPP_SEND_FAILED" };
  }
  return { ok: true, providerMessageId: msg?.messageId };
}
