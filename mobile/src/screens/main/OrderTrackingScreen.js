import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import io from 'socket.io-client';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../context/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import {
  getOrderDetails,
  updateOrderStatus,
} from '../../store/slices/orderSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusTimeline from '../../components/order/StatusTimeline';
import DriverInfoCard from '../../components/order/DriverInfoCard';
import OrderSummaryCard from '../../components/order/OrderSummaryCard';
import ActionButtons from '../../components/order/ActionButtons';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const OrderTrackingScreen = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const route = useRoute();
  const dispatch = useDispatch();

  const { orderId } = route.params;
  const [socket, setSocket] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [estimatedArrival, setEstimatedArrival] = useState(null);
  const mapRef = useRef(null);

  const { currentOrder, loading, error } = useSelector(state => state.orders);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3000', {
      auth: {
        token: user?.token,
      },
    });

    newSocket.emit('join-order', orderId);

    newSocket.on('driver-location', (data) => {
      if (data.orderId === orderId) {
        setDriverLocation(data.location);
        updateMapRegion(data.location);
      }
    });

    newSocket.on('status-update', (data) => {
      if (data.orderId === orderId) {
        dispatch(updateOrderStatus(data));
      }
    });

    newSocket.on('order-estimated-arrival', (data) => {
      if (data.orderId === orderId) {
        setEstimatedArrival(data.estimatedArrival);
      }
    });

    setSocket(newSocket);

    // Load order details
    dispatch(getOrderDetails(orderId));

    return () => {
      newSocket.disconnect();
    };
  }, [orderId, user?.token, dispatch]);

  useEffect(() => {
    if (currentOrder) {
      // Set restaurant location
      setRestaurantLocation(currentOrder.restaurantId.address.coordinates);
      
      // Set delivery location
      setDeliveryLocation(currentOrder.deliveryAddress.coordinates);
      
      // Calculate route
      calculateRoute();
    }
  }, [currentOrder]);

  const updateMapRegion = (location) => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }, 1000);
    }
  };

  const calculateRoute = () => {
    if (!restaurantLocation || !deliveryLocation) return;

    // This would typically use Google Maps Directions API
    // For now, we'll create a simple straight line
    const coordinates = [
      {
        latitude: restaurantLocation.lat,
        longitude: restaurantLocation.lng,
      },
      {
        latitude: deliveryLocation.lat,
        longitude: deliveryLocation.lng,
      },
    ];

    setRouteCoordinates(coordinates);
  };

  const handleCallDriver = () => {
    if (currentOrder?.driverId?.phone) {
      Linking.openURL(`tel:${currentOrder.driverId.phone}`);
    }
  };

  const handleMessageDriver = () => {
    // Navigate to chat screen or open messaging app
    Alert.alert('Message Driver', 'Messaging feature coming soon!');
  };

  const handleShareOrder = async () => {
    try {
      const shareMessage = `I'm ordering from ${currentOrder?.restaurantId?.name}! Track my order with Food Delivery App.`;
      await Share.share({
        message: shareMessage,
        title: 'Share Order',
      });
    } catch (error) {
      console.error('Error sharing order:', error);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            // Dispatch cancel order action
            // dispatch(cancelOrder(orderId));
          },
        },
      ]
    );
  };

  const handleGetHelp = () => {
    // Navigate to help screen
    Alert.alert('Get Help', 'Help feature coming soon!');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !currentOrder) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          {error || 'Order not found'}
        </Text>
      </View>
    );
  }

  const mapRegion = {
    latitude: driverLocation?.lat || restaurantLocation?.lat || deliveryLocation?.lat,
    longitude: driverLocation?.lng || restaurantLocation?.lng || deliveryLocation?.lng,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        followsUserLocation
      >
        {/* Restaurant Marker */}
        {restaurantLocation && (
          <Marker
            coordinate={{
              latitude: restaurantLocation.lat,
              longitude: restaurantLocation.lng,
            }}
            title={currentOrder.restaurantId.name}
            description="Restaurant"
          >
            <View style={[styles.markerContainer, { backgroundColor: theme.colors.primary }]}>
              <Icon name="restaurant" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Delivery Location Marker */}
        {deliveryLocation && (
          <Marker
            coordinate={{
              latitude: deliveryLocation.lat,
              longitude: deliveryLocation.lng,
            }}
            title="Delivery Location"
            description="Your location"
          >
            <View style={[styles.markerContainer, { backgroundColor: theme.colors.success }]}>
              <Icon name="home" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
            }}
            title="Driver"
            description="Your driver"
          >
            <View style={[styles.markerContainer, { backgroundColor: theme.colors.info }]}>
              <Icon name="delivery-dining" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Route Line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={theme.colors.primary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Map Overlay Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={[styles.mapControlButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            if (driverLocation) {
              updateMapRegion(driverLocation);
            }
          }}
        >
          <Icon name="my-location" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}>
        {/* Status Timeline */}
        <StatusTimeline
          currentStatus={currentOrder.status}
          statusHistory={currentOrder.statusHistory}
        />

        {/* Estimated Arrival */}
        {estimatedArrival && (
          <View style={styles.arrivalContainer}>
            <Text style={[styles.arrivalTitle, { color: theme.colors.text }]}>
              Estimated Arrival
            </Text>
            <Text style={[styles.arrivalTime, { color: theme.colors.primary }]}>
              {new Date(estimatedArrival).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* Driver Info */}
        {currentOrder.driverId && (
          <DriverInfoCard
            driver={currentOrder.driverId}
            onCall={handleCallDriver}
            onMessage={handleMessageDriver}
          />
        )}

        {/* Order Summary */}
        <OrderSummaryCard order={currentOrder} />

        {/* Action Buttons */}
        <ActionButtons
          onShare={handleShareOrder}
          onCancel={handleCancelOrder}
          onGetHelp={handleGetHelp}
          canCancel={currentOrder.status === 'pending' || currentOrder.status === 'confirmed'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
  },
  mapControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 30,
    minHeight: height * 0.4,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  arrivalContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  arrivalTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  arrivalTime: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});

export default OrderTrackingScreen;
