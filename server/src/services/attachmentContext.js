const MAX_ATTACHMENTS = Number(process.env.MAX_CHAT_ATTACHMENTS || 4);
const MAX_ATTACHMENT_CHARS = Number(process.env.MAX_CHAT_ATTACHMENT_CHARS || 12000);

function sanitizeText(value, fallback = "") {
  return String(value || fallback).replace(/\r\n/g, "\n");
}

function compactName(value) {
  return String(value || "attachment.txt").trim().slice(0, 120) || "attachment.txt";
}

function compactLanguage(value) {
  return String(value || "text").trim().slice(0, 32) || "text";
}

export function sanitizeAttachments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_ATTACHMENTS)
    .map((attachment) => {
      const content = sanitizeText(attachment?.content).slice(0, MAX_ATTACHMENT_CHARS);
      if (!content.trim()) {
        return null;
      }

      return {
        id: String(attachment?.id || ""),
        name: compactName(attachment?.name),
        mimeType: String(attachment?.mimeType || "text/plain").slice(0, 80),
        size: Number(attachment?.size || content.length),
        language: compactLanguage(attachment?.language),
        truncated: Boolean(attachment?.truncated || content.length >= MAX_ATTACHMENT_CHARS),
        content
      };
    })
    .filter(Boolean);
}

export function extractMessageAttachments(message) {
  return sanitizeAttachments(message?.meta?.attachments);
}

export function messageHasAttachments(message) {
  return extractMessageAttachments(message).length > 0;
}

export function enrichMessagesWithAttachmentContext(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const attachments = extractMessageAttachments(message);
    if (attachments.length === 0) {
      return message;
    }

    const attachmentContext = attachments
      .map((attachment, index) => {
        const safeContent = attachment.content.replace(/```/g, "``\\`");
        return (
        [
          `[FILE_${index + 1}]`,
          `name=${attachment.name}`,
          `language=${attachment.language}`,
          `size=${attachment.size}`,
          attachment.truncated ? "truncated=yes" : "truncated=no",
          `content:\n\`\`\`${attachment.language}\n${safeContent}\n\`\`\``,
          `[/FILE_${index + 1}]`
        ].join("\n")
        );
      })
      .join("\n\n");

    return {
      ...message,
      content: `${String(message?.content || "")}\n\n[ATTACHED_FILES]\n${attachmentContext}\n[/ATTACHED_FILES]`
    };
  });
}
