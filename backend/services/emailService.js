const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create email transporter only if credentials are available
const createTransporter = () => {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('SendGrid not configured, email service disabled');
    return null;
  }

  return nodemailer.createTransporter({
    service: 'SendGrid',
    auth: {
      user: process.env.SENDGRID_API_KEY,
      pass: process.env.SENDGRID_API_KEY
    }
  });
};

// Send verification email
const sendVerificationEmail = async (user, verificationToken) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      logger.warn('Email service not configured, skipping verification email');
      return false;
    }
    
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@fooddelivery.com',
      to: user.email,
      subject: 'Verify Your Email - Food Delivery',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Welcome to Food Delivery!</h2>
          <p>Hi ${user.name},</p>
          <p>Thank you for signing up! Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #FF6B35; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <p>Best regards,<br>The Food Delivery Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', { userId: user._id, email: user.email });
    
    return true;
  } catch (error) {
    logger.error('Failed to send verification email', { error: error.message, userId: user._id });
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: 'Reset Your Password - Food Delivery',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>You requested a password reset. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #FF6B35; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this reset, you can safely ignore this email.</p>
          <p>Best regards,<br>The Food Delivery Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { userId: user._id, email: user.email });
    
    return true;
  } catch (error) {
    logger.error('Failed to send password reset email', { error: error.message, userId: user._id });
    return false;
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (user, order) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: `Order Confirmation - #${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Order Confirmation</h2>
          <p>Hi ${user.name},</p>
          <p>Thank you for your order! Here are the details:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Order #${order._id}</h3>
            <p><strong>Restaurant:</strong> ${order.restaurant.name}</p>
            <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
            <p><strong>Delivery Address:</strong> ${order.deliveryAddress.street}, ${order.deliveryAddress.city}</p>
            <p><strong>Estimated Delivery:</strong> ${order.deliveryTime} minutes</p>
          </div>
          
          <h4>Order Items:</h4>
          ${order.items.map(item => `
            <div style="margin: 10px 0; padding: 10px; background-color: #f9f9f9; border-radius: 3px;">
              <p><strong>${item.quantity}x ${item.menuItem.name}</strong> - $${(item.menuItem.price * item.quantity).toFixed(2)}</p>
            </div>
          `).join('')}
          
          <p>You can track your order in real-time through our app.</p>
          <p>Best regards,<br>The Food Delivery Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Order confirmation email sent', { userId: user._id, orderId: order._id });
    
    return true;
  } catch (error) {
    logger.error('Failed to send order confirmation email', { error: error.message, userId: user._id, orderId: order._id });
    return false;
  }
};

// Send order status update email
const sendOrderStatusEmail = async (user, order, status) => {
  try {
    const transporter = createTransporter();
    
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared!',
      preparing: 'Your order is being prepared by the restaurant.',
      ready: 'Your order is ready and waiting for a driver.',
      picked_up: 'A driver has picked up your order and is on the way!',
      delivered: 'Your order has been delivered. Enjoy your meal!',
      cancelled: 'Your order has been cancelled.'
    };
    
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: `Order Update - #${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B35;">Order Status Update</h2>
          <p>Hi ${user.name},</p>
          <p>${statusMessages[status] || `Your order status has been updated to: ${status}`}</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Order #${order._id}</h3>
            <p><strong>Status:</strong> <span style="color: #FF6B35; text-transform: capitalize;">${status}</span></p>
            <p><strong>Restaurant:</strong> ${order.restaurant.name}</p>
            <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
          </div>
          
          <p>Track your order in real-time through our app for the latest updates.</p>
          <p>Best regards,<br>The Food Delivery Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info('Order status email sent', { userId: user._id, orderId: order._id, status });
    
    return true;
  } catch (error) {
    logger.error('Failed to send order status email', { error: error.message, userId: user._id, orderId: order._id });
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail
};
