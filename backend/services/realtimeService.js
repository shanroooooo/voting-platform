const { redisUtils } = require('../config/redis');
const Order = require('../models/Order');
const Driver = require('../models/Driver');
const logger = require('../utils/logger');

class RealtimeService {
  constructor(io) {
    this.io = io;
  }

  // Handle driver location updates
  async handleDriverLocationUpdate(socket, data) {
    try {
      const { orderId, driverId, location } = data;
      
      if (!orderId || !driverId || !location) {
        throw new Error('Missing required fields for location update');
      }

      // Validate location data
      if (!location.lat || !location.lng) {
        throw new Error('Invalid location coordinates');
      }

      // Update driver location in database
      const driver = await Driver.findById(driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }

      await driver.updateLocation(location.lat, location.lng);

      // Cache driver location in Redis with 5-minute TTL
      await redisUtils.setex(
        `driver:${driverId}:location`,
        300, // 5 minutes
        {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString(),
        }
      );

      // Update order tracking information
      const order = await Order.findById(orderId);
      if (order && order.driverId.toString() === driverId) {
        order.tracking.driverLocation = {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date(),
        };
        order.tracking.lastUpdate = new Date();
        
        // Calculate estimated arrival time
        if (order.status === 'on_the_way') {
          const estimatedArrival = await this.calculateEstimatedArrival(
            location,
            order.deliveryAddress.coordinates
          );
          order.tracking.estimatedArrival = estimatedArrival;
        }
        
        await order.save();

        // Broadcast to order room
        this.io.to(`order-${orderId}`).emit('driver-location', {
          orderId,
          driverId,
          location: {
            lat: location.lat,
            lng: location.lng,
            timestamp: new Date().toISOString(),
          },
          estimatedArrival: order.tracking.estimatedArrival,
        });

        // Update driver room as well
        this.io.to(`driver-${driverId}`).emit('location-updated', {
          location,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Driver location updated: ${driverId} for order ${orderId}`);
    } catch (error) {
      logger.error('Error handling driver location update:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }

  // Handle order status updates
  async handleOrderStatusUpdate(socket, data) {
    try {
      const { orderId, status, note, updatedBy } = data;
      
      if (!orderId || !status) {
        throw new Error('Missing required fields for status update');
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate status transition
      const validTransitions = this.getValidStatusTransitions(order.status);
      if (!validTransitions.includes(status)) {
        throw new Error(`Invalid status transition from ${order.status} to ${status}`);
      }

      // Update order status
      await order.updateStatus(status, note, updatedBy);

      // Handle specific status logic
      if (status === 'delivered') {
        await this.handleOrderDelivered(order);
      } else if (status === 'cancelled') {
        await this.handleOrderCancelled(order);
      }

      // Broadcast status update
      this.io.to(`order-${orderId}`).emit('status-update', {
        orderId,
        status,
        note,
        updatedBy,
        timestamp: new Date().toISOString(),
        statusHistory: order.statusHistory,
      });

      // Update restaurant and driver rooms
      this.io.to(`restaurant-${order.restaurantId}`).emit('order-status-update', {
        orderId,
        status,
        timestamp: new Date().toISOString(),
      });

      if (order.driverId) {
        this.io.to(`driver-${order.driverId}`).emit('order-status-update', {
          orderId,
          status,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Order status updated: ${orderId} -> ${status}`);
    } catch (error) {
      logger.error('Error handling order status update:', error);
      socket.emit('error', { message: 'Failed to update order status' });
    }
  }

  // Handle driver assignment
  async handleDriverAssignment(socket, data) {
    try {
      const { orderId, driverId } = data;
      
      if (!orderId || !driverId) {
        throw new Error('Missing required fields for driver assignment');
      }

      const order = await Order.findById(orderId);
      const driver = await Driver.findById(driverId);

      if (!order || !driver) {
        throw new Error('Order or driver not found');
      }

      // Check if driver is available
      if (!driver.availability.isOnline || driver.currentOrder) {
        throw new Error('Driver is not available');
      }

      // Assign driver to order
      order.driverId = driverId;
      order.status = 'confirmed';
      await order.save();

      // Assign order to driver
      await driver.acceptOrder(orderId);

      // Notify driver
      this.io.to(`driver-${driverId}`).emit('order-assigned', {
        order: order,
        timestamp: new Date().toISOString(),
      });

      // Notify customer
      this.io.to(`order-${orderId}`).emit('driver-assigned', {
        orderId,
        driverId,
        driver: {
          name: driver.userId.name,
          phone: driver.userId.phone,
          vehicle: driver.vehicle,
        },
        timestamp: new Date().toISOString(),
      });

      logger.info(`Driver assigned: ${driverId} to order ${orderId}`);
    } catch (error) {
      logger.error('Error handling driver assignment:', error);
      socket.emit('error', { message: 'Failed to assign driver' });
    }
  }

  // Calculate estimated arrival time
  async calculateEstimatedArrival(currentLocation, destinationLocation) {
    try {
      // This would typically use Google Maps Distance Matrix API
      // For now, we'll use a simple calculation
      
      const distance = this.calculateDistance(
        currentLocation,
        destinationLocation
      );
      
      // Assume average speed of 30 km/h in city
      const averageSpeed = 30; // km/h
      const timeInHours = distance / averageSpeed;
      const timeInMinutes = timeInHours * 60;
      
      // Add buffer time for traffic, stops, etc.
      const bufferTime = 10; // minutes
      const totalMinutes = timeInMinutes + bufferTime;
      
      return new Date(Date.now() + totalMinutes * 60 * 1000);
    } catch (error) {
      logger.error('Error calculating estimated arrival:', error);
      // Return default estimate (30 minutes from now)
      return new Date(Date.now() + 30 * 60 * 1000);
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  // Get valid status transitions
  getValidStatusTransitions(currentStatus) {
    const transitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['picked_up', 'cancelled'],
      'picked_up': ['on_the_way'],
      'on_the_way': ['delivered'],
      'delivered': [],
      'cancelled': [],
      'refunded': [],
    };
    
    return transitions[currentStatus] || [];
  }

  // Handle order delivered
  async handleOrderDelivered(order) {
    try {
      // Update driver stats
      if (order.driverId) {
        const driver = await Driver.findById(order.driverId);
        if (driver) {
          await driver.updateOrderStatus('delivered');
        }
      }

      // Update restaurant stats
      // This would be handled by the restaurant service

      // Send notifications
      // This would be handled by the notification service

      logger.info(`Order delivered: ${order._id}`);
    } catch (error) {
      logger.error('Error handling order delivered:', error);
    }
  }

  // Handle order cancelled
  async handleOrderCancelled(order) {
    try {
      // Release driver if assigned
      if (order.driverId) {
        const driver = await Driver.findById(order.driverId);
        if (driver) {
          driver.currentOrder = null;
          await driver.save();
        }
      }

      // Process refund if payment was made
      if (order.paymentStatus === 'paid') {
        // This would be handled by the payment service
      }

      logger.info(`Order cancelled: ${order._id}`);
    } catch (error) {
      logger.error('Error handling order cancelled:', error);
    }
  }

  // Get active orders for a driver
  async getDriverActiveOrders(driverId) {
    try {
      const orders = await Order.find({
        driverId,
        status: { $in: ['confirmed', 'preparing', 'ready', 'picked_up', 'on_the_way'] },
      }).populate('restaurantId userId');

      return orders;
    } catch (error) {
      logger.error('Error getting driver active orders:', error);
      return [];
    }
  }

  // Get nearby available drivers
  async getNearbyAvailableDrivers(location, radius = 5) {
    try {
      const drivers = await Driver.find({
        'availability.isOnline': true,
        isActive: true,
        verificationStatus: 'approved',
        currentOrder: null,
      }).populate('userId');

      // Filter by distance
      const nearbyDrivers = drivers.filter(driver => {
        const distance = this.calculateDistance(
          location,
          driver.availability.currentLocation
        );
        return distance <= radius;
      });

      return nearbyDrivers;
    } catch (error) {
      logger.error('Error getting nearby available drivers:', error);
      return [];
    }
  }

  // Broadcast system notifications
  async broadcastSystemNotification(notification) {
    try {
      this.io.emit('system-notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error broadcasting system notification:', error);
    }
  }

  // Get real-time order statistics
  async getRealtimeStats() {
    try {
      const stats = await Promise.all([
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'on_the_way' }),
        Order.countDocuments({ status: 'delivered', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        Driver.countDocuments({ 'availability.isOnline': true }),
      ]);

      return {
        pendingOrders: stats[0],
        activeDeliveries: stats[1],
        deliveredToday: stats[2],
        onlineDrivers: stats[3],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error getting realtime stats:', error);
      return null;
    }
  }
}

module.exports = RealtimeService;
