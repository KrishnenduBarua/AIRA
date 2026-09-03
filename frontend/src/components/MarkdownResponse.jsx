function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-bold-${index}`}>{part.slice(2, -2)}</strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded bg-slate-200 px-1 py-0.5 text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function normalizeLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+-\s+(?=\*\*)/g, "\n- ")
    .split("\n");
}

export default function MarkdownResponse({ children }) {
  const lines = normalizeLines(children);
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (bullet || numbered) {
      flushParagraph();
      list.push({
        ordered: Boolean(numbered),
        text: (bullet || numbered)[1],
      });
    } else if (/^#{1,3}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: trimmed.replace(/^#{1,3}\s+/, "") });
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  });

  flushParagraph();
  flushList();

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h4
              key={`heading-${index}`}
              className="text-sm font-bold text-slate-900"
            >
              {renderInline(block.text, `heading-${index}`)}
            </h4>
          );
        }

        if (block.type === "list") {
          const ListTag = block.items[0]?.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`list-${index}`}
              className={`${ListTag === "ol" ? "list-decimal" : "list-disc"} space-y-1.5 pl-5`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>
                  {renderInline(item.text, `item-${index}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`paragraph-${index}`}>
            {renderInline(block.text, `paragraph-${index}`)}
          </p>
        );
      })}
    </div>
  );
}
