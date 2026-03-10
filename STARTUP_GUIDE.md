# 🚀 Food Delivery Platform - Startup Guide

## 📋 Overview

This is a comprehensive Food Delivery & Logistics Platform built with modern technologies including React Native, Node.js, MongoDB, Redis, and real-time WebSocket integration.

## 🏗️ Architecture

### **Backend (Node.js + Express)**
- **RESTful API** with comprehensive endpoints
- **Real-time communication** via Socket.IO
- **MongoDB** for primary data storage
- **Redis** for caching and session management
- **AI-powered recommendations** engine
- **Advanced features**: scheduled deliveries, group ordering

### **Frontend (React Native)**
- **Cross-platform mobile app** for iOS and Android
- **Real-time order tracking** with live maps
- **Modern UI** with React Navigation and Redux
- **Offline support** and caching

### **Infrastructure**
- **Docker** containerization
- **Nginx** reverse proxy with SSL
- **Production-ready** deployment scripts
- **Monitoring** with Prometheus/Grafana (optional)

## 🛠️ Quick Start

### **Prerequisites**
- Node.js 16+
- MongoDB 5.0+
- Redis 7.0+
- Docker & Docker Compose
- React Native CLI
- Android Studio / Xcode (for mobile development)

### **1. Clone & Setup**
```bash
git clone <repository-url>
cd food-delivery-platform
npm install
```

### **2. Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

### **3. Start with Docker (Recommended)**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### **4. Manual Development Setup**
```bash
# Start MongoDB and Redis
docker-compose up -d mongo redis

# Start backend server
cd backend
npm run dev

# Start mobile app (new terminal)
cd mobile
npm run mobile
```

### **5. Seed Database**
```bash
# Seed with sample data
cd backend
npm run seed
```

## 📱 Mobile App Development

### **Setup**
```bash
cd mobile
npm install

# For Android
npm run android

# For iOS
npm run ios
```

### **Key Features**
- **Home Screen** with personalized recommendations
- **Restaurant browsing** with search and filters
- **Real-time order tracking** with live maps
- **Cart & checkout** with multiple payment options
- **Order history** and tracking
- **Profile management**

### **Navigation Structure**
```
├── Auth Stack
│   ├── Login
│   ├── Register
│   └── Forgot Password
└── Main Stack
    ├── Home
    ├── Restaurants
    ├── Cart
    ├── Orders
    └── Profile
```

## 🔧 Backend API

### **Core Endpoints**

#### **Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

#### **Restaurants**
- `GET /api/restaurants` - List restaurants
- `GET /api/restaurants/nearby` - Nearby restaurants
- `GET /api/restaurants/:id` - Restaurant details
- `GET /api/restaurants/:id/menu` - Restaurant menu

#### **Orders**
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Order details
- `PUT /api/orders/:id/status` - Update status
- `GET /api/orders/user/:userId` - User orders

#### **Real-time Events**
- `driver-location` - Live driver location updates
- `status-update` - Order status changes
- `order-assigned` - Driver assignment

### **Database Models**

#### **Users**
- Authentication & authorization
- Addresses & preferences
- Order history & loyalty points

#### **Restaurants**
- Menu management
- Operating hours & delivery info
- Ratings & reviews

#### **Orders**
- Order items & pricing
- Delivery tracking
- Payment status

#### **Drivers**
- Vehicle & license info
- Availability & location
- Performance stats

## 🤖 AI Recommendation Engine

### **Features**
- **Collaborative filtering** based on similar users
- **Content-based recommendations** using preferences
- **Trending analysis** for popular items
- **Location-based suggestions**

### **Usage**
```javascript
const recommendations = await recommendationService.getPersonalizedRecommendations(userId, 10);
```

## 📦 Advanced Features

### **Scheduled Deliveries**
- Order in advance
- Time slot management
- Automated reminders

### **Group Ordering**
- Collaborative ordering
- Shareable links
- Split payments

### **Real-time Tracking**
- Live driver location
- Estimated arrival times
- Route optimization

## 🚀 Deployment

### **Development**
```bash
docker-compose up -d
```

### **Production**
```bash
# Set production environment variables
export NODE_ENV=production

# Deploy with production configuration
./scripts/deploy.sh
```

### **Environment Variables**
```env
# Server
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/fooddelivery
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key

# External APIs
GOOGLE_MAPS_API_KEY=your-google-maps-key
STRIPE_SECRET_KEY=your-stripe-secret-key
TWILIO_ACCOUNT_SID=your-twilio-sid
```

## 🔍 Monitoring & Logging

### **Health Checks**
```bash
curl http://localhost/health
```

### **Logs**
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f mongo

# Redis logs
docker-compose logs -f redis
```

### **Monitoring (Optional)**
```bash
# Start monitoring stack
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Access Grafana
http://localhost:3001
```

## 🧪 Testing

### **Backend Tests**
```bash
cd backend
npm test
npm run test:coverage
```

### **Mobile Tests**
```bash
cd mobile
npm test
```

## 📊 API Documentation

### **Authentication**
All API endpoints (except auth) require JWT token:
```javascript
headers: {
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
```

### **Rate Limiting**
- General API: 100 requests per 15 minutes
- Login endpoint: 5 requests per minute

### **Error Responses**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info"
}
```

## 🔒 Security Features

- **JWT authentication** with refresh tokens
- **Input validation** using Joi
- **Rate limiting** for API protection
- **CORS configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Password hashing** with bcrypt
- **Role-based access control**

## 📱 Mobile App Features

### **Core Screens**
- **Home** - Featured restaurants, recommendations
- **Search** - Restaurant and food search
- **Restaurant Detail** - Menu, reviews, info
- **Cart** - Item management, checkout
- **Order Tracking** - Real-time delivery tracking
- **Profile** - User settings, order history

### **Key Components**
- **Real-time updates** via WebSocket
- **Offline support** with local caching
- **Push notifications** for order updates
- **Location services** for delivery tracking
- **Payment integration** with Stripe

## 🛠️ Development Workflow

### **1. Feature Development**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Add tests
# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### **2. Code Quality**
```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test

# Check coverage
npm run test:coverage
```

## 🐛 Troubleshooting

### **Common Issues**

#### **MongoDB Connection**
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Check logs
docker-compose logs mongo
```

#### **Redis Connection**
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check logs
docker-compose logs redis
```

#### **Mobile App Issues**
```bash
# Clear Metro cache
npx react-native start --reset-cache

# Clear Android build
cd android && ./gradlew clean

# Clear iOS build
cd ios && xcodebuild clean
```

### **Performance Issues**
- Check Redis cache hit rates
- Monitor database query performance
- Review API response times
- Check memory usage

## 📞 Support

### **Getting Help**
1. Check this guide first
2. Review error logs
3. Search existing issues
4. Create new issue with details

### **Useful Commands**
```bash
# Check system status
docker-compose ps

# View resource usage
docker stats

# Backup data
./scripts/deploy.sh backup

# Check health
./scripts/deploy.sh health
```

## 🎯 Next Steps

### **For Development**
1. Set up your development environment
2. Run the application locally
3. Explore the API endpoints
4. Test the mobile app
5. Contribute to the project

### **For Production**
1. Configure production environment
2. Set up SSL certificates
3. Configure monitoring
4. Set up backup strategies
5. Deploy to production

---

## 📝 Additional Resources

- [API Documentation](./docs/API.md)
- [Mobile App Guide](./docs/MOBILE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Contributing Guidelines](./docs/CONTRIBUTING.md)

**Happy Coding! 🎉**
