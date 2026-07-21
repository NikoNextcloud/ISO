function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

/** Минимален markdown → HTML за документите на системата. */
export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let listOpen = false;
  let olOpen = false;

  const closeLists = () => {
    if (listOpen) { out.push("</ul>"); listOpen = false; }
    if (olOpen) { out.push("</ol>"); olOpen = false; }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\|(.+)\|\s*$/.test(line)) {
      closeLists();
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length && /^\|(.+)\|\s*$/.test(lines[j])) {
        const cells = lines[j].trim().slice(1, -1).split("|").map((c) => c.trim());
        rows.push(cells);
        j++;
      }
      const isSep = (r: string[]) => r.every((c) => /^:?-{2,}:?$/.test(c));
      const body = rows.filter((r) => !isSep(r));
      out.push('<table><thead><tr>' + body[0].map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
      for (const r of body.slice(1)) out.push("<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      out.push("</tbody></table>");
      i = j;
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++; continue;
    }
    const li = line.match(/^-\s+(.*)$/);
    if (li) {
      if (olOpen) { out.push("</ol>"); olOpen = false; }
      if (!listOpen) { out.push("<ul>"); listOpen = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      i++; continue;
    }
    const oli = line.match(/^(\d+)\.\s+(.*)$/);
    if (oli) {
      if (listOpen) { out.push("</ul>"); listOpen = false; }
      if (!olOpen) { out.push("<ol>"); olOpen = true; }
      out.push(`<li>${inline(oli[2])}</li>`);
      i++; continue;
    }
    if (line.trim() === "---") { closeLists(); out.push("<hr/>"); i++; continue; }
    if (line.trim() === "") { closeLists(); i++; continue; }
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  closeLists();
  return out.join("\n");
}
