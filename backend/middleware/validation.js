const Joi = require('joi');

const userValidationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).min(10).max(20).required(),
  addresses: Joi.array().items(
    Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      country: Joi.string().required(),
      isDefault: Joi.boolean().default(false)
    })
  ),
  preferences: Joi.object({
    cuisineTypes: Joi.array().items(Joi.string()),
    dietaryRestrictions: Joi.array().items(Joi.string()),
    notifications: Joi.object({
      email: Joi.boolean().default(true),
      sms: Joi.boolean().default(true),
      push: Joi.boolean().default(true)
    })
  })
});

const restaurantValidationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().min(10).max(500).required(),
  cuisineType: Joi.string().required(),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required()
  }).required(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).min(10).max(20).required(),
  email: Joi.string().email().required(),
  deliveryFee: Joi.number().min(0).required(),
  deliveryTime: Joi.number().min(0).required(),
  priceRange: Joi.string().valid('$', '$$', '$$$', '$$$$').required()
});

const orderValidationSchema = Joi.object({
  restaurant: Joi.string().hex().length(24).required(),
  items: Joi.array().items(
    Joi.object({
      menuItem: Joi.string().hex().length(24).required(),
      quantity: Joi.number().integer().min(1).required(),
      specialInstructions: Joi.string().max(200)
    })
  ).min(1).required(),
  deliveryAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required()
  }).required(),
  paymentMethod: Joi.string().valid('card', 'cash', 'wallet').required(),
  specialInstructions: Joi.string().max(500)
});

const driverValidationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).min(10).max(20).required(),
  password: Joi.string().min(6).required(),
  licenseNumber: Joi.string().required(),
  vehicle: Joi.object({
    type: Joi.string().valid('car', 'motorcycle', 'bicycle', 'scooter').required(),
    make: Joi.string().required(),
    model: Joi.string().required(),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
    plateNumber: Joi.string().required(),
    color: Joi.string()
  }).required(),
  bankAccount: Joi.object({
    accountNumber: Joi.string().required(),
    routingNumber: Joi.string().required(),
    bankName: Joi.string().required()
  })
});

const validateUser = (req, res, next) => {
  const { error } = userValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message
    });
  }
  next();
};

const validateRestaurant = (req, res, next) => {
  const { error } = restaurantValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message
    });
  }
  next();
};

const validateOrder = (req, res, next) => {
  const { error } = orderValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message
    });
  }
  next();
};

const validateDriver = (req, res, next) => {
  const { error } = driverValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message
    });
  }
  next();
};

const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  next();
};

const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && (isNaN(page) || parseInt(page) < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Page must be a positive integer'
    });
  }
  
  if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100'
    });
  }
  
  next();
};

module.exports = {
  validateUser,
  validateRestaurant,
  validateOrder,
  validateDriver,
  validateId,
  validatePagination,
  userValidationSchema,
  restaurantValidationSchema,
  orderValidationSchema,
  driverValidationSchema
};
