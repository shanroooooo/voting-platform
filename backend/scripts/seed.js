const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Driver = require('../models/Driver');
require('dotenv').config();

// Sample data
const sampleUsers = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    password: 'password123',
    role: 'user',
    addresses: [{
      type: 'home',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      coordinates: { lat: 40.7128, lng: -74.0060 },
      isDefault: true
    }]
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1234567891',
    password: 'password123',
    role: 'user',
    addresses: [{
      type: 'home',
      street: '456 Oak Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10002',
      coordinates: { lat: 40.7130, lng: -74.0050 },
      isDefault: true
    }]
  },
  {
    name: 'Restaurant Owner',
    email: 'owner@restaurant.com',
    phone: '+1234567892',
    password: 'password123',
    role: 'restaurant_owner'
  },
  {
    name: 'Driver One',
    email: 'driver1@example.com',
    phone: '+1234567893',
    password: 'password123',
    role: 'driver'
  }
];

const sampleRestaurants = [
  {
    name: 'Pizza Paradise',
    cuisine: 'pizza',
    address: {
      street: '789 Broadway',
      city: 'New York',
      state: 'NY',
      zipCode: '10003',
      coordinates: { lat: 40.7140, lng: -74.0040 }
    },
    contact: {
      phone: '+1234567894',
      email: 'info@pizzaparadise.com'
    },
    menu: [
      {
        category: 'Pizza',
        items: [
          {
            name: 'Margherita Pizza',
            description: 'Fresh tomatoes, mozzarella, basil',
            price: 12.99,
            preparationTime: 20,
            isAvailable: true,
            ingredients: ['tomatoes', 'mozzarella', 'basil', 'dough']
          },
          {
            name: 'Pepperoni Pizza',
            description: 'Pepperoni, mozzarella, tomato sauce',
            price: 14.99,
            preparationTime: 20,
            isAvailable: true,
            ingredients: ['pepperoni', 'mozzarella', 'tomato sauce', 'dough']
          }
        ]
      },
      {
        category: 'Drinks',
        items: [
          {
            name: 'Coca Cola',
            description: 'Classic cola drink',
            price: 2.99,
            preparationTime: 5,
            isAvailable: true
          }
        ]
      }
    ],
    operatingHours: {
      monday: { open: '11:00', close: '23:00', isOpen: true },
      tuesday: { open: '11:00', close: '23:00', isOpen: true },
      wednesday: { open: '11:00', close: '23:00', isOpen: true },
      thursday: { open: '11:00', close: '23:00', isOpen: true },
      friday: { open: '11:00', close: '23:00', isOpen: true },
      saturday: { open: '11:00', close: '23:00', isOpen: true },
      sunday: { open: '11:00', close: '23:00', isOpen: true }
    },
    deliveryInfo: {
      averageTime: 30,
      deliveryFee: 2.99,
      minimumOrder: 10.00
    }
  },
  {
    name: 'Burger Barn',
    cuisine: 'burger',
    address: {
      street: '321 5th Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10004',
      coordinates: { lat: 40.7150, lng: -74.0030 }
    },
    contact: {
      phone: '+1234567895',
      email: 'info@burgerbarn.com'
    },
    menu: [
      {
        category: 'Burgers',
        items: [
          {
            name: 'Classic Burger',
            description: 'Beef patty, lettuce, tomato, onion, pickles',
            price: 10.99,
            preparationTime: 15,
            isAvailable: true,
            ingredients: ['beef patty', 'lettuce', 'tomato', 'onion', 'pickles', 'bun']
          },
          {
            name: 'Cheeseburger',
            description: 'Beef patty, cheese, lettuce, tomato',
            price: 11.99,
            preparationTime: 15,
            isAvailable: true,
            ingredients: ['beef patty', 'cheese', 'lettuce', 'tomato', 'bun']
          }
        ]
      }
    ],
    operatingHours: {
      monday: { open: '10:00', close: '22:00', isOpen: true },
      tuesday: { open: '10:00', close: '22:00', isOpen: true },
      wednesday: { open: '10:00', close: '22:00', isOpen: true },
      thursday: { open: '10:00', close: '22:00', isOpen: true },
      friday: { open: '10:00', close: '22:00', isOpen: true },
      saturday: { open: '10:00', close: '22:00', isOpen: true },
      sunday: { open: '10:00', close: '22:00', isOpen: true }
    },
    deliveryInfo: {
      averageTime: 25,
      deliveryFee: 1.99,
      minimumOrder: 8.00
    }
  },
  {
    name: 'Sushi Sensation',
    cuisine: 'sushi',
    address: {
      street: '555 Park Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10005',
      coordinates: { lat: 40.7160, lng: -74.0020 }
    },
    contact: {
      phone: '+1234567896',
      email: 'info@sushisensation.com'
    },
    menu: [
      {
        category: 'Sushi Rolls',
        items: [
          {
            name: 'California Roll',
            description: 'Crab, avocado, cucumber',
            price: 8.99,
            preparationTime: 10,
            isAvailable: true,
            ingredients: ['crab', 'avocado', 'cucumber', 'rice', 'nori']
          },
          {
            name: 'Spicy Tuna Roll',
            description: 'Tuna, spicy mayo, cucumber',
            price: 10.99,
            preparationTime: 10,
            isAvailable: true,
            ingredients: ['tuna', 'spicy mayo', 'cucumber', 'rice', 'nori']
          }
        ]
      }
    ],
    operatingHours: {
      monday: { open: '12:00', close: '22:00', isOpen: true },
      tuesday: { open: '12:00', close: '22:00', isOpen: true },
      wednesday: { open: '12:00', close: '22:00', isOpen: true },
      thursday: { open: '12:00', close: '22:00', isOpen: true },
      friday: { open: '12:00', close: '22:00', isOpen: true },
      saturday: { open: '12:00', close: '22:00', isOpen: true },
      sunday: { open: '12:00', close: '22:00', isOpen: true }
    },
    deliveryInfo: {
      averageTime: 35,
      deliveryFee: 3.99,
      minimumOrder: 15.00
    }
  }
];

