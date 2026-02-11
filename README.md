# PassioGo Route Picker

A comprehensive JavaScript-based route picker application that integrates with PassioGo transit data and Google Maps API to provide real-time bus route information and selection.

## Features

- **Real-time Route Status**: Automatically checks and displays whether routes are currently active based on their schedules
- **Google Maps Integration**: Visual representation of routes on an interactive map
- **PassioGo API Integration**: Fetches live transit data from PassioGo feeds
- **Dynamic Filtering**: Search routes by name and filter by active/inactive status
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Schedule-based Visibility**: Routes automatically show/hide based on current time and day

## Core Components

### Route States

The application manages several key states:

- **routes**: Array of all available bus routes with their details
- **currentDate**: Current date and time (updates every second)
- **visibilityStatus**: Map object tracking which routes are currently active
- **selectedRoute**: Currently selected route for detailed view

### Key Methods

- **checkSchedule(route, time)**: Determines if a route is active based on its schedule
- **toggleVisibility(routeId, visible)**: Sets route visibility in the UI
- **isRouteVisible(routeId)**: Returns boolean indicating route visibility status
- **selectRoute(routeId)**: Selects a route and displays its details on the map

## File Structure

```
PassioGo/
├── index.html              # Main HTML structure
├── styles.css              # Complete CSS styling
├── app.js                  # Application initialization and Google Maps setup
├── RoutePicker.js          # Core RoutePicker class with state management
├── PassioGoAPI.js          # PassioGo API integration layer
└── README.md               # This documentation
```

## Setup Instructions

### 1. Google Maps API Key

Replace `YOUR_API_KEY` in `index.html` with your actual Google Maps API key:

```html
<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"></script>
```

### 2. PassioGo API Configuration

Update the PassioGo API configuration in `RoutePicker.js`:

```javascript
this.passioGoApiUrl = 'https://api.passio3.com/v1'; // Replace with actual PassioGo API endpoint
```

And in `PassioGoAPI.js`, provide your API key:

```javascript
const passioAPI = new PassioGoAPI('YOUR_PASSIO_API_KEY');
```

### 3. Running the Application

1. Open `index.html` in a web browser
2. The application will automatically initialize and load routes
3. If API endpoints are not available, sample data will be displayed

## Usage Examples

### Basic Route Picker Initialization

```javascript
// Initialize with default settings
const routePicker = new RoutePicker();

// Initialize with custom PassioGo API
const passioAPI = new PassioGoAPI('your-api-key');
const routePicker = new RoutePicker(passioAPI);
```

### Checking Route Status

```javascript
// Check if a specific route is currently active
const isActive = routePicker.checkSchedule(route, new Date());

// Get visibility status
const isVisible = routePicker.isRouteVisible('route_123');

// Toggle route visibility
routePicker.toggleVisibility('route_123', false);
```

### Custom Schedule Format

Routes should follow this schedule format:

```javascript
const routeSchedule = {
    monday: { start: '06:00', end: '23:00' },
    tuesday: { start: '06:00', end: '23:00' },
    wednesday: { start: '06:00', end: '23:00' },
    thursday: { start: '06:00', end: '23:00' },
    friday: { start: '06:00', end: '23:00' },
    saturday: { start: '07:00', end: '22:00' },
    sunday: { start: '08:00', end: '20:00' }
};
```

## API Integration

### PassioGo API Methods

The `PassioGoAPI` class provides methods for:

- `getRoutes()`: Fetch all available routes
- `getRoute(routeId)`: Get specific route details
- `getRouteVehicles(routeId)`: Get vehicles for a route
- `getRouteStops(routeId)`: Get stops for a route
- `getRouteSchedule(routeId)`: Get route schedule
- `getRealTimeVehicles(routeId)`: Get real-time vehicle positions

### Data Transformation

The API automatically transforms PassioGo data to the application's format:

```javascript
// Transformed route object
{
    id: 'route_123',
    name: 'Downtown Express',
    shortName: 'DX',
    color: '#ff6b6b',
    textColor: '#ffffff',
    schedule: { /* schedule object */ },
    coordinates: [ /* array of lat/lng points */ ]
}
```

## Schedule Checking Logic

The application uses a sophisticated schedule checking system:

1. **Time-based**: Checks current time against route schedule
2. **Day-specific**: Different schedules for different days of the week
3. **Real-time updates**: Automatically updates every 30 seconds
4. **Fallback handling**: Defaults to active if no schedule is available

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Mobile Optimization

- Responsive grid layout
- Touch-friendly interface
- Optimized for mobile data usage
- PWA-ready structure

## Performance Features

- **Caching**: API responses cached for 30 seconds
- **Lazy Loading**: Routes load on demand
- **Efficient Filtering**: Client-side search and filtering
- **Optimized Rendering**: Virtual scrolling for large route lists

## Error Handling

- Graceful fallback to sample data if APIs fail
- User-friendly error messages
- Automatic retry mechanisms
- Offline functionality with cached data

## Customization

### Styling

Modify `styles.css` to customize the appearance:

```css
/* Change primary color */
.route-item.selected {
    border-color: #your-color;
}

/* Update header gradient */
header {
    background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

### Behavior

Adjust update intervals and timeouts in `RoutePicker.js`:

```javascript
this.updateInterval = 30000; // Change update frequency
this.cacheTimeout = 30000;  // Change cache duration
```

## Troubleshooting

### Common Issues

1. **Google Maps not loading**: Check API key and internet connection
2. **PassioGo data not appearing**: Verify API endpoint and credentials
3. **Routes showing as inactive**: Check schedule format and current time
4. **Map not centered**: Ensure route coordinates are properly formatted

### Debug Mode

Enable console logging by adding to `RoutePicker.js`:

```javascript
constructor() {
    this.debug = true; // Enable debug mode
    // ... rest of constructor
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Contact the development team

---

**Note**: This application requires valid API keys for both Google Maps and PassioGo to function with live data. Sample data is provided for testing purposes.
