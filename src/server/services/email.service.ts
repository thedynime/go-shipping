import { Resend } from 'resend';
import { AuditService } from './audit.service';

// Helper to get Resend instance and configuration dynamically
function getResendContext(): {
  client: Resend | null;
  apiKey: string;
  fromName: string;
  fromEmail: string;
  opsEmail: string;
} {
  if (!process.env.RESEND_API_KEY && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {}
  }

  const apiKey = process.env.RESEND_API_KEY || '';
  return {
    client: apiKey ? new Resend(apiKey) : null,
    apiKey,
    fromName: process.env.EMAIL_FROM_NAME || 'GoShipping Express',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'notifications@send.goshipping.com.bd',
    opsEmail: process.env.EMAIL_OPS_ADDRESS || 'ops@goshipping.com.bd'
  };
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export class EmailService {
  /**
   * Check if Resend is configured
   */
  static isConfigured(): boolean {
    return Boolean(getResendContext().apiKey);
  }

  /**
   * Get the configured sender email address
   */
  static getFromEmail(): string {
    return getResendContext().fromEmail;
  }

  /**
   * Get the configured ops alert desk email address
   */
  static getOpsEmail(): string {
    return getResendContext().opsEmail;
  }

  /**
   * Get the formatted branded From header (e.g. "GoShipping Express <notifications@send.goshipping.com.bd>")
   */
  static getFromHeader(): string {
    const { fromName, fromEmail } = getResendContext();
    return `"${fromName}" <${fromEmail}>`;
  }

  /**
   * Core dispatch function using Resend API with domain validation & audit telemetry
   */
  static async sendMail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string; fallback?: boolean }> {
    const { client, apiKey, fromEmail, opsEmail } = getResendContext();
    if (!client || !apiKey) {
      console.warn('[EmailService] RESEND_API_KEY is not configured in environment. Email suppressed.');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const fromAddress = this.getFromHeader();
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const response = await client.emails.send({
        from: fromAddress,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        replyTo: options.replyTo || 'support@goshipping.com.bd'
      });

      if (response.error) {
        console.error('[EmailService] Resend API error response:', response.error);

        // Check if error is due to unverified custom domain
        const errMsg = response.error.message || '';
        const isDomainUnverified =
          response.error.name === 'validation_error' ||
          errMsg.toLowerCase().includes('not verified') ||
          errMsg.toLowerCase().includes('domain');

        if (isDomainUnverified) {
          console.warn(`[EmailService] Sender domain (${fromEmail}) is pending DNS verification on Hostinger. Delivering test copy to verified account (goshippingbd@gmail.com) via onboarding@resend.dev...`);

          try {
            const adminNoticeHtml = `
              <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="margin-bottom: 8px;">
                  <span style="background-color: #D97706; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                    Resend Sandbox Forward
                  </span>
                  <span style="font-size: 12px; font-weight: 600; color: #92400E; margin-left: 6px;">
                    Hostinger DNS Verification Pending
                  </span>
                </div>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #92400E; line-height: 1.5;">
                  This transactional email was generated for recipient: <strong style="color: #78350F;">${recipients.join(', ')}</strong>.
                </p>
                <p style="margin: 0; font-size: 12px; color: #B45309; line-height: 1.4;">
                  Because <code>send.goshipping.com.bd</code> DKIM &amp; SPF records are awaiting DNS verification in Hostinger, Resend forwarded this email to your verified account (<code>goshippingbd@gmail.com</code>). Once Hostinger DNS records are active, emails will dispatch directly to all user inboxes without forward notice.
                </p>
              </div>
            `;

            const fallbackResponse = await client.emails.send({
              from: 'GoShipping Express <onboarding@resend.dev>',
              to: ['goshippingbd@gmail.com'],
              subject: `[FORWARD TO: ${recipients.join(', ')}] ${options.subject}`,
              html: adminNoticeHtml + options.html,
              text: `[Intended Recipient: ${recipients.join(', ')}]\n\n` + (options.text || this.stripHtml(options.html))
            });

            if (fallbackResponse.data?.id) {
              console.log(`[EmailService] Resend fallback dispatch succeeded! ID: ${fallbackResponse.data.id} delivered to goshippingbd@gmail.com`);

              await AuditService.logAction({
                action: 'EMAIL_DISPATCHED_FALLBACK',
                entityType: 'email',
                entityId: fallbackResponse.data.id,
                details: {
                  intendedRecipients: recipients,
                  deliveredTo: 'goshippingbd@gmail.com',
                  subject: options.subject,
                  resendId: fallbackResponse.data.id,
                  reason: 'Custom domain pending Hostinger DNS verification'
                }
              });

              return {
                success: true,
                id: fallbackResponse.data.id,
                fallback: true,
                error: `Delivered to admin (goshippingbd@gmail.com) via Resend Sandbox pending Hostinger DNS verification.`
              };
            }
          } catch (fallbackErr: any) {
            console.error('[EmailService] Fallback dispatch failed:', fallbackErr);
          }
        }

        // Record failed attempt in audit log for observability
        await AuditService.logAction({
          action: 'EMAIL_SEND_FAILED',
          entityType: 'email',
          details: {
            to: recipients,
            subject: options.subject,
            from: fromAddress,
            errorCode: response.error.name,
            errorMessage: response.error.message
          }
        });

        return { success: false, error: response.error.message };
      }

      console.log(`[EmailService] Email dispatched successfully! ID: ${response.data?.id} to ${recipients.join(', ')}`);

      // Record successful delivery in audit log
      await AuditService.logAction({
        action: 'EMAIL_DISPATCHED',
        entityType: 'email',
        entityId: response.data?.id || undefined,
        details: {
          to: recipients,
          subject: options.subject,
          from: fromAddress,
          emailId: response.data?.id
        }
      });

      return { success: true, id: response.data?.id };
    } catch (err: any) {
      console.error('[EmailService] Unexpected error sending email via Resend:', err);
      return { success: false, error: err.message || 'Network error sending email' };
    }
  }

  /**
   * Simple HTML to plain-text converter for email fallback
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Base responsive HTML wrapper matching GoShipping's brand identity
   */
  private static renderBaseTemplate(title: string, preheader: string, contentHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F4F6F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #11181E; }
    table { border-collapse: collapse; }
    a { color: #EA1D2C; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F4F6F9;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <!-- Brand Header -->
    <tr>
      <td style="background-color: #11181E; padding: 20px 28px; border-bottom: 3px solid #EA1D2C;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                GO<span style="color: #EA1D2C;">SHIPPING</span>
              </span>
              <span style="display: block; font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                International Freight &amp; Supply Chain Logistics
              </span>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 4px 10px; background-color: rgba(234, 29, 44, 0.15); border: 1px solid rgba(234, 29, 44, 0.3); border-radius: 4px; color: #F87171; font-size: 11px; font-weight: 700; font-family: monospace;">
                24/7 Live Telemetry
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Content Body -->
    <tr>
      <td style="padding: 32px 28px;">
        ${contentHtml}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 24px 28px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #6B7280; line-height: 1.6;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">
          GoShipping Logistics Ltd &bull; China to Bangladesh Express Cargo Gateway
        </p>
        <p style="margin: 0 0 12px 0;">
          <strong>Dhaka Receiving:</strong> Cargo Village, Hazrat Shahjalal Int'l Airport (HSIA), Dhaka-1229<br>
          <strong>China CFS:</strong> Baiyun Logistics Park, Guangzhou &bull; Yiwu Trade City, Zhejiang
        </p>
        <p style="margin: 0; font-size: 10px; color: #9CA3AF;">
          You received this automated transaction notification because your email is registered with GoShipping. For assistance, contact our 24/7 Operations Desk at <a href="mailto:support@goshipping.com.bd" style="color: #EA1D2C; font-weight: 600;">support@goshipping.com.bd</a>.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * 1. Send Quotation Request Confirmation to Customer
   */
  static async sendQuoteConfirmation(quote: {
    quoteNumber: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    originCity: string;
    originCountry: string;
    destCity: string;
    destCountry: string;
    mode: string;
    cargoDescription?: string;
    totalWeightKg?: number;
    totalCbm?: number;
    totalPieces?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const subject = `Quotation Received: ${quote.quoteNumber} (${quote.originCity} to ${quote.destCity})`;
    const preheader = `We have received your freight quotation inquiry ${quote.quoteNumber}. Our pricing desk is evaluating tariff rates.`;

    const htmlContent = `
      <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #11181E;">
        Thank You, ${quote.guestName}!
      </h2>
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #4B5563; line-height: 1.5;">
        Your freight shipping quotation inquiry has been registered in our operations queue. Our commercial pricing team is reviewing carrier schedules and applicable customs tariffs.
      </p>

      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 40%;">Quote Reference:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #11181E; font-family: monospace;">${quote.quoteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Routing:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #11181E;">${quote.originCity}, ${quote.originCountry} &rarr; ${quote.destCity}, ${quote.destCountry}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Transport Mode:</td>
            <td style="padding: 6px 0; font-weight: 600; text-transform: uppercase; color: #EA1D2C;">${quote.mode} Freight</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Declared Cargo:</td>
            <td style="padding: 6px 0; color: #11181E;">${quote.cargoDescription || 'Commercial Merchandise'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Chargeable Volume:</td>
            <td style="padding: 6px 0; color: #11181E;">${quote.totalWeightKg || 0} KG &bull; ${quote.totalCbm || 0} CBM (${quote.totalPieces || 1} Pcs)</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #FEF2F2; border-left: 4px solid #EA1D2C; padding: 14px 16px; margin-bottom: 24px; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; font-size: 12px; color: #991B1B; line-height: 1.5;">
          <strong>What happens next:</strong> Our sales &amp; operations desk will calculate base freight, airline/vessel surcharges, and customs clearance fees. You will receive an itemized tariff breakdown within 2–4 business hours.
        </p>
      </div>

      <div style="text-align: center; margin-top: 28px;">
        <a href="https://goshipping.com.bd/login" style="display: inline-block; background-color: #EA1D2C; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Quote in Customer Portal &rarr;
        </a>
      </div>
    `;

    return this.sendMail({
      to: quote.guestEmail,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 2. Send New Quote Alert to Operations & Sales Team
   */
  static async sendQuoteAlertToOps(quote: {
    quoteNumber: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    companyName?: string;
    originCity: string;
    destCity: string;
    mode: string;
    totalWeightKg?: number;
    totalCbm?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const subject = `[ACTION REQUIRED] New Rate Inquiry: ${quote.quoteNumber} from ${quote.guestName}`;
    const preheader = `A new freight quotation request ${quote.quoteNumber} has been submitted and is pending commercial pricing.`;

    const htmlContent = `
      <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #11181E;">
        New Commercial Freight Inquiry
      </h3>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #4B5563;">
        A customer has submitted a new shipping rate inquiry through the GoShipping portal. Please review and apply tariff pricing.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; font-size: 13px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 4px 0; color: #6B7280; width: 35%;">Quote Number:</td>
          <td style="padding: 4px 0; font-weight: 700; font-family: monospace;">${quote.quoteNumber}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Client:</td>
          <td style="padding: 4px 0; font-weight: 600;">${quote.guestName} (${quote.companyName || 'Individual Importer'})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Contact:</td>
          <td style="padding: 4px 0;">${quote.guestEmail} &bull; ${quote.guestPhone || 'No phone'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Routing:</td>
          <td style="padding: 4px 0; font-weight: 600;">${quote.originCity} &rarr; ${quote.destCity} (${quote.mode.toUpperCase()})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Chargeable Volume:</td>
          <td style="padding: 4px 0;">${quote.totalWeightKg || 0} KG / ${quote.totalCbm || 0} CBM</td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="https://goshipping.com.bd/admin?tab=quotes" style="display: inline-block; background-color: #11181E; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Open Ops Pricing Desk &rarr;
        </a>
      </div>
    `;

    return this.sendMail({
      to: this.getOpsEmail(),
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 3. Send Master Consignment Booking Confirmation to Customer
   */
  static async sendShipmentBookedNotification(shipment: {
    trackingNumber: string;
    productName: string;
    customerName: string;
    customerEmail?: string;
    recipientName: string;
    recipientPhone?: string;
    recipientAddress: string;
    originCity: string;
    originCountry: string;
    destCity: string;
    destCountry: string;
    mode: string;
    carrierName?: string;
    voyageOrFlightNumber?: string;
    totalWeightKg?: number;
    totalPieces?: number;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!shipment.customerEmail) {
      console.warn(`[EmailService] No recipient email specified for shipment ${shipment.trackingNumber}`);
      return { success: false, error: 'Customer email missing' };
    }

    const subject = `Consignment Dispatched: ${shipment.trackingNumber} (${shipment.productName})`;
    const preheader = `Your commercial consignment ${shipment.trackingNumber} has been officially booked and dispatched with ${shipment.carrierName || 'GoShipping Carrier'}.`;

    const htmlContent = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 20px; color: #065F46; font-size: 12px; font-weight: 700;">
          &#10003; Consignment Booked &amp; Registered
        </span>
        <h2 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800; color: #11181E;">
          Tracking #: <span style="color: #EA1D2C; font-family: monospace;">${shipment.trackingNumber}</span>
        </h2>
        <p style="margin: 0; font-size: 13px; color: #4B5563;">
          ${shipment.productName}
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; font-size: 13px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280; width: 35%;">Origin Depot:</td>
          <td style="padding: 6px 0; font-weight: 600;">${shipment.originCity}, ${shipment.originCountry}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Destination Depot:</td>
          <td style="padding: 6px 0; font-weight: 600;">${shipment.destCity}, ${shipment.destCountry}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Carrier / Vessel:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #11181E;">${shipment.carrierName || 'Scheduled Freight Carrier'} (${shipment.voyageOrFlightNumber || 'Direct Transit'})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Consignment Cargo:</td>
          <td style="padding: 6px 0;">${shipment.totalWeightKg || 0} KG &bull; ${shipment.totalPieces || 1} Packages</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Consignee Delivery:</td>
          <td style="padding: 6px 0;">${shipment.recipientName} (${shipment.recipientPhone || ''})<br><span style="font-size: 11px; color: #6B7280;">${shipment.recipientAddress}</span></td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0 10px 0;">
        <a href="https://goshipping.com.bd/tracking?code=${shipment.trackingNumber}" style="display: inline-block; background-color: #EA1D2C; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 6px; text-decoration: none; box-shadow: 0 2px 4px rgba(234,29,44,0.2);">
          Track Consignment in Real-Time &rarr;
        </a>
      </div>
    `;

    return this.sendMail({
      to: shipment.customerEmail,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 4. Send Live Tracking Milestone Update to Customer
   */
  static async sendTrackingMilestoneUpdate(event: {
    trackingNumber: string;
    productName: string;
    customerEmail?: string;
    statusCode: string;
    statusLabel: string;
    locationName: string;
    description: string;
    occurredAtBst: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!event.customerEmail) {
      return { success: false, error: 'Recipient email missing' };
    }

    const subject = `Update on ${event.trackingNumber}: ${event.statusLabel}`;
    const preheader = `Status updated for ${event.trackingNumber}: ${event.statusLabel} at ${event.locationName} (${event.occurredAtBst}).`;

    const htmlContent = `
      <div style="border-left: 4px solid #EA1D2C; padding-left: 16px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #EA1D2C; letter-spacing: 0.5px;">
          Milestone Checkpoint
        </span>
        <h2 style="margin: 4px 0; font-size: 20px; font-weight: 800; color: #11181E;">
          ${event.statusLabel}
        </h2>
        <p style="margin: 0; font-size: 13px; color: #6B7280;">
          Tracking Number: <strong style="font-family: monospace; color: #11181E;">${event.trackingNumber}</strong>
        </p>
      </div>

      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; font-size: 13px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 30%;">Recorded Time:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #11181E;">${event.occurredAtBst}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Location:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #11181E;">${event.locationName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Details:</td>
            <td style="padding: 6px 0; color: #374151; line-height: 1.5;">${event.description}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://goshipping.com.bd/tracking?code=${event.trackingNumber}" style="display: inline-block; background-color: #11181E; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Full Live Tracking Timeline &rarr;
        </a>
      </div>
    `;

    return this.sendMail({
      to: event.customerEmail,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 5. Send User Welcome & Portal Credentials Email
   */
  static async sendWelcomeUserEmail(user: {
    fullName: string;
    email: string;
    role: string;
    companyName?: string;
    phone?: string;
    password?: string;
    loginUrl?: string;
  }): Promise<{ success: boolean; id?: string; error?: string; fallback?: boolean }> {
    const siteUrl = user.loginUrl || process.env.PUBLIC_SITE_URL || 'https://goshipping.com.bd';
    const loginLink = `${siteUrl.replace(/\/$/, '')}/login`;

    const subject = `Welcome to GoShipping Portal, ${user.fullName}!`;
    const preheader = `Your enterprise GoShipping account is ready. Access live tracking, rate calculators, and shipment telemetry.`;

    const roleLabel =
      user.role === 'customer'
        ? 'Commercial Importer'
        : user.role === 'super_admin'
        ? 'Super Administrator'
        : user.role === 'ops_manager'
        ? 'Operations Manager'
        : user.role === 'warehouse_staff'
        ? 'Depot / Warehouse Staff'
        : user.role === 'sales_team'
        ? 'Commercial Sales Specialist'
        : 'Enterprise User';

    const htmlContent = `
      <div style="border-left: 4px solid #EA1D2C; padding-left: 16px; margin-bottom: 24px;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #EA1D2C; letter-spacing: 0.5px;">
          Official Account Confirmation
        </span>
        <h2 style="margin: 4px 0 0 0; font-size: 22px; font-weight: 800; color: #11181E; line-height: 1.2;">
          Welcome aboard, ${user.fullName}!
        </h2>
      </div>

      <p style="margin: 0 0 20px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">
        Your GoShipping logistics account has been successfully created. You now have full access to our global cargo gateway connecting China (Guangzhou &amp; Yiwu) directly to Bangladesh.
      </p>

      <!-- Account Summary Card -->
      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px; font-size: 13px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6B7280; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">
          Your Account Credentials
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 35%;">Account Name:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #11181E;">${user.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Login Email:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #11181E; font-family: monospace;">${user.email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Account Tier:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #EA1D2C;">${roleLabel}</td>
          </tr>
          ${
            user.companyName
              ? `<tr>
            <td style="padding: 6px 0; color: #6B7280;">Organization:</td>
            <td style="padding: 6px 0; color: #11181E;">${user.companyName}</td>
          </tr>`
              : ''
          }
          ${
            user.password
              ? `<tr>
            <td style="padding: 6px 0; color: #6B7280;">Temporary Password:</td>
            <td style="padding: 6px 0;"><code style="background-color: #FEE2E2; color: #991B1B; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${user.password}</code> <span style="font-size: 11px; color: #6B7280; margin-left: 6px;">(change after first login)</span></td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Portal URL:</td>
            <td style="padding: 6px 0;"><a href="${loginLink}" style="color: #EA1D2C; font-weight: 600; text-decoration: underline;">${loginLink}</a></td>
          </tr>
        </table>
      </div>

      <!-- Quick Platform Features -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #11181E;">
          What you can do with your GoShipping account:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #4B5563;">
          <tr>
            <td style="padding: 6px 0; vertical-align: top; width: 24px;">&#9992;</td>
            <td style="padding: 6px 0;"><strong>Live Multi-Leg Tracking:</strong> Real-time telemetric updates from Guangzhou/Yiwu CFS dispatch through customs release at HSIA Dhaka.</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; vertical-align: top; width: 24px;">&#128184;</td>
            <td style="padding: 6px 0;"><strong>Instant Tariff Calculators:</strong> Direct rates for Door-to-Door, Express Air Cargo, and Full Container Loads (FCL).</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; vertical-align: top; width: 24px;">&#128196;</td>
            <td style="padding: 6px 0;"><strong>Digital Clearing Slips:</strong> Instant access to packing lists, airway bills, customs assessment chalans, and warehouse entry receipts.</td>
          </tr>
        </table>
      </div>

      <!-- Primary Action CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginLink}" style="display: inline-block; background-color: #EA1D2C; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 6px; text-decoration: none; box-shadow: 0 2px 4px rgba(234,29,44,0.25);">
          Sign In to GoShipping Portal &rarr;
        </a>
      </div>

      <!-- Support Notice -->
      <div style="background-color: #F3F4F6; border-radius: 6px; padding: 14px 16px; font-size: 12px; color: #4B5563; line-height: 1.5;">
        <strong>Need immediate logistics support?</strong><br>
        Our Dhaka 24/7 Operations Desk is available via phone/WhatsApp at <strong>+880 1711-223344</strong> or email at <a href="mailto:support@goshipping.com.bd" style="color: #EA1D2C; font-weight: 600;">support@goshipping.com.bd</a>.
      </div>
    `;

    return this.sendMail({
      to: user.email,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 5b. Send Password Reset Verification OTP Email
   */
  static async sendPasswordResetOtpEmail(params: {
    email: string;
    fullName: string;
    code: string;
    siteUrl?: string;
  }): Promise<{ success: boolean; id?: string; error?: string; fallback?: boolean }> {
    const subject = `GoShipping Password Reset Code: ${params.code}`;
    const preheader = `Use verification code ${params.code} to reset your GoShipping portal password.`;

    const htmlContent = `
      <div style="border-left: 4px solid #EA1D2C; padding-left: 16px; margin-bottom: 24px;">
        <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #EA1D2C; letter-spacing: 0.5px;">
          Security Verification
        </span>
        <h2 style="margin: 4px 0 0 0; font-size: 22px; font-weight: 800; color: #11181E; line-height: 1.2;">
          Reset Your Password
        </h2>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 14px; color: #4B5563; line-height: 1.6;">
        Hello <strong>${params.fullName}</strong>,<br>
        We received a request to reset the password for your GoShipping account (<code>${params.email}</code>).
      </p>

      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; margin-bottom: 8px;">
          Your 6-Digit Verification Code
        </div>
        <div style="font-family: monospace, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #EA1D2C; margin: 12px 0;">
          ${params.code}
        </div>
        <div style="font-size: 12px; color: #94A3B8;">
          This code expires in 15 minutes. If you did not request this, please ignore this email.
        </div>
      </div>

      <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748B; line-height: 1.5;">
        Need instant help? Contact GoShipping Support on WhatsApp at 
        <a href="https://wa.me/8801797252627" style="color: #25D366; font-weight: 700; text-decoration: none;">+880 1797-252627</a>.
      </p>
    `;

    return this.sendMail({
      to: params.email,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 6. Send Contact Us Lead Notification
   */
  static async sendContactInquiryNotification(inquiry: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    message: string;
    subject?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const subject = `[INQUIRY] New Website Message from ${inquiry.name}`;
    const preheader = `New inquiry received from ${inquiry.name} (${inquiry.email}) via GoShipping contact form.`;

    const htmlContent = `
      <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #11181E;">
        New Contact Inquiry Received
      </h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; font-size: 13px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 4px 0; color: #6B7280; width: 25%;">From:</td>
          <td style="padding: 4px 0; font-weight: 700;">${inquiry.name}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Email:</td>
          <td style="padding: 4px 0;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Phone:</td>
          <td style="padding: 4px 0;">${inquiry.phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Company:</td>
          <td style="padding: 4px 0;">${inquiry.company || 'N/A'}</td>
        </tr>
      </table>

      <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; font-size: 13px; color: #374151; line-height: 1.6;">
        <strong>Message:</strong><br>
        ${inquiry.message.replace(/\n/g, '<br>')}
      </div>
    `;

    return this.sendMail({
      to: this.getOpsEmail(),
      subject,
      replyTo: inquiry.email,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }

  /**
   * 7. Check Resend Domain Status & DNS Records
   */
  static async getDomainStatus(): Promise<{ success: boolean; domain?: any; error?: string }> {
    const { client, apiKey, fromEmail } = getResendContext();
    if (!client || !apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }
    try {
      const list = await client.domains.list();
      const domainList = (list.data as any)?.data || list.data || [];
      const domain = Array.isArray(domainList)
        ? domainList.find((d: any) => d.name === fromEmail.split('@')[1] || d.name.includes('goshipping')) || domainList[0]
        : domainList;
      if (domain?.id) {
        const details = await client.domains.get(domain.id);
        return { success: true, domain: details.data };
      }
      return { success: true, domain: domain || null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 8. Trigger Domain Verification
   */
  static async triggerDomainVerify(domainId?: string): Promise<{ success: boolean; result?: any; error?: string }> {
    const { client, apiKey } = getResendContext();
    if (!client || !apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }
    try {
      const id = domainId || '7a9d6dd2-008f-4a1e-ad9c-81023292441a';
      const result = await client.domains.verify(id);
      return { success: true, result: result.data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 9. Send Test Email (for Super Admin verification)
   */
  static async sendTestEmail(targetEmail: string, senderName: string = 'Super Admin'): Promise<{ success: boolean; id?: string; error?: string }> {
    const subject = `GoShipping Telemetry Test: Resend Integration Verification`;
    const preheader = `Diagnostic confirmation of enterprise email notifications via Resend API and send.goshipping.com.bd.`;

    const htmlContent = `
      <div style="border-left: 4px solid #10B981; padding-left: 16px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #059669; letter-spacing: 0.5px;">
          Resend API Verified
        </span>
        <h2 style="margin: 4px 0; font-size: 20px; font-weight: 800; color: #11181E;">
          Enterprise Email Infrastructure Online
        </h2>
        <p style="margin: 0; font-size: 13px; color: #6B7280;">
          Dispatched by <strong>${senderName}</strong> from GoShipping Admin Operations Console.
        </p>
      </div>

      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; font-size: 13px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #6B7280; width: 35%;">Sender Address:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #11181E; font-family: monospace;">${this.getFromEmail()}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Target Recipient:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #11181E;">${targetEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">Configured Provider:</td>
            <td style="padding: 6px 0; color: #11181E;">Resend Enterprise Gateway (Region: ap-northeast-1 / Tokyo)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6B7280;">System Time (BST):</td>
            <td style="padding: 6px 0; font-weight: 600; color: #EA1D2C;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} BST</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 12px; color: #6B7280; line-height: 1.5;">
        This automated test confirms that transactional email routing, DNS authentication, and template rendering are fully operational.
      </p>
    `;

    return this.sendMail({
      to: targetEmail,
      subject,
      html: this.renderBaseTemplate(subject, preheader, htmlContent)
    });
  }
}
