// ─── markdown ↔ html ──────────────────────────────────────────────────────────

function sanitizeHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t) || /^tel:/i.test(t))
    return t.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return "#";
}

function applyInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, txt, url) => `<a href="${sanitizeHref(url)}">${txt}</a>`);
}

export function markdownToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (/^## /.test(line))  { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (/^# /.test(line))   { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h1>${line.slice(2)}</h1>`); continue; }
    if (/^---+$/.test(line.trim())) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<hr>"); continue; }
    if (/^[-*] /.test(line)) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${applyInline(line.slice(2))}</li>`);
      continue;
    }
    if (inUl && line.trim() === "") { out.push("</ul>"); inUl = false; }
    if (line.trim() === "") { out.push("<br>"); }
    else { out.push(`<p>${applyInline(line)}</p>`); }
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const kids = Array.from(el.childNodes).map(walk).join("");
    switch (tag) {
      case "h1": return `# ${kids.trim()}\n\n`;
      case "h2": return `## ${kids.trim()}\n\n`;
      case "h3": return `### ${kids.trim()}\n\n`;
      case "strong": case "b": return `**${kids}**`;
      case "em": case "i": return `*${kids}*`;
      case "code": return "`" + kids + "`";
      case "a": return `[${kids}](${el.getAttribute("href") ?? ""})`;
      case "br": return "\n";
      case "hr": return "\n---\n\n";
      case "li": return kids.trim();
      case "ul": return Array.from(el.children).map(li => `- ${walk(li)}`).join("\n") + "\n\n";
      case "ol": return Array.from(el.children).map((li, i) => `${i + 1}. ${walk(li)}`).join("\n") + "\n\n";
      case "p": { const t = kids.trim(); return t ? `${t}\n\n` : ""; }
      case "div": case "section": case "body": return kids + (kids.endsWith("\n") ? "" : "\n");
      default: return kids;
    }
  }
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}
