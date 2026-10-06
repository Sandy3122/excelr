"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Info, Loader2 } from "lucide-react";
import { useAdminDrive } from "@/components/admin/drive-context";
import { AUTOMATION_KINDS, type AutomationKind } from "@/lib/automations/types";
import { AUTOMATION_META } from "@/lib/automations/catalog";
import type {
  DriveAutomationConfig,
  PlacementDriveConfig,
} from "@/lib/drives/types";

interface EffectiveWhatsApp {
  sender: string;
  language: string;
  otpTemplateName: string;
  otpUrlButtonParam: string;
  accountDefaults: {
    sender: string;
    language: string;
    otpTemplateName: string;
    otpUrlButtonParam: string;
  };
}

interface DriveResponse {
  ok?: boolean;
  error?: string;
  drive?: PlacementDriveConfig & { id: string };
  issues?: string[];
  effective?: EffectiveWhatsApp;
}

type Tab = "details" | "whatsapp" | "automations";

const TABS: { key: Tab; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "whatsapp", label: "WhatsApp & limits" },
  { key: "automations", label: "Automations" },
];

/**
 * Configuration for one placement drive. Everything the runtime reads about a
 * campaign is edited here; the server re-validates the whole document on save.
 */
function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value);
}

export default function DriveConfigPage({
  params,
}: {
  params: { driveId: string };
}) {
  const { reload } = useAdminDrive();
  // `?tab=automations` lets other pages deep-link straight to the right panel.
  const requestedTab = useSearchParams().get("tab");
  const [config, setConfig] = useState<PlacementDriveConfig | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [effective, setEffective] = useState<EffectiveWhatsApp | null>(null);
  const [tab, setTab] = useState<Tab>(isTab(requestedTab) ? requestedTab : "details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/drives/${params.driveId}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DriveResponse;
      if (!res.ok || !json.ok || !json.drive) {
        throw new Error(json.error || "Could not load the drive.");
      }
      const { id: _id, ...rest } = json.drive;
      setConfig(rest);
      setIssues(json.issues || []);
      setEffective(json.effective ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the drive.");
    } finally {
      setLoading(false);
    }
  }, [params.driveId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/drives/${params.driveId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as DriveResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not save.");
      setIssues(json.issues || []);
      setEffective(json.effective ?? null);
      setSaved(true);
      await reload();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function patch(next: Partial<PlacementDriveConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...next } : prev));
  }

  function patchAutomation(kind: AutomationKind, next: Partial<DriveAutomationConfig>) {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            automations: {
              ...prev.automations,
              [kind]: { ...prev.automations[kind], ...next },
            },
          }
        : prev,
    );
  }

  if (loading) {
    return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-white" />;
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error || "Drive not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <Link
        href="/admin/drives"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        All drives
      </Link>

      <h1 className="mt-3 font-heading text-2xl font-bold text-navy-900">
        {config.name}
      </h1>
      <p className="mt-1 text-sm text-muted">/{config.slug}</p>

      {issues.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Configuration needed before these can send
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
              tab === t.key
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {tab === "details" ? (
          <Card title="Drive">
            <Text
              label="Name"
              help="Shown in the dashboard drive selector and in admin notification emails. Example: Full Stack Placement Drive - BTM, Oct 2026."
              value={config.name}
              onChange={(name) => patch({ name })}
            />
            <Text
              label="Landing page path"
                  help="Must match the driveSlug declared by the landing page in code, without the leading slash. Example: fsd-oct-2026 serves /fsd-oct-2026."
              prefix="/"
              value={config.slug}
              onChange={(slug) => patch({ slug: slug.trim().toLowerCase() })}
              hint="Must match the landing page's driveSlug in code."
            />
            <Text
              label="Event key"
                  help="Identifier stored on every registration and sent to the webhook, so downstream systems can tell campaigns apart. Example: fsd-oct-2026."
              value={config.eventKey}
              onChange={(eventKey) => patch({ eventKey })}
              hint="Sent to the webhook and stored on each registration."
            />
            <Text
              label="Registration webhook URL"
                  help="Each new registration is POSTed here as JSON. Leave empty to disable. Example: https://excelr.app.n8n.cloud/webhook/…"
              value={config.webhookUrl}
              onChange={(webhookUrl) => patch({ webhookUrl })}
              hint="Leave empty to disable the webhook for this drive."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Text
                label="Venue latitude"
                help="Used to show how far each registrant's IP location is from the venue. Right-click the venue in Google Maps and click the coordinates to copy them. Example: 12.9166."
                type="number"
                value={config.venueLatitude == null ? "" : String(config.venueLatitude)}
                onChange={(v) =>
                  patch({ venueLatitude: v.trim() === "" || isNaN(Number(v)) ? null : Number(v) })
                }
              />
              <Text
                label="Venue longitude"
                help="Second half of the coordinates from Google Maps. Example: 77.6101."
                type="number"
                value={config.venueLongitude == null ? "" : String(config.venueLongitude)}
                onChange={(v) =>
                  patch({ venueLongitude: v.trim() === "" || isNaN(Number(v)) ? null : Number(v) })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text
                label="Event day (IST)"
                  help="The day the drive runs. Drives the cutoffs, the quiet-hours exemption, and auto-closes registrations once it has passed. Example: 09/10/2026."
                type="date"
                value={config.eventDayIstDate ?? ""}
                onChange={(v) => patch({ eventDayIstDate: v || null })}
              />
              <Text
                label="Day before (IST)"
                  help="The day before the event. Marks the start of the late window, where shorter delays apply. Example: 08/10/2026."
                type="date"
                value={config.dayBeforeIstDate ?? ""}
                onChange={(v) => patch({ dayBeforeIstDate: v || null })}
              />
            </div>
            <Toggle
              label="Accepting registrations"
                  help="Unticking closes the landing page immediately and makes the API reject submissions for this drive."
              hint="Turning this off closes the landing page and blocks the API."
              checked={config.enabled}
              onChange={(enabled) => patch({ enabled })}
            />
          </Card>
        ) : null}

        {tab === "whatsapp" ? (
          <>
            <Card title="Account settings">
              <div className="-mt-1 flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm text-muted">
                  These belong to the Infobip account, not to this campaign.
                  Leave a field blank to inherit the value from the environment;
                  fill it in only to override it for this drive.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      whatsapp: {
                        ...config.whatsapp,
                        sender: "",
                        language: "",
                        otpTemplateName: "",
                        otpUrlButtonParam: "",
                      },
                    })
                  }
                  className="shrink-0 rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  Clear overrides
                </button>
              </div>

              <Text
                label="OTP template name"
                value={config.whatsapp.otpTemplateName}
                onChange={(otpTemplateName) =>
                  patch({ whatsapp: { ...config.whatsapp, otpTemplateName } })
                }
                hint={
                  inherited(
                    config.whatsapp.otpTemplateName,
                    effective?.accountDefaults.otpTemplateName,
                    "INFOBIP_TEMPLATE_NAME",
                  ) ??
                  "Exact name as approved in Infobip. Matched by name and language; the numeric template ID is not used."
                }
              />
              <Text
                label="OTP URL button parameter"
                help={
                  'What is passed to the template\u2019s URL button. "otp" sends the ' +
                  'generated code, which is what the approved authentication ' +
                  'template expects; any other value is sent literally.'
                }
                value={config.whatsapp.otpUrlButtonParam}
                onChange={(otpUrlButtonParam) =>
                  patch({ whatsapp: { ...config.whatsapp, otpUrlButtonParam } })
                }
                hint={
                  inherited(
                    config.whatsapp.otpUrlButtonParam,
                    effective?.accountDefaults.otpUrlButtonParam,
                    "INFOBIP_TEMPLATE_URL_BUTTON_PARAM",
                  ) ??
                  '"otp" sends the generated code; any other value is sent literally.'
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text
                  label="Sender (WABA number)"
                  help="The WhatsApp Business number messages come from, in international format without a plus. Example: 918050162541."
                  value={config.whatsapp.sender}
                  onChange={(sender) =>
                    patch({ whatsapp: { ...config.whatsapp, sender } })
                  }
                  hint={inherited(
                    config.whatsapp.sender,
                    effective?.accountDefaults.sender,
                    "INFOBIP_WHATSAPP_SENDER",
                  )}
                />
                <Text
                  label="Template language"
                  help="Locale of the approved template. Must match Infobip exactly - a template approved as en but sent as en_IN is accepted and then never delivered. Example: en_IN."
                  value={config.whatsapp.language}
                  onChange={(language) =>
                    patch({ whatsapp: { ...config.whatsapp, language } })
                  }
                  hint={inherited(
                    config.whatsapp.language,
                    effective?.accountDefaults.language,
                    "INFOBIP_TEMPLATE_LANGUAGE",
                  )}
                />
              </div>

              {effective ? (
                <dl className="grid gap-x-6 gap-y-1 rounded-xl bg-[#F7F9FF] p-4 text-sm sm:grid-cols-2">
                  <p className="col-span-full mb-1 font-semibold text-navy-900">
                    What this drive will actually send with
                    <span className="ml-2 font-normal text-muted">
                      - updates as you type; press Save to apply
                    </span>
                  </p>
                  <Effective
                    label="Sender"
                    value={resolve(
                      config.whatsapp.sender,
                      effective.accountDefaults.sender,
                    )}
                    saved={effective.sender}
                  />
                  <Effective
                    label="Language"
                    value={resolve(
                      config.whatsapp.language,
                      effective.accountDefaults.language,
                    )}
                    saved={effective.language}
                  />
                  <Effective
                    label="OTP template"
                    value={resolve(
                      config.whatsapp.otpTemplateName,
                      effective.accountDefaults.otpTemplateName,
                    )}
                    saved={effective.otpTemplateName}
                  />
                  <Effective
                    label="OTP button param"
                    value={resolve(
                      config.whatsapp.otpUrlButtonParam,
                      effective.accountDefaults.otpUrlButtonParam,
                    )}
                    saved={effective.otpUrlButtonParam}
                  />
                </dl>
              ) : null}
            </Card>

            <Card title="OTP limits">
              <div className="grid gap-4 sm:grid-cols-2">
                <Num
                  label="OTP expiry (seconds)"
                  help="How long a code stays valid before the candidate must request a new one. Example: 300 = 5 minutes."
                  value={config.whatsapp.limits.otpExpirySeconds}
                  onChange={(v) => patchLimit(config, patch, "otpExpirySeconds", v)}
                />
                <Num
                  label="Resend cooldown (seconds)"
                  help="Minimum gap before the same number can request another code. Stops repeated taps burning your Infobip quota. Example: 60."
                  value={config.whatsapp.limits.resendCooldownSeconds}
                  onChange={(v) =>
                    patchLimit(config, patch, "resendCooldownSeconds", v)
                  }
                />
                <Num
                  label="Max verify attempts"
                  help="Wrong codes allowed before the OTP is destroyed and a new one must be requested. Example: 5."
                  value={config.whatsapp.limits.maxVerifyAttempts}
                  onChange={(v) => patchLimit(config, patch, "maxVerifyAttempts", v)}
                />
                <Num
                  label="Verified marker TTL (seconds)"
                  help="After verifying, how long the number stays verified so the form can still be submitted. Too short and a slow form-filler has to verify twice. Example: 900 = 15 minutes."
                  value={config.whatsapp.limits.verifiedTtlSeconds}
                  onChange={(v) => patchLimit(config, patch, "verifiedTtlSeconds", v)}
                />
                <Num
                  label="Max sends per phone / hour"
                  help="Cap on codes sent to one number in a rolling hour. Example: 5."
                  value={config.whatsapp.limits.maxSendsPerHour}
                  onChange={(v) => patchLimit(config, patch, "maxSendsPerHour", v)}
                />
                <Num
                  label="Max sends per IP / hour"
                  help="Cap on send requests from one IP address in a rolling hour - blunts scripted abuse from a single source. Example: 20."
                  value={config.whatsapp.limits.maxSendsPerIpPerHour}
                  onChange={(v) =>
                    patchLimit(config, patch, "maxSendsPerIpPerHour", v)
                  }
                />
              </div>
            </Card>

            <Card title="Quiet hours">
              <Toggle
                label="Hold WhatsApp overnight"
                hint="Messages due inside the window wait until it reopens."
                checked={config.whatsapp.quietHours.enabled}
                onChange={(enabled) =>
                  patch({
                    whatsapp: {
                      ...config.whatsapp,
                      quietHours: { ...config.whatsapp.quietHours, enabled },
                    },
                  })
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Num
                  label="Stops at (IST hour)"
                  help="Hour of the day, IST, when WhatsApp sending pauses. Example: 21 = messages due after 9 PM wait."
                  value={config.whatsapp.quietHours.startHourIst}
                  onChange={(startHourIst) =>
                    patch({
                      whatsapp: {
                        ...config.whatsapp,
                        quietHours: { ...config.whatsapp.quietHours, startHourIst },
                      },
                    })
                  }
                />
                <Num
                  label="Resumes at (IST hour)"
                  help="Hour of the day, IST, when sending resumes. Example: 8 = held messages go out from 8 AM."
                  value={config.whatsapp.quietHours.endHourIst}
                  onChange={(endHourIst) =>
                    patch({
                      whatsapp: {
                        ...config.whatsapp,
                        quietHours: { ...config.whatsapp.quietHours, endHourIst },
                      },
                    })
                  }
                />
              </div>
            </Card>
          </>
        ) : null}

        {tab === "automations"
          ? AUTOMATION_KINDS.map((kind) => {
              const automation = config.automations[kind];
              return (
                <Card key={kind} title={AUTOMATION_META[kind].title}>
                  <Toggle
                    label="Enabled"
                    help="Turns this automation on or off for this drive. When off nothing sends - not on the schedule, and not from a manual send on the Automations page."
                    hint={
                      automation.enabled
                        ? "The cron and admin sends will run this automation."
                        : "Turned off - nothing will send, however it is triggered."
                    }
                    checked={automation.enabled}
                    onChange={(enabled) => patchAutomation(kind, { enabled })}
                  />

                  <div className="flex flex-wrap gap-4">
                    {(["whatsapp", "email"] as const).map((channel) => (
                      <label key={channel} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={automation.channels.includes(channel)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...automation.channels, channel]
                              : automation.channels.filter((c) => c !== channel);
                            if (next.length === 0) return;
                            patchAutomation(kind, { channels: next });
                          }}
                        />
                        {channel === "whatsapp" ? "WhatsApp" : "Email"}
                      </label>
                    ))}
                  </div>

                  <Text
                    label="WhatsApp template name"
                    help={
                      "The template name exactly as approved in Infobip. " +
                      "Infobip matches on name + language; the numeric template ID is not used. " +
                      "Example: fsd_placement_drive_confirmation_oct2026_a"
                    }
                    value={automation.whatsappTemplateName}
                    onChange={(whatsappTemplateName) =>
                      patchAutomation(kind, { whatsappTemplateName })
                    }
                    hint={
                      automation.whatsappTemplateName.trim()
                        ? "Exact name as approved in Infobip. Templates are matched by name and language - the numeric template ID is not used."
                        : "Required - this automation will fail to send until it is set."
                    }
                  />

                  <ScheduleFields
                    automation={automation}
                    onChange={(next) => patchAutomation(kind, next)}
                  />

                  {automation.channels.includes("email") ? (
                    <Text
                      label="Email subject"
                      help="Subject line of the email this automation sends. Example: You're confirmed: Full Stack Placement Drive - BTM"
                      value={automation.emailSubject ?? ""}
                      onChange={(v) =>
                        patchAutomation(kind, { emailSubject: v || null })
                      }
                    />
                  ) : null}

                  <Text
                    label="Schedule summary (shown in the dashboard)"
                    help="Free text shown on the Automations dashboard and nowhere else. Purely descriptive - editing it does not change when the message sends."
                    value={automation.scheduleLabel}
                    onChange={(scheduleLabel) =>
                      patchAutomation(kind, { scheduleLabel })
                    }
                  />
                </Card>
              );
            })
          : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-slate-200 bg-[#F4F6FB] py-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn-gradient px-6 py-3 text-sm disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save configuration"
          )}
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" />
            Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}

