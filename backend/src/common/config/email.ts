// Email transport stub. Verification + password-reset flows are deferred (see plan
// "Deferred to Follow-Up Work"); this keeps a single seam to wire a provider later.

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (email: OutboundEmail): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[email:stub] → ${email.to} :: ${email.subject}`);
    return;
  }
  // TODO: integrate a provider (Resend/SES) when verification/reset flows ship.
  console.warn('[email:stub] sendEmail called in production but no provider configured');
};
