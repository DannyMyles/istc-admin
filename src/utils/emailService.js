const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs").promises;

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Template directory
    this.templateDir = path.join(__dirname, "../views/email-templates");
  }

  async loadTemplate(templateName, data) {
    try {
      const templatePath = path.join(this.templateDir, `${templateName}.ejs`);
      const templateContent = await fs.readFile(templatePath, "utf-8");
      return ejs.render(templateContent, data);
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      // Return default template
      return this.getDefaultTemplate(templateName, data);
    }
  }

  getDefaultTemplate(templateName, data) {
    const templates = {
      welcome: `
        <h2>Welcome ${data.name}!</h2>
        <p>Your account has been successfully created.</p>
        <p>You can now login to your account.</p>
        <p><a href="${process.env.FRONTEND_URL}/login">Click here to login</a></p>
      `,
      "password-reset": `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <p><a href="${data.resetLink}">Reset Password</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      "contact-confirmation": `
        <h2>Thank You for Contacting Us</h2>
        <p>Dear ${data.name},</p>
        <p>We have received your message and will get back to you within 24-48 hours.</p>
        <p><strong>Your Message:</strong></p>
        <p>${data.message}</p>
        <p>Best regards,<br>Support Team</p>
      `,
      "contact-notification": `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${data.name} (${data.email})</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong><br>${data.message}</p>
        <p><strong>Submitted:</strong> ${new Date(data.createdAt).toLocaleString()}</p>
      `,
    };

    return templates[templateName] || "<p>Email content</p>";
  }

  async sendEmail(to, subject, html, attachments = []) {
    const mailOptions = {
      from:
        process.env.SMTP_FROM ||
        `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordReset(email, resetToken, name) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = await this.loadTemplate("password-reset", { resetLink, name });

    return this.sendEmail(email, "Password Reset Request", html);
  }

  async sendWelcomeEmail(email, name) {
    const html = await this.loadTemplate("welcome", { name });

    return this.sendEmail(
      email,
      `Welcome to ${process.env.APP_NAME || "Our App"}!`,
      html
    );
  }

  // In your EmailService.js

  async sendContactConfirmation(email, name, message, contactData = {}) {
    const html = await this.loadTemplate("contact-confirmation", {
      name,
      email,
      message,
      ticketId: contactData.ticketId || `TKT-${Date.now()}`,
      category: contactData.category || "General Inquiry",
      submittedDate: contactData.submittedDate || new Date().toLocaleString(),
      appName: process.env.APP_NAME || "Our App",
      phone: process.env.SUPPORT_PHONE,
      whatsapp: process.env.WHATSAPP_NUMBER,
      supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
      businessHours: process.env.BUSINESS_HOURS || "Mon-Fri, 9AM-6PM",
      faqUrl: process.env.FAQ_URL || "#",
      knowledgeBaseUrl: process.env.KNOWLEDGE_BASE_URL || "#",
      communityUrl: process.env.COMMUNITY_URL || "#",
      websiteUrl: process.env.WEBSITE_URL || "#",
      privacyUrl: process.env.PRIVACY_POLICY_URL || "#",
      termsUrl: process.env.TERMS_URL || "#",
      unsubscribeUrl: process.env.UNSUBSCRIBE_URL || "#",
      companyAddress:
        process.env.COMPANY_ADDRESS || "123 Main Street, City, Country",
    });

    return this.sendEmail(
      email,
      `Thank You for Contacting ${process.env.APP_NAME || "Us"}`,
      html
    );
  }

  async sendContactNotification(adminEmail, contactData) {
    const html = await this.loadTemplate("contact-notification", contactData);

    return this.sendEmail(
      adminEmail,
      `New Contact Form: ${contactData.subject}`,
      html
    );
  }

  async sendPasswordChangedNotification(email, name) {
    const html = await this.loadTemplate("password-changed", {
      name,
      appName: process.env.APP_NAME || "App",
      supportEmail: process.env.SUPPORT_EMAIL,
    });

    return this.sendEmail(email, "Your Password Has Been Changed", html);
  }
}

module.exports = new EmailService();