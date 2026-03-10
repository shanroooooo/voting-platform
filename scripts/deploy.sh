#!/bin/bash

# Food Delivery Platform Deployment Script
# This script handles the deployment of the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."
    
    required_vars=(
        "NODE_ENV"
        "MONGODB_URI"
        "REDIS_URL"
        "JWT_SECRET"
        "GOOGLE_MAPS_API_KEY"
        "STRIPE_SECRET_KEY"
        "TWILIO_ACCOUNT_SID"
        "TWILIO_AUTH_TOKEN"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_status "All required environment variables are set"
}

# Backup existing data
backup_data() {
    print_status "Creating backup of existing data..."
    
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB if running
    if docker ps | grep -q mongo; then
        docker exec mongo mongodump --out /tmp/backup
        docker cp mongo:/tmp/backup "$BACKUP_DIR/mongodb"
        print_status "MongoDB backup created"
    fi
    
    # Backup Redis if running
    if docker ps | grep -q redis; then
        docker exec redis redis-cli BGSAVE
        docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb"
        print_status "Redis backup created"
    fi
    
    print_status "Backup completed: $BACKUP_DIR"
}

# Build and deploy application
deploy_application() {
    print_status "Building and deploying application..."
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose -f docker-compose.prod.yml down
    
    # Build new images
    print_status "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Start services
    print_status "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
}

# Check application health
check_health() {
    print_status "Checking application health..."
    
    # Check if backend is responding
    if curl -f http://localhost/health > /dev/null 2>&1; then
        print_status "Backend API is healthy"
    else
        print_error "Backend API is not responding"
        return 1
    fi
    
    # Check database connections
    if docker exec mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        print_status "MongoDB is healthy"
    else
        print_error "MongoDB is not responding"
        return 1
    fi
    
    if docker exec redis redis-cli ping > /dev/null 2>&1; then
        print_status "Redis is healthy"
    else
        print_error "Redis is not responding"
        return 1
    fi
    
    print_status "All services are healthy"
}

# Seed database with initial data
seed_database() {
    print_status "Seeding database..."
    
    # Run seed script
    docker-compose -f docker-compose.prod.yml exec app npm run seed
    
    print_status "Database seeding completed"
}

# Setup SSL certificates
setup_ssl() {
    print_status "Setting up SSL certificates..."
    
    # Create SSL directory if it doesn't exist
    mkdir -p ./nginx/ssl
    
    # Generate self-signed certificate for development
    if [ "$NODE_ENV" = "development" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ./nginx/ssl/nginx.key \
            -out ./nginx/ssl/nginx.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        print_status "Self-signed SSL certificate generated"
    else
        print_warning "Please provide your own SSL certificates for production"
    fi
}

# Main deployment function
main() {
    print_status "Starting Food Delivery Platform deployment..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_status "Environment variables loaded from .env file"
    else
        print_warning ".env file not found. Using system environment variables."
    fi
    
    # Check required environment variables
    check_env_vars
    
    # Setup SSL certificates
    setup_ssl
    
    # Create backup
    backup_data
    
    # Deploy application
    deploy_application
    
    # Seed database if this is a fresh deployment
    if [ "$SEED_DATABASE" = "true" ]; then
        seed_database
    fi
    
    # Show deployment status
    print_status "Deployment completed successfully!"
    print_status "Application is running at: http://localhost"
    print_status "Health check endpoint: http://localhost/health"
    
    if [ "$NODE_ENV" = "production" ]; then
        print_status "Production deployment completed"
        print_status "Don't forget to:"
        print_status "1. Configure your domain name"
        print_status "2. Set up proper SSL certificates"
        print_status "3. Configure monitoring and logging"
        print_status "4. Set up backup strategies"
    fi
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "backup")
        backup_data
        ;;
    "health")
        check_health
        ;;
    "seed")
        seed_database
        ;;
    "ssl")
        setup_ssl
        ;;
    "logs")
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    "stop")
        docker-compose -f docker-compose.prod.yml down
        print_status "Application stopped"
        ;;
    "restart")
        docker-compose -f docker-compose.prod.yml restart
        check_health
        ;;
    *)
        echo "Usage: $0 {deploy|backup|health|seed|ssl|logs|stop|restart}"
        echo "  deploy  - Full deployment (default)"
        echo "  backup  - Create backup of existing data"
        echo "  health  - Check application health"
        echo "  seed    - Seed database with initial data"
        echo "  ssl     - Setup SSL certificates"
        echo "  logs    - Show application logs"
        echo "  stop    - Stop application"
        echo "  restart - Restart application"
        exit 1
        ;;
esac
