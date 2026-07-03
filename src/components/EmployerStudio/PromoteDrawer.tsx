import React, { useState } from "react";
import { X, Megaphone, Loader2, Copy, Check, Rocket, Sparkles, Star } from "lucide-react";
import type { EmployerJobListing, PromoAssets, PromoPack } from "@/types/employerListing";
import { LISTING_STATUSES, LISTING_STATUS_META, isBoostActive } from "@/types/employerListing";
import { generatePromoAssets, generateBoostedPromoPack } from "@/services/employerService";
import { primaryBtn, ghostBtn, pillBtn, featuredBadge } from "./styles";

interface Props {
  listing: EmployerJobListing;
  companyName: string;
  onUpdate: (patch: Partial<EmployerJobListing>) => Promise<void>;
  onBoostClick: () => void;
  onClose: () => void;
}

const AI_DOWN = "Couldn't reach the AI — is the gateway running?";

function CopyRow({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--muted)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--muted-foreground)",
          }}
        >
          {label}
        </span>
        <button onClick={copy} style={{ ...pillBtn, height: 26 }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{" "}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        style={{
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--foreground)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function PromoteDrawer({ listing, companyName, onUpdate, onBoostClick, onClose }: Props) {
  const [assets, setAssets] = useState<PromoAssets>(listing.promoAssets ?? {});
  const [pack, setPack] = useState<PromoPack | undefined>(listing.promoAssets?.pack);
  const [busy, setBusy] = useState<"assets" | "pack" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boosted = isBoostActive(listing.boostedUntil);
  const promoInput = {
    title: listing.title,
    companyName,
    location: listing.location,
    description: listing.description,
  };

  const runGenerateAssets = async () => {
    setBusy("assets");
    setError(null);
    try {
      const result = await generatePromoAssets(promoInput);
      setAssets((prev) => ({ ...prev, ...result }));
    } catch (err) {
      console.error(err);
      setError(AI_DOWN);
    } finally {
      setBusy(null);
    }
  };

  const runGeneratePack = async () => {
    setBusy("pack");
    setError(null);
    try {
      const result = await generateBoostedPromoPack(promoInput);
      setPack(result);
    } catch (err) {
      console.error(err);
      setError(AI_DOWN);
    } finally {
      setBusy(null);
    }
  };

  const saveToListing = async () => {
    await onUpdate({ promoAssets: { ...assets, ...(pack ? { pack } : {}) } });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex justify-end"
      style={{ background: "rgba(31,27,22,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-in slide-in-from-right duration-300"
        style={{
          width: "100%",
          maxWidth: 480,
          height: "100%",
          overflow: "auto",
          background: "var(--background)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--paper)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Megaphone className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Promote
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {listing.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              padding: 4,
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Status */}
          <section>
            <div
              style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}
            >
              Status
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LISTING_STATUSES.map((s) => {
                const active = listing.status === s;
                const meta = LISTING_STATUS_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => onUpdate({ status: s })}
                    style={{
                      ...pillBtn,
                      height: 32,
                      background: active ? meta.bg : "var(--card)",
                      borderColor: active ? meta.border : "var(--border)",
                      color: active ? meta.fg : "var(--muted-foreground)",
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Published listings can be surfaced to job seekers; a boost features them at the top of
              the seeker feed.
            </p>
          </section>

          {/* Boost */}
          <section
            style={{
              borderRadius: 14,
              border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
              background: "color-mix(in srgb, var(--primary) 6%, transparent)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Rocket className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                Boost
              </span>
              {boosted && (
                <span style={featuredBadge}>
                  <Star className="w-3 h-3" fill="currentColor" /> Featured
                </span>
              )}
            </div>
            {boosted ? (
              <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0, lineHeight: 1.5 }}>
                Featured until{" "}
                <strong>{new Date(listing.boostedUntil!).toLocaleDateString()}</strong>
                {listing.boostTier ? ` (${listing.boostTier} tier)` : ""}. Extend or change the
                package anytime.
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Feature this listing at the top of the studio and the seeker job feed, and unlock an
                AI-enhanced promo pack.
              </p>
            )}
            <button onClick={onBoostClick} style={{ ...primaryBtn, marginTop: 12, height: 40 }}>
              <Rocket className="w-4 h-4" /> {boosted ? "Manage boost" : "Boost listing"}
            </button>
          </section>

          {/* Promo assets */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                Promo content
              </span>
              <button
                onClick={runGenerateAssets}
                disabled={busy !== null}
                style={{
                  ...pillBtn,
                  color: "var(--primary)",
                  borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
                  opacity: busy ? 0.6 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy === "assets" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {assets.socialPost || assets.outreachEmail || assets.blurb
                  ? "Regenerate"
                  : "Generate"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {assets.blurb && <CopyRow label="One-line blurb" text={assets.blurb} />}
              {assets.socialPost && <CopyRow label="Social post" text={assets.socialPost} />}
              {assets.outreachEmail && (
                <CopyRow label="Outreach email" text={assets.outreachEmail} />
              )}
              {!assets.blurb && !assets.socialPost && !assets.outreachEmail && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Generate a ready-to-share social post, a candidate outreach email, and a one-line
                  teaser.
                </p>
              )}
            </div>
          </section>

          {/* Boosted AI promo pack */}
          {boosted && (
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--foreground)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Star
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--primary)" }}
                    fill="currentColor"
                  />{" "}
                  AI promo pack
                </span>
                <button
                  onClick={runGeneratePack}
                  disabled={busy !== null}
                  style={{
                    ...pillBtn,
                    color: "var(--primary)",
                    borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
                    opacity: busy ? 0.6 : 1,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy === "pack" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {pack ? "Regenerate" : "Generate pack"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pack?.linkedinPost && <CopyRow label="LinkedIn post" text={pack.linkedinPost} />}
                {pack?.twitterPost && <CopyRow label="X / Twitter" text={pack.twitterPost} />}
                {pack?.headlineVariants?.length ? (
                  <CopyRow label="Headline A/B" text={pack.headlineVariants.join("\n\n")} />
                ) : null}
                {pack?.targetingBlurbs?.length ? (
                  <CopyRow label="Targeted blurbs" text={pack.targetingBlurbs.join("\n\n")} />
                ) : null}
                {!pack && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted-foreground)",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    A premium multi-channel bundle: LinkedIn + X posts, A/B headlines, and
                    audience-targeted blurbs.
                  </p>
                )}
              </div>
            </section>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--destructive, #ef4444)" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={saveToListing} style={primaryBtn}>
              <Check className="w-4 h-4" /> Save to listing
            </button>
            <button onClick={onClose} style={ghostBtn}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