const sampleDrivers = [
  {
    vehicle: {
      type: 'car',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      color: 'Silver',
      licensePlate: 'ABC123'
    },
    license: {
      number: 'D1234567',
      type: 'Class C',
      expirationDate: new Date('2025-12-31'),
      issuingState: 'NY'
    },
    availability: {
      currentLocation: { lat: 40.7128, lng: -74.0060 },
      maxDeliveryRadius: 10
    }
  }
];

async function seedDatabase() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fooddelivery');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Restaurant.deleteMany({});
    await Driver.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }
    console.log('Created users');

    // Create restaurants
    const restaurantOwner = createdUsers.find(u => u.role === 'restaurant_owner');
    const createdRestaurants = [];
    for (const restaurantData of sampleRestaurants) {
      const restaurant = new Restaurant({
        ...restaurantData,
        owner: restaurantOwner._id
      });
      await restaurant.save();
      createdRestaurants.push(restaurant);
    }
    console.log('Created restaurants');

    // Create drivers
    const driverUser = createdUsers.find(u => u.role === 'driver');
    for (const driverData of sampleDrivers) {
      const driver = new Driver({
        ...driverData,
        userId: driverUser._id
      });
      await driver.save();
    }
    console.log('Created drivers');

    // Update user preferences
    const regularUsers = createdUsers.filter(u => u.role === 'user');
    regularUsers[0].preferences = {
      cuisines: ['pizza', 'burger'],
      favoriteRestaurants: [createdRestaurants[0]._id]
    };
    await regularUsers[0].save();

    regularUsers[1].preferences = {
      cuisines: ['sushi', 'pizza'],
      favoriteRestaurants: [createdRestaurants[2]._id]
    };
    await regularUsers[1].save();

    console.log('Database seeded successfully!');
    console.log('\nCreated users:');
    createdUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - ${user.role}`);
    });

    console.log('\nCreated restaurants:');
    createdRestaurants.forEach(restaurant => {
      console.log(`- ${restaurant.name} (${restaurant.cuisine})`);
    });

    console.log('\nLogin credentials:');
    console.log('Regular user: john@example.com / password123');
    console.log('Restaurant owner: owner@restaurant.com / password123');
    console.log('Driver: driver1@example.com / password123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