function patchLimit(
  config: PlacementDriveConfig,
  patch: (next: Partial<PlacementDriveConfig>) => void,
  key: keyof PlacementDriveConfig["whatsapp"]["limits"],
  value: number,
) {
  patch({
    whatsapp: {
      ...config.whatsapp,
      limits: { ...config.whatsapp.limits, [key]: value },
    },
  });
}

function ScheduleFields({
  automation,
  onChange,
}: {
  automation: DriveAutomationConfig;
  onChange: (next: Partial<DriveAutomationConfig>) => void;
}) {
  const { schedule } = automation;
  return (
    <div className="space-y-4 rounded-xl bg-[#F7F9FF] p-4">
      <div>
        <FieldLabel
          label="When it sends"
          help={
            "Immediately on registration - sent the moment the form is submitted. " +
            "A delay after registering - each lead gets it N minutes after they sign up. " +
            "At a fixed IST date and time - the same moment for everyone, e.g. 8 Oct 2026, 12:00 PM."
          }
        />
        <select
          className="field-input"
          value={schedule.type}
          onChange={(e) => {
            const type = e.target.value as typeof schedule.type;
            if (type === "immediate") onChange({ schedule: { type } });
            else if (type === "delay_after_register") {
              onChange({ schedule: { type, delayMinutes: 60 } });
            } else {
              onChange({
                schedule: {
                  type,
                  atIst: "2026-01-01T12:00:00",
                  lateDelayMinutes: 15,
                },
              });
            }
          }}
        >
          <option value="immediate">Immediately on registration</option>
          <option value="delay_after_register">A delay after registering</option>
          <option value="at">At a fixed IST date and time</option>
        </select>
      </div>

      {schedule.type === "delay_after_register" ? (
        <Num
          label="Delay (minutes)"
          help="How long after someone registers this is sent. Example: 60 sends it one hour after they sign up."
          value={schedule.delayMinutes}
          onChange={(delayMinutes) =>
            onChange({ schedule: { ...schedule, delayMinutes } })
          }
        />
      ) : null}

      {schedule.type === "at" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Send at (IST)"
            help="The fixed moment everyone receives this, in IST. Example: 08/10/2026 12:00 PM."
            type="datetime-local"
            value={schedule.atIst.slice(0, 16)}
            onChange={(v) =>
              onChange({ schedule: { ...schedule, atIst: `${v}:00` } })
            }
          />
          <Num
            label="Late signup delay (minutes)"
            help="For someone who registers after the fixed time has already passed, so they still get it. Example: 15 sends it 15 minutes after they sign up."
            value={schedule.lateDelayMinutes}
            onChange={(lateDelayMinutes) =>
              onChange({ schedule: { ...schedule, lateDelayMinutes } })
            }
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Hard cutoff (IST)"
          help={
            "Never send at or after this moment, even if the message is still due - it is marked skipped instead. " +
            "Example: 10/10/2026 08:30 PM stops all sends once the drive has ended. Leave empty for no cutoff."
          }
          type="datetime-local"
          value={automation.cutoffIst?.slice(0, 16) ?? ""}
          onChange={(v) => onChange({ cutoffIst: v ? `${v}:00` : null })}
        />
        <Text
          label="Skip registrations on or after (IST date)"
          help={
            "Leads who registered on or after this date never receive this message. " +
            "Example: set 09/10/2026 on the day-before reminder so someone signing up on event day is not told the drive is tomorrow. " +
            "Leave empty to send to everyone."
          }
          type="date"
          value={automation.skipOnOrAfterIstDate ?? ""}
          onChange={(v) => onChange({ skipOnOrAfterIstDate: v || null })}
        />
        <Num
          label="Late window delay (minutes)"
          help={
            "A shorter delay used only when someone registers on the day before or the day of the event, so a late signup still gets it in time. " +
            "Example: 10 turns a normal 60-minute delay into 10 minutes. 0 means no shortening."
          }
          value={automation.lateWindowDelayMinutes ?? 0}
          onChange={(v) => onChange({ lateWindowDelayMinutes: v || null })}
        />
        <Num
          label="Last-chance delay (minutes)"
          help={
            "The shortest delay, for event-day signups who would otherwise miss the hard cutoff. " +
            "It ignores the cutoff so the message still goes out. Example: 5. 0 means no last-chance send."
          }
          value={automation.lastChanceDelayMinutes ?? 0}
          onChange={(v) => onChange({ lastChanceDelayMinutes: v || null })}
        />
      </div>

      <div>
        <FieldLabel
          label="Wait for"
          help={
            "Holds this message until another automation has finished for the same lead, so two messages do not land together. " +
            "Example: the day-before reminder waits for Things to carry."
          }
        />
        <select
          className="field-input"
          value={automation.waitForKind ?? ""}
          onChange={(e) =>
            onChange({
              waitForKind: (e.target.value || null) as DriveAutomationConfig["waitForKind"],
            })
          }
        >
          <option value="">Nothing - send as soon as it is due</option>
          {AUTOMATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {AUTOMATION_META[k].title} has finished
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Hint for an account-level field.
 *
 * Blank means it inherits. A value that *differs* from the account default is
 * called out loudly: a stale override silently shadowing a changed environment
 * value is exactly how a working OTP send breaks after an Infobip account
 * swap, with nothing in the UI to show why.
 */
function inherited(
  value: string,
  accountValue: string | undefined,
  envVar: string,
): string | undefined {
  const v = value.trim();
  const account = (accountValue || "").trim();
  if (!v) {
    return account
      ? `Inheriting "${account}" from ${envVar}.`
      : `Not set here or in ${envVar}.`;
  }
  if (account && v !== account) {
    return `⚠ Overriding the account default "${account}" (${envVar}). This drive will use "${v}". Clear the field to use the account value.`;
  }
  return undefined;
}

/** Drive value if set, otherwise the account default - the same rule the server applies. */
function resolve(driveValue: string, accountValue: string): string {
  return (driveValue || accountValue).trim();
}

/**
 * One resolved setting. `value` follows the form as you type; `saved` is what
 * is currently stored. Showing the difference matters - otherwise this panel
 * still reads the old template while you are looking at a cleared field,
 * which is exactly when you need to trust it.
 */
function Effective({
  label,
  value,
  saved,
}: {
  label: string;
  value: string;
  saved?: string;
}) {
  const pending = saved !== undefined && saved.trim() !== value;
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className="min-w-0 break-all font-medium text-ink">
        {value || <span className="text-red-600">not set</span>}
        {pending ? (
          <span className="ml-1.5 whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            unsaved
          </span>
        ) : null}
      </dd>
    </div>
  );
}

// ─── Small field primitives ────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
      <h2 className="font-heading font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Hover/focus help for a field. Pure CSS so there is no popover state to keep
 * in sync; `group-focus-within` means it also opens from the keyboard, and the
 * label text is on the trigger for screen readers.
 */
function FieldHelp({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        onClick={(e) => e.preventDefault()}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-navy-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-lg bg-navy-900 px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-card-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Label plus its optional help bubble. */
function FieldLabel({
  label,
  help,
  htmlFor,
}: {
  label: string;
  help?: string;
  htmlFor?: string;
}) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {help ? <FieldHelp text={help} /> : null}
    </span>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  help,
  type = "text",
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  help?: string;
  type?: string;
  prefix?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} help={help} />
      <div className="flex items-center gap-2">
        {prefix ? <span className="text-sm text-muted">{prefix}</span> : null}
        <input
          type={type}
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? (
        <p
          className={`mt-1.5 text-xs ${
            hint.startsWith("\u26a0")
              ? "font-medium text-amber-700"
              : "text-muted"
          }`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  help?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} help={help} />
      <input
        type="number"
        className="field-input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  help?: string;
}) {
  return (
    <div>
      <span className="flex items-center gap-1.5">
        <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          {label}
        </label>
        {help ? <FieldHelp text={help} /> : null}
      </span>
      {hint ? <p className="mt-1.5 pl-6 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
