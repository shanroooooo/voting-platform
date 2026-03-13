describe('Auth API', () => {
  beforeEach(() => {
    // Reset any mocks or setup before each test
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it('should reject login with invalid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with missing fields', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'newuser@example.com',
        phone: '+1234567890',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com', // Already exists
        phone: '+1234567890',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });
});

describe('Restaurant API', () => {
  describe('GET /api/restaurants', () => {
    it('should return list of restaurants', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurants).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter restaurants by cuisine', async () => {
      const response = await request(app)
        .get('/api/restaurants?cuisine=italian')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.restaurants.forEach(restaurant => {
        expect(restaurant.cuisineType).toContain('italian');
      });
    });
  });

  describe('GET /api/restaurants/:id', () => {
    it('should return restaurant details', async () => {
      const restaurantId = 'validRestaurantId';
      
      const response = await request(app)
        .get(`/api/restaurants/${restaurantId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(restaurantId);
      expect(response.body.data.menu).toBeDefined();
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/restaurants/invalidId')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});

describe('Order API', () => {
  let authToken;

  beforeEach(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.data.token;
  });

  describe('POST /api/orders', () => {
    it('should create new order', async () => {
      const orderData = {
        restaurant: 'validRestaurantId',
        items: [
          {
            menuItem: 'validMenuItemId',
            quantity: 2
          }
        ],
        deliveryAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'USA'
        },
        paymentMethod: 'card'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.totalAmount).toBeGreaterThan(0);
    });

    it('should reject order creation without auth', async () => {
      const orderData = {
        restaurant: 'validRestaurantId',
        items: [{ menuItem: 'validMenuItemId', quantity: 1 }],
        deliveryAddress: { street: '123 Test St', city: 'Test City', state: 'TS', zipCode: '12345', country: 'USA' },
        paymentMethod: 'card'
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const orderId = 'validOrderId';
      
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('confirmed');
    });

    it('should reject invalid status transition', async () => {
      const orderId = 'validOrderId';
      
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'delivered' }) // Invalid transition
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid status transition');
    });
  });
});

describe('Middleware', () => {
  describe('Authentication Middleware', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer validToken')
        .expect(200);
    });

    it('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalidToken')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('Validation Middleware', () => {
    it('should validate user data', async () => {
      const invalidUserData = {
        name: '', // Empty name
        email: 'invalid-email',
        phone: '123'
      };

      const response = await request(app)
        .post('/api/users/profile')
        .send(invalidUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });

    it('should validate order data', async () => {
      const invalidOrderData = {
        restaurant: '', // Missing restaurant
        items: [], // Empty items
        deliveryAddress: {}, // Incomplete address
        paymentMethod: 'invalid'
      };

      const response = await request(app)
        .post('/api/orders')
        .send(invalidOrderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation error');
    });
  });
});

describe('Error Handling', () => {
  it('should handle 404 errors', async () => {
    const response = await request(app)
      .get('/api/nonexistent')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('not found');
  });

  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBeDefined();
  });

  it('should handle server errors', async () => {
    // Mock a server error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const response = await request(app)
      .get('/api/test-error')
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBeDefined();
    
    console.error.mockRestore();
  });
});

describe('Socket.IO Events', () => {
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    // Setup socket connection for testing
    clientSocket = io('http://localhost:3000');
    serverSocket = io.sockets.sockets[clientSocket.id];
    
    serverSocket.on('connection', () => {
      done();
    });
  });

  afterAll(() => {
    clientSocket.close();
  });

  it('should handle order status updates', (done) => {
    const orderData = {
      orderId: 'testOrderId',
      status: 'confirmed',
      timestamp: new Date()
    };

    clientSocket.on('status-update', (data) => {
      expect(data.orderId).toBe(orderData.orderId);
      expect(data.status).toBe(orderData.status);
      done();
    });

    serverSocket.emit('status-update', orderData);
  });

  it('should handle driver location updates', (done) => {
    const locationData = {
      orderId: 'testOrderId',
      driverId: 'testDriverId',
      location: { latitude: 40.7128, longitude: -74.0060 },
      timestamp: new Date()
    };

    clientSocket.on('driver-location', (data) => {
      expect(data.orderId).toBe(locationData.orderId);
      expect(data.location).toBeDefined();
      done();
    });

    serverSocket.emit('driver-location', locationData);
  });
});
