import http from './http';

class EmailService {
  constructor() {
    this.config = {
      emailjs: {
        serviceId: process.env.REACT_APP_EMAILJS_SERVICE_ID || '',
        templateId: process.env.REACT_APP_EMAILJS_TEMPLATE_ID || '',
        publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || ''
      },
      sendgrid: {
        apiKey: process.env.REACT_APP_SENDGRID_API_KEY || '',
        fromEmail: process.env.REACT_APP_FROM_EMAIL || 'noreply@bezhas.com'
      },
      mailgun: {
        apiKey: process.env.REACT_APP_MAILGUN_API_KEY || '',
        domain: process.env.REACT_APP_MAILGUN_DOMAIN || '',
        baseUrl: 'https://api.mailgun.net/v3'
      }
    };

    this.templates = {
      welcome: {
        subject: 'Welcome to BeZhas Platform!',
        template: 'welcome_template'
      },
      verification: {
        subject: 'Verify Your Email Address',
        template: 'verification_template'
      },
      passwordReset: {
        subject: 'Reset Your Password',
        template: 'password_reset_template'
      },
      transactionAlert: {
        subject: 'Transaction Alert',
        template: 'transaction_alert_template'
      },
      nftSold: {
        subject: 'Your NFT Has Been Sold!',
        template: 'nft_sold_template'
      },
      stakingReward: {
        subject: 'Staking Rewards Available',
        template: 'staking_reward_template'
      },
      securityAlert: {
        subject: 'Security Alert - Account Activity',
        template: 'security_alert_template'
      }
    };
  }

  // Send email via EmailJS (client-side)
  async sendViaEmailJS(templateParams, templateId = null) {
    if (!this.config.emailjs.serviceId || !this.config.emailjs.publicKey) {
      throw new Error('EmailJS configuration missing');
    }

    try {
      // Dynamic import for EmailJS
      const emailjs = await import('@emailjs/browser');
      
      const response = await emailjs.send(
        this.config.emailjs.serviceId,
        templateId || this.config.emailjs.templateId,
        templateParams,
        this.config.emailjs.publicKey
      );

      return {
        success: true,
        messageId: response.text,
        provider: 'emailjs'
      };
    } catch (error) {
      console.error('EmailJS error:', error);
      throw new Error(`Failed to send email via EmailJS: ${error.message}`);
    }
  }

