function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function inviteEmail(opts: {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
}) {
  const ws = escapeHtml(opts.workspaceName);
  const inviter = escapeHtml(opts.inviterName);
  const url = escapeHtml(opts.acceptUrl);

  const subject = `${opts.inviterName} invited you to ${opts.workspaceName} on Neo`;

  const text = `${opts.inviterName} invited you to join "${opts.workspaceName}" on Neo.

Accept: ${opts.acceptUrl}

This link expires in 7 days. Reply to this email if you have questions.`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background:#fafafa; padding:32px; margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; margin:0 auto; background:#fff; border:1px solid #e5e5e5; border-radius:8px;">
    <tr><td style="padding:32px;">
      <h1 style="font-size:20px; margin:0 0 16px; color:#111;">You've been invited to ${ws}</h1>
      <p style="font-size:15px; color:#444; line-height:1.5; margin:0 0 24px;">
        ${inviter} invited you to join <strong>${ws}</strong> on Neo — the context engine for individuals and teams.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block; background:#111; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:500; font-size:14px;">Accept invitation</a>
      </p>
      <p style="font-size:13px; color:#888; margin:0;">This link expires in 7 days.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
