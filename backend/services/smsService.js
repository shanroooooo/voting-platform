const twilio = require('twilio');
const logger = require('../utils/logger');

// Initialize Twilio client only if credentials are available
let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Send SMS notification
const sendSMS = async (phoneNumber, message) => {
  try {
    if (!client) {
      logger.warn('Twilio not configured, skipping SMS');
      return { success: false, error: 'SMS service not configured' };
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    logger.info('SMS sent successfully', { 
      to: phoneNumber, 
      messageSid: result.sid,
      status: result.status 
    });
    
    return { success: true, messageSid: result.sid };
  } catch (error) {
    logger.error('Failed to send SMS', { 
      error: error.message, 
      to: phoneNumber 
    });
    
    return { success: false, error: error.message };
  }
};

// Send order confirmation SMS
const sendOrderConfirmationSMS = async (user, order) => {
  const message = `Food Delivery: Your order #${order._id} has been confirmed! Total: $${order.totalAmount.toFixed(2)}. Estimated delivery: ${order.deliveryTime} minutes. Track in app!`;
  
  return await sendSMS(user.phone, message);
};

// Send order status update SMS
const sendOrderStatusSMS = async (user, order, status) => {
  const statusMessages = {
    confirmed: `Your order #${order._id} has been confirmed! The restaurant is preparing your food.`,
    preparing: `Your order #${order._id} is being prepared by the restaurant.`,
    ready: `Your order #${order._id} is ready! Waiting for driver pickup.`,
    picked_up: `Your order #${order._id} has been picked up and is on the way!`,
    delivered: `Your order #${order._id} has been delivered. Enjoy your meal!`,
    cancelled: `Your order #${order._id} has been cancelled.`
  };
  
  const message = `Food Delivery: ${statusMessages[status]}`;
  
  return await sendSMS(user.phone, message);
};

// Send driver location update SMS (for users without app notifications)
const sendDriverLocationSMS = async (user, driver) => {
  const message = `Food Delivery: Your driver ${driver.name} is on the way! Phone: ${driver.phone}. Vehicle: ${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.color})`;
  
  return await sendSMS(user.phone, message);
};

// Send verification code SMS
const sendVerificationCodeSMS = async (phoneNumber, code) => {
  const message = `Food Delivery: Your verification code is ${code}. This code will expire in 10 minutes. Do not share this code with anyone.`;
  
  return await sendSMS(phoneNumber, message);
};

// Send password reset SMS
const sendPasswordResetSMS = async (phoneNumber, resetToken) => {
  const message = `Food Delivery: Use this code to reset your password: ${resetToken}. This code will expire in 1 hour for security.`;
  
  return await sendSMS(phoneNumber, message);
};

// Send promotional SMS
const sendPromotionalSMS = async (phoneNumber, promotion) => {
  const message = `Food Delivery: ${promotion.message} Use code ${promotion.code} for ${promotion.discount} off! Reply STOP to unsubscribe.`;
  
  return await sendSMS(phoneNumber, message);
};

// Check SMS delivery status
const checkSMSStatus = async (messageSid) => {
  try {
    if (!client) {
      return { success: false, error: 'SMS service not configured' };
    }

    const message = await client.messages(messageSid).fetch();
    
    logger.info('SMS status checked', { 
      messageSid, 
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    });
    
    return {
      success: true,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    };
  } catch (error) {
    logger.error('Failed to check SMS status', { 
      error: error.message, 
      messageSid 
    });
    
    return { success: false, error: error.message };
  }
};

// Validate phone number format
const validatePhoneNumber = (phoneNumber) => {
  // Basic validation for international phone numbers
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''));
};

// Format phone number for Twilio
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  let formatted = phoneNumber.replace(/[^\d+]/g, '');
  
  // Add + if not present
  if (!formatted.startsWith('+')) {
    // Assume US number if no country code
    if (formatted.length === 10) {
      formatted = '+1' + formatted;
    } else {
      formatted = '+' + formatted;
    }
  }
  
  return formatted;
};

module.exports = {
  sendSMS,
  sendOrderConfirmationSMS,
  sendOrderStatusSMS,
  sendDriverLocationSMS,
  sendVerificationCodeSMS,
  sendPasswordResetSMS,
  sendPromotionalSMS,
  checkSMSStatus,
  validatePhoneNumber,
  formatPhoneNumber
};
