# Food Delivery & Logistics Platform

A comprehensive food delivery system with real-time tracking, AI-powered recommendations, and advanced logistics features.

## 🚀 Features

### Core Features
- **Multi-restaurant ordering** with real-time inventory
- **Real-time order tracking** with WebSocket integration
- **Route optimization** using Google Maps API
- **AI-powered recommendations** based on user preferences
- **Scheduled deliveries** with time slot management
- **Group ordering** for collaborative purchases

### Advanced Features
- **Smart notifications** for order updates
- **Loyalty program** integration
- **Multiple payment options** (Stripe, PayPal, Cash)
- **Driver management** with location tracking
- **Analytics dashboard** for restaurant partners
- **Customer support** chat system

## 🛠 Tech Stack

### Frontend (Mobile)
- **React Native** - Cross-platform mobile development
- **Redux Toolkit** - State management
- **React Navigation** - Navigation and routing
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Primary database
- **Redis** - Caching and session management
- **Socket.IO** - Real-time WebSocket connections

### External Services
- **Google Maps API** - Route optimization and geocoding
- **Stripe** - Payment processing
- **Twilio** - SMS notifications
- **SendGrid** - Email services

## 📱 Installation

### Prerequisites
- Node.js 16+
- MongoDB 5.0+
- Redis 7.0+
- React Native CLI
- Android Studio / Xcode (for mobile development)

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd food-delivery-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services**
```bash
# Start MongoDB and Redis
docker-compose up -d mongo redis

# Start backend server
npm run dev

# Start mobile app (new terminal)
npm run mobile
```

## 🏗 Project Structure

```
food-delivery-platform/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── mobile/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── navigation/
│   │   ├── services/
│   │   └── utils/
│   ├── android/
│   └── ios/
├── docs/
├── docker-compose.yml
└── README.md
```

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/fooddelivery
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=7d

# External APIs
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment

1. **Backend Deployment**
```bash
cd backend
npm run build
npm start
```

2. **Mobile App Deployment**
- Android: Generate APK/AAB and publish to Google Play Store
- iOS: Build IPA and publish to App Store

## 📊 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token

### Restaurant Endpoints

- `GET /api/restaurants` - List restaurants
- `GET /api/restaurants/:id` - Get restaurant details
- `GET /api/restaurants/:id/menu` - Get restaurant menu

### Order Endpoints

- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run mobile tests
cd mobile
npm test
```

## 📈 Performance

### Optimization Features
- **Redis caching** for frequently accessed data
- **Database indexing** for fast queries
- **Image optimization** and CDN integration
- **Lazy loading** for mobile components

### Monitoring
- **Winston logging** for application logs
- **Performance metrics** tracking
- **Error tracking** and alerting

## 🔒 Security

- **JWT authentication** with refresh tokens
- **Input validation** using Joi
- **Rate limiting** for API protection
- **CORS configuration** for cross-origin requests
- **Helmet.js** for security headers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions, please contact:
- Email: support@fooddelivery.com
- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)

## 🎯 Roadmap

### Phase 1 (Current)
- [x] Basic ordering system
- [x] Real-time tracking
- [x] Payment integration

### Phase 2 (Upcoming)
- [ ] AI recommendations
- [ ] Scheduled deliveries
- [ ] Group ordering

### Phase 3 (Future)
- [ ] Drone delivery integration
- [ ] Advanced analytics
- [ ] International expansion