  // Send email via SendGrid (requires backend proxy)
  async sendViaSendGrid(to, subject, content, templateId = null) {
    if (!this.config.sendgrid.apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    try {
      const emailData = {
        personalizations: [{
          to: [{ email: to }],
          subject: subject
        }],
        from: { email: this.config.sendgrid.fromEmail },
        content: [{
          type: 'text/html',
          value: content
        }]
      };

      if (templateId) {
        emailData.template_id = templateId;
      }

      // This should go through your backend API for security
      const response = await http.post('/api/send-email/sendgrid', {
        emailData,
        apiKey: this.config.sendgrid.apiKey
      });

      return {
        success: true,
        messageId: response.data.messageId,
        provider: 'sendgrid'
      };
    } catch (error) {
      console.error('SendGrid error:', error);
      throw new Error(`Failed to send email via SendGrid: ${error.message}`);
    }
  }

  // Send email via Mailgun (requires backend proxy)
  async sendViaMailgun(to, subject, content) {
    if (!this.config.mailgun.apiKey || !this.config.mailgun.domain) {
      throw new Error('Mailgun configuration missing');
    }

    try {
      const formData = new FormData();
      formData.append('from', this.config.sendgrid.fromEmail);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', content);

      // This should go through your backend API for security
      const response = await http.post('/api/send-email/mailgun', {
        formData: Object.fromEntries(formData),
        domain: this.config.mailgun.domain,
        apiKey: this.config.mailgun.apiKey
      });

      return {
        success: true,
        messageId: response.data.id,
        provider: 'mailgun'
      };
    } catch (error) {
      console.error('Mailgun error:', error);
      throw new Error(`Failed to send email via Mailgun: ${error.message}`);
    }
  }

  // Generic send method with fallback
  async sendEmail(to, subject, content, options = {}) {
    const { provider = 'auto', templateId = null, templateParams = {} } = options;

    if (provider === 'emailjs') {
      return await this.sendViaEmailJS({ 
        to_email: to, 
        subject, 
        message: content,
        ...templateParams 
      }, templateId);
    } else if (provider === 'sendgrid') {
      return await this.sendViaSendGrid(to, subject, content, templateId);
    } else if (provider === 'mailgun') {
      return await this.sendViaMailgun(to, subject, content);
    } else {
      // Auto mode: try providers in order of preference
      const providers = ['emailjs', 'sendgrid', 'mailgun'];
      
      for (const providerName of providers) {
        try {
          return await this.sendEmail(to, subject, content, { 
            provider: providerName, 
            templateId, 
            templateParams 
          });
        } catch (error) {
          console.warn(`${providerName} failed:`, error.message);
          continue;
        }
      }
      
      throw new Error('All email providers failed');
    }
  }

  // Send welcome email
  async sendWelcomeEmail(userEmail, userName) {
    const template = this.templates.welcome;
    const content = this.generateWelcomeHTML(userName);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        user_name: userName,
        platform_name: 'BeZhas'
      }
    });
  }

  // Send email verification
  async sendVerificationEmail(userEmail, verificationLink) {
    const template = this.templates.verification;
    const content = this.generateVerificationHTML(verificationLink);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        verification_link: verificationLink
      }
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, resetLink) {
    const template = this.templates.passwordReset;
    const content = this.generatePasswordResetHTML(resetLink);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        reset_link: resetLink
      }
    });
  }

  // Send transaction alert
  async sendTransactionAlert(userEmail, transactionDetails) {
    const template = this.templates.transactionAlert;
    const content = this.generateTransactionAlertHTML(transactionDetails);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        transaction_hash: transactionDetails.hash,
        amount: transactionDetails.amount,
        type: transactionDetails.type
      }
    });
  }

  // Send NFT sold notification
  async sendNFTSoldNotification(userEmail, nftDetails) {
    const template = this.templates.nftSold;
    const content = this.generateNFTSoldHTML(nftDetails);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        nft_name: nftDetails.name,
        sale_price: nftDetails.price,
        buyer_address: nftDetails.buyer
      }
    });
  }

  // Send staking reward notification
  async sendStakingRewardNotification(userEmail, rewardDetails) {
    const template = this.templates.stakingReward;
    const content = this.generateStakingRewardHTML(rewardDetails);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        reward_amount: rewardDetails.amount,
        staking_period: rewardDetails.period
      }
    });
  }

  // Send security alert
  async sendSecurityAlert(userEmail, alertDetails) {
    const template = this.templates.securityAlert;
    const content = this.generateSecurityAlertHTML(alertDetails);
    
    return await this.sendEmail(userEmail, template.subject, content, {
      templateParams: {
        alert_type: alertDetails.type,
        timestamp: alertDetails.timestamp,
        ip_address: alertDetails.ipAddress
      }
    });
  }

  // HTML template generators
  generateWelcomeHTML(userName) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to BeZhas!</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Hello ${userName}!</h2>
          <p>Welcome to the BeZhas Web3 platform. We're excited to have you join our community!</p>
          <p>With BeZhas, you can:</p>
          <ul>
            <li>Create and trade NFTs</li>
            <li>Participate in DeFi staking</li>
            <li>Connect with other users</li>
            <li>Earn rewards through governance</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://bezhas.com/dashboard" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Get Started
            </a>
          </div>
        </div>
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>© 2024 BeZhas Platform. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  generateVerificationHTML(verificationLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4CAF50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Verify Your Email</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Email Verification Required</h2>
          <p>Please click the button below to verify your email address and activate your BeZhas account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If you didn't create a BeZhas account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;
  }

  generatePasswordResetHTML(resetLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #FF9800; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Reset Your Password</h2>
          <p>You requested a password reset for your BeZhas account. Click the button below to set a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #FF9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't request this reset, please ignore this email.
          </p>
        </div>
      </div>
    `;
  }

  generateTransactionAlertHTML(transactionDetails) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2196F3; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Transaction Alert</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Transaction Completed</h2>
          <p>A transaction has been completed on your BeZhas account:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Type:</strong> ${transactionDetails.type}</p>
            <p><strong>Amount:</strong> ${transactionDetails.amount}</p>
            <p><strong>Hash:</strong> ${transactionDetails.hash}</p>
            <p><strong>Status:</strong> ${transactionDetails.status}</p>
          </div>
        </div>
      </div>
    `;
  }

  generateNFTSoldHTML(nftDetails) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #9C27B0; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">NFT Sold! 🎉</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Congratulations!</h2>
          <p>Your NFT has been successfully sold on the BeZhas marketplace:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>NFT:</strong> ${nftDetails.name}</p>
            <p><strong>Sale Price:</strong> ${nftDetails.price} ETH</p>
            <p><strong>Buyer:</strong> ${nftDetails.buyer}</p>
          </div>
          <p>The funds have been transferred to your wallet.</p>
        </div>
      </div>
    `;
  }

  generateStakingRewardHTML(rewardDetails) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4CAF50; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Staking Rewards Available! 💰</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Your Rewards Are Ready</h2>
          <p>You have earned staking rewards on the BeZhas platform:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Reward Amount:</strong> ${rewardDetails.amount} BEZ</p>
            <p><strong>Staking Period:</strong> ${rewardDetails.period}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://bezhas.com/staking" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Claim Rewards
            </a>
          </div>
        </div>
      </div>
    `;
  }

  generateSecurityAlertHTML(alertDetails) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #F44336; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Security Alert ⚠️</h1>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Account Activity Detected</h2>
          <p>We detected unusual activity on your BeZhas account:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Alert Type:</strong> ${alertDetails.type}</p>
            <p><strong>Time:</strong> ${alertDetails.timestamp}</p>
            <p><strong>IP Address:</strong> ${alertDetails.ipAddress}</p>
          </div>
          <p>If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://bezhas.com/security" style="background: #F44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
              Review Security
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // Validate email address
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get email service status
  async getServiceStatus() {
    const status = {
      emailjs: false,
      sendgrid: false,
      mailgun: false
    };

    // Check EmailJS
    if (this.config.emailjs.serviceId && this.config.emailjs.publicKey) {
      status.emailjs = true;
    }

    // Check SendGrid
    if (this.config.sendgrid.apiKey) {
      status.sendgrid = true;
    }

    // Check Mailgun
    if (this.config.mailgun.apiKey && this.config.mailgun.domain) {
      status.mailgun = true;
    }

    return status;
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;
