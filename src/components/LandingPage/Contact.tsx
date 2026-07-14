import { useState } from "react";
import { Mail, Check } from "lucide-react";

const inputStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

export function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <section id="contact" className="py-28 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <div>
          <p className="eyebrow-plain mb-4">Contact</p>
          <h2 className="font-display text-4xl font-medium tracking-tight mb-4">
            We'd love to hear from you
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Have feedback, a feature request, or a partnership inquiry? Drop us a note.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" style={{ color: "var(--primary)" }} />
            hello@techcoach.ai
          </div>
        </div>

        <div
          className="rounded-lg p-6 border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {sent ? (
            <div className="text-center py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(47,107,79,0.1)" }}
              >
                <Check className="w-6 h-6" style={{ color: "var(--forest)" }} />
              </div>
              <h3 className="font-semibold mb-2">Message sent!</h3>
              <p className="text-sm text-muted-foreground">
                We'll get back to you within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="text-xs font-medium text-muted-foreground block mb-1.5"
                >
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  style={{ ...inputStyle, height: 40, padding: "0 12px" }}
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="text-xs font-medium text-muted-foreground block mb-1.5"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  style={{ ...inputStyle, height: 40, padding: "0 12px" }}
                />
              </div>
              <div>
                <label
                  htmlFor="contact-message"
                  className="text-xs font-medium text-muted-foreground block mb-1.5"
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  required
                  rows={4}
                  style={{ ...inputStyle, padding: "10px 12px", resize: "none" }}
                />
              </div>
              <button
                type="submit"
                className="w-full font-medium py-3 rounded-md hover:opacity-90 transition-opacity text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  ["--tw-ring-color" as string]: "var(--ring)",
                }}
              >
                Send message
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
