// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('fooddelivery');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'phone', 'password'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        phone: {
          bsonType: 'string',
          pattern: '^\\+?[\\d\\s\\-\\(\\)]+$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'driver', 'restaurant_owner', 'admin']
        }
      }
    }
  }
});

db.createCollection('restaurants', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'owner', 'cuisine', 'address', 'contact'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100
        },
        cuisine: {
          bsonType: 'string',
          enum: ['american', 'italian', 'chinese', 'japanese', 'mexican', 'indian', 'thai', 'korean', 'french', 'greek', 'mediterranean', 'spanish', 'vietnamese', 'middle-eastern', 'african', 'caribbean', 'fusion', 'cafe', 'bakery', 'fast-food', 'pizza', 'burger', 'sushi', 'barbecue', 'vegetarian', 'vegan', 'desserts']
        }
      }
    }
  }
});

db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'restaurantId', 'items', 'pricing', 'deliveryAddress'],
      properties: {
        status: {
          bsonType: 'string',
          enum: ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered', 'cancelled', 'refunded']
        },
        paymentStatus: {
          bsonType: 'string',
          enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded']
        }
      }
    }
  }
});

db.createCollection('drivers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'vehicle', 'license'],
      properties: {
        'vehicle.type': {
          bsonType: 'string',
          enum: ['car', 'motorcycle', 'bicycle', 'scooter', 'truck']
        }
      }
    }
  }
});

db.createCollection('scheduledorders');
db.createCollection('grouporders');

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ 'addresses.coordinates': '2dsphere' });
db.users.createIndex({ role: 1 });
db.users.createIndex({ createdAt: -1 });

db.restaurants.createIndex({ name: 'text', 'menu.items.name': 'text' });
db.restaurants.createIndex({ 'address.coordinates': '2dsphere' });
db.restaurants.createIndex({ cuisine: 1 });
db.restaurants.createIndex({ 'rating.average': -1 });
db.restaurants.createIndex({ isActive: 1 });
db.restaurants.createIndex({ owner: 1 });

db.orders.createIndex({ userId: 1, createdAt: -1 });
db.orders.createIndex({ restaurantId: 1, status: 1 });
db.orders.createIndex({ driverId: 1, status: 1 });
db.orders.createIndex({ status: 1, createdAt: -1 });
db.orders.createIndex({ 'deliveryAddress.coordinates': '2dsphere' });
db.orders.createIndex({ paymentStatus: 1 });
db.orders.createIndex({ 'groupOrder.isGroupOrder': 1 });
db.orders.createIndex({ 'scheduledOrder.isScheduled': 1, 'scheduledOrder.scheduledTime': 1 });

db.drivers.createIndex({ userId: 1 }, { unique: true });
db.drivers.createIndex({ 'availability.currentLocation': '2dsphere' });
db.drivers.createIndex({ 'availability.isOnline': 1 });
db.drivers.createIndex({ 'verificationStatus': 1 });
db.drivers.createIndex({ 'stats.averageRating': -1 });
db.drivers.createIndex({ isActive: 1 });

db.scheduledorders.createIndex({ organizerId: 1, scheduledTime: -1 });
db.scheduledorders.createIndex({ restaurantId: 1, status: 1 });
db.scheduledorders.createIndex({ 'participants.userId': 1 });
db.scheduledorders.createIndex({ scheduledTime: 1, status: 1 });
db.scheduledorders.createIndex({ status: 1, createdAt: -1 });

db.grouporders.createIndex({ organizerId: 1, createdAt: -1 });
db.grouporders.createIndex({ restaurantId: 1, status: 1 });
db.grouporders.createIndex({ 'participants.userId': 1 });
db.grouporders.createIndex({ deadline: 1, status: 1 });
db.grouporders.createIndex({ shareLink: 1 });
db.grouporders.createIndex({ shareCode: 1 });
db.grouporders.createIndex({ status: 1, createdAt: -1 });

// Create admin user
db.users.insertOne({
  name: 'System Admin',
  email: 'admin@fooddelivery.com',
  phone: '+1000000000',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W', // password: admin123
  role: 'admin',
  isActive: true,
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Database initialized successfully!');
print('Admin user created: admin@fooddelivery.com / admin123');
