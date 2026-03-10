import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
  ImageBackground,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';
import Carousel from 'react-native-snap-carousel';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchNearbyRestaurants,
  fetchPopularRestaurants,
  fetchFeaturedRestaurants,
} from '../../store/slices/restaurantSlice';
import {
  fetchActiveOrder,
  clearActiveOrder,
} from '../../store/slices/orderSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import SearchBar from '../../components/common/SearchBar';
import CategoryCard from '../../components/restaurant/CategoryCard';
import RestaurantCard from '../../components/restaurant/RestaurantCard';
import PromoBanner from '../../components/home/PromoBanner';
import ActiveOrderCard from '../../components/order/ActiveOrderCard';
import QuickActions from '../../components/home/QuickActions';

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currentLocation } = useLocation();
  const dispatch = useDispatch();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const scrollY = new Animated.Value(0);

  const {
    nearbyRestaurants,
    popularRestaurants,
    featuredRestaurants,
    loading,
    error,
  } = useSelector(state => state.restaurants);

  const { activeOrder } = useSelector(state => state.orders);

  // Categories
  const categories = [
    { id: '1', name: 'Pizza', icon: 'local-pizza', color: '#FF6B35' },
    { id: '2', name: 'Burger', icon: 'lunch-dining', color: '#4CAF50' },
    { id: '3', name: 'Sushi', icon: 'set-meal', color: '#2196F3' },
    { id: '4', name: 'Pasta', icon: 'restaurant', color: '#FF9800' },
    { id: '5', name: 'Salad', icon: 'eco', color: '#8BC34A' },
    { id: '6', name: 'Dessert', icon: 'cake', color: '#E91E63' },
    { id: '7', name: 'Chinese', icon: 'ramen-dining', color: '#9C27B0' },
    { id: '8', name: 'Mexican', icon: 'taco', color: '#FF5722' },
  ];

  // Promo banners
  const promoBanners = [
    {
      id: '1',
      title: '30% OFF',
      subtitle: 'On your first order',
      image: 'https://example.com/promo1.jpg',
      backgroundColor: '#FF6B35',
    },
    {
      id: '2',
      title: 'Free Delivery',
      subtitle: 'Orders above $25',
      image: 'https://example.com/promo2.jpg',
      backgroundColor: '#4CAF50',
    },
    {
      id: '3',
      title: 'Buy 1 Get 1',
      subtitle: 'Selected restaurants',
      image: 'https://example.com/promo3.jpg',
      backgroundColor: '#2196F3',
    },
  ];

  useEffect(() => {
    loadData();
  }, [currentLocation]);

  const loadData = useCallback(async () => {
    if (currentLocation) {
      try {
        await Promise.all([
          dispatch(fetchNearbyRestaurants({
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
          })),
          dispatch(fetchPopularRestaurants()),
          dispatch(fetchFeaturedRestaurants()),
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
  }, [dispatch, currentLocation]);

  useEffect(() => {
    if (user) {
      dispatch(fetchActiveOrder());
    }
  }, [dispatch, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      navigation.navigate('RestaurantList', { searchQuery: query });
    }
  };

  const handleCategoryPress = (category) => {
    setSelectedCategory(category.id);
    navigation.navigate('RestaurantList', { 
      category: category.name.toLowerCase(),
      categoryName: category.name,
    });
  };

  const handleRestaurantPress = (restaurant) => {
    navigation.navigate('RestaurantDetail', { restaurantId: restaurant._id });
  };

  const renderPromoBanner = ({ item, index }) => (
    <PromoBanner
      title={item.title}
      subtitle={item.subtitle}
      image={item.image}
      backgroundColor={item.backgroundColor}
      onPress={() => console.log('Promo pressed:', item.id)}
    />
  );

  const renderCategoryItem = ({ item }) => (
    <CategoryCard
      category={item}
      onPress={() => handleCategoryPress(item)}
      selected={selectedCategory === item.id}
    />
  );

  const renderRestaurantItem = ({ item }) => (
    <RestaurantCard
      restaurant={item}
      onPress={() => handleRestaurantPress(item)}
      showDistance={!!currentLocation}
    />
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading && nearbyRestaurants.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.primary,
            opacity: headerOpacity,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              Good {getTimeOfDay()}, {user?.name?.split(' ')[0]}!
            </Text>
            <Text style={styles.locationText}>
              {currentLocation ? 'Current Location' : 'Set Location'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon name="notifications" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Static Header */}
        <View style={[styles.staticHeader, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>
                Good {getTimeOfDay()}, {user?.name?.split(' ')[0]}!
              </Text>
              <Text style={styles.locationText}>
                {currentLocation ? 'Current Location' : 'Set Location'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Icon name="notifications" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch(searchQuery)}
              placeholder="Search restaurants or dishes..."
            />
          </View>
        </View>

        {/* Active Order */}
        {activeOrder && (
          <View style={styles.activeOrderContainer}>
            <ActiveOrderCard
              order={activeOrder}
              onPress={() => navigation.navigate('OrderTracking', {
                orderId: activeOrder._id,
              })}
            />
          </View>
        )}

        {/* Quick Actions */}
        <QuickActions
          onOrderAgain={() => navigation.navigate('OrderHistory')}
          onTrackOrder={() => activeOrder && navigation.navigate('OrderTracking', {
            orderId: activeOrder._id,
          })}
          onSupport={() => navigation.navigate('Help')}
        />

        {/* Promo Banners */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Special Offers
          </Text>
          <Carousel
            data={promoBanners}
            renderItem={renderPromoBanner}
            sliderWidth={screenWidth}
            itemWidth={screenWidth - 40}
            slideStyle={styles.carouselSlide}
            containerCustomStyle={styles.carouselContainer}
            loop={true}
            autoplay={true}
            autoplayInterval={3000}
          />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Categories
          </Text>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Featured Restaurants */}
        {featuredRestaurants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Featured Restaurants
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RestaurantList', {
                  featured: true,
                })}
              >
                <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={featuredRestaurants.slice(0, 5)}
              renderItem={renderRestaurantItem}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restaurantsList}
            />
          </View>
        )}

        {/* Popular Restaurants */}
        {popularRestaurants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Popular Near You
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RestaurantList', {
                  popular: true,
                })}
              >
                <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={popularRestaurants.slice(0, 5)}
              renderItem={renderRestaurantItem}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restaurantsList}
            />
          </View>
        )}

        {/* Nearby Restaurants */}
        {nearbyRestaurants.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Nearby Restaurants
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RestaurantList', {
                  nearby: true,
                })}
              >
                <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={nearbyRestaurants.slice(0, 5)}
              renderItem={renderRestaurantItem}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restaurantsList}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50,
  },
  staticHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  notificationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  searchContainer: {
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  activeOrderContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  section: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  carouselContainer: {
    marginTop: 15,
  },
  carouselSlide: {
    marginHorizontal: 20,
  },
  categoriesList: {
    paddingRight: 20,
  },
  restaurantsList: {
    paddingRight: 20,
  },
});

export default HomeScreen;
