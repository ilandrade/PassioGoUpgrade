class RoutePicker {
    constructor(passioAPI = null) {
        // State management
        this.routes = [];
        this.currentDate = new Date();
        this.visibilityStatus = new Map();
        this.selectedRoute = null;
        this.map = null;
        this.markers = [];
        this.polylines = [];
        this.passioAPI = passioAPI;
        this.serviceAlerts = [];
        
        // Configuration
        this.passioGoApiUrl = 'https://api.passio3.com/v1'; // Replace with actual PassioGo API
        this.updateInterval = 30000; // 30 seconds
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            console.log('Initializing RoutePicker...');
            await this.loadRoutes();
            console.log('Routes loaded:', this.routes.length);
            await this.loadServiceAlerts();
            console.log('Service alerts loaded');
            this.startScheduleChecker();
            this.setupEventListeners();
            this.updateCurrentTime();
            setInterval(() => this.updateCurrentTime(), 1000);
            // Initial render of active routes
            await this.checkAllRoutesVisibility();
            this.renderActiveRoutes();
            console.log('RoutePicker initialization complete');
        } catch (error) {
            console.error('Failed to initialize RoutePicker:', error);
        }
    }
    
    // Load service alerts from PassioGo feed
    async loadServiceAlerts() {
        try {
            if (this.passioAPI) {
                this.serviceAlerts = await this.passioAPI.getServiceAlerts();
                this.renderServiceAlerts();
            }
        } catch (error) {
            console.error('Failed to load service alerts:', error);
            // Fallback to sample alerts
            this.loadSampleAlerts();
        }
    }
    
    // Render service alerts in the UI
    renderServiceAlerts() {
        const alertsContainer = document.getElementById('serviceAlerts');
        if (!alertsContainer) return;
        
        if (this.serviceAlerts.length === 0) {
            alertsContainer.innerHTML = '';
            return;
        }
        
        alertsContainer.innerHTML = `
            <div class="service-alerts">
                <h3>🚨 Service Alerts</h3>
                ${this.serviceAlerts.map(alert => `
                    <div class="alert-item alert-${alert.severity.toLowerCase()}">
                        <h4>${alert.header}</h4>
                        <p>${alert.description.replace(/br\//g, '<br>')}</p>
                        <small>
                            Active: ${alert.activePeriod[0]?.startDatetime || 'Unknown'} - 
                            ${alert.activePeriod[0]?.endDatetime || 'Unknown'}
                        </small>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Load sample alerts for testing
    loadSampleAlerts() {
        this.serviceAlerts = [
            {
                id: '1',
                header: 'Overnight PM Route',
                description: 'PassioGo is currently experiencing a technical issue that is preventing the display of the second Overnight PM routes shuttle information. Please note that the two Overnight PM Shuttles are operating on their regular schedule from 9:53 pm to 12:20 AM M-F.<br><br>We apologize for any inconvenience this may cause.<br><br>If you have any questions, please feel free to contact us at 617-495-0400.',
                severity: 'WARNING',
                activePeriod: [{
                    startDatetime: '2026-02-09 22:54:15',
                    endDatetime: '2026-02-17 00:20:15'
                }]
            }
        ];
        this.renderServiceAlerts();
    }
    
    // Load routes from PassioGo feed
    async loadRoutes() {
        try {
            console.log('Loading routes...');
            if (this.passioAPI) {
                // Load static GTFS data first
                console.log('Loading GTFS data...');
                const gtfsLoaded = await this.passioAPI.loadStaticGTFSData();
                console.log('GTFS loaded:', gtfsLoaded);
                
                if (gtfsLoaded) {
                    // Get routes from GTFS data
                    this.routes = this.passioAPI.getRoutes();
                    console.log('Loaded routes from GTFS:', this.routes.length, 'routes');
                    console.log('First route:', this.routes[0]);
                } else {
                    console.log('GTFS loading failed, using sample data');
                    // Fallback to sample data
                    this.loadSampleRoutes();
                }
            } else {
                console.log('No PassioAPI, using sample data');
                // Fallback to sample data
                this.loadSampleRoutes();
            }
            
            console.log('Total routes after loading:', this.routes.length);
            
            // Initial visibility check
            await this.checkAllRoutesVisibility();
            this.renderActiveRoutes();
            
        } catch (error) {
            console.error('Failed to load routes:', error);
            // Fallback to sample data
            this.loadSampleRoutes();
        }
    }
    
    // Generate default schedule for demo purposes
    generateDefaultSchedule(routeId) {
        return {
            monday: { start: '06:00', end: '23:00' },
            tuesday: { start: '06:00', end: '23:00' },
            wednesday: { start: '06:00', end: '23:00' },
            thursday: { start: '06:00', end: '23:00' },
            friday: { start: '06:00', end: '23:00' },
            saturday: { start: '07:00', end: '22:00' },
            sunday: { start: '08:00', end: '20:00' }
        };
    }
    
    // Check if a route is currently active based on schedule
    async checkSchedule(route, currentTime = this.currentDate) {
        if (!this.passioAPI) {
            // Fallback to simple time-based check
            const hour = currentTime.getHours();
            return hour >= 6 && hour <= 22; // Show routes between 6 AM and 10 PM
        }
        
        try {
            // Check if any service is active today
            let hasActiveService = false;
            for (const serviceId of route.serviceIds) {
                if (this.passioAPI.isServiceActiveOnDate(serviceId, currentTime)) {
                    hasActiveService = true;
                    break;
                }
            }
            
            // If no active service, check if there are active vehicles (fallback)
            if (!hasActiveService) {
                try {
                    const vehicles = await this.passioAPI.getRealTimeVehicles(route.id);
                    hasActiveService = vehicles.length > 0;
                    console.log(`Route ${route.id}: ${vehicles.length} active vehicles`);
                } catch (error) {
                    console.warn(`Failed to check vehicles for route ${route.id}:`, error);
                }
            }
            
            return hasActiveService;
        } catch (error) {
            console.error(`Schedule check failed for route ${route.id}:`, error);
            return false;
        }
    }
    
    // Check visibility for all routes
    async checkAllRoutesVisibility() {
        console.log('Checking visibility for all routes...');
        const currentHour = this.currentDate.getHours();
        const currentDay = this.currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        console.log(`Current time: ${currentHour}:00 on ${dayNames[currentDay]}`);
        
        for (const route of this.routes) {
            let isActive = await this.checkSchedule(route);
            
            // Simple time-based fallback: show routes between 6 AM and 11 PM
            if (!isActive && currentHour >= 6 && currentHour <= 23) {
                isActive = true;
                console.log(`Route ${route.shortName} (${route.id}) activated by time window (6 AM - 11 PM)`);
            }
            
            // Weekend vs weekday logic
            if (isActive) {
                if (currentDay === 0 || currentDay === 6) { // Weekend
                    console.log(`Route ${route.shortName} (${route.id}): ACTIVE (Weekend)`);
                } else { // Weekday
                    console.log(`Route ${route.shortName} (${route.id}): ACTIVE (Weekday)`);
                }
            } else {
                console.log(`Route ${route.shortName} (${route.id}): INACTIVE (Off hours)`);
            }
            
            this.visibilityStatus.set(route.id, isActive);
        }
        
        const activeCount = Array.from(this.visibilityStatus.values()).filter(v => v).length;
        console.log(`Visibility check complete: ${activeCount}/${this.routes.length} routes active`);
    }
    
    // Toggle route visibility in UI
    toggleVisibility(routeId, visible) {
        this.visibilityStatus.set(routeId, visible);
        this.renderRoutes();
    }
    
    // Get visibility status for a route
    isRouteVisible(routeId) {
        return this.visibilityStatus.get(routeId) !== false;
    }
    
    // Start background schedule checker
    startScheduleChecker() {
        setInterval(async () => {
            this.currentDate = new Date();
            await this.checkAllRoutesVisibility();
            this.renderActiveRoutes();
            this.updateCurrentTime();
            // Also refresh service alerts periodically
            this.loadServiceAlerts();
        }, this.updateInterval);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Search functionality for active routes
        document.getElementById('routeSearch').addEventListener('input', () => {
            this.renderActiveRoutes();
        });
    }
    
    // Load sample routes for testing
    loadSampleRoutes() {
        this.routes = [
            {
                id: 'route_1',
                name: 'Downtown Express',
                shortName: 'DX',
                color: '#ff6b6b',
                textColor: '#ffffff',
                schedule: this.generateDefaultSchedule('route_1'),
                coordinates: [
                    { lat: 40.7128, lng: -74.0060 },
                    { lat: 40.7580, lng: -73.9855 },
                    { lat: 40.7831, lng: -73.9712 }
                ]
            },
            {
                id: 'route_2',
                name: 'University Loop',
                shortName: 'UL',
                color: '#4ecdc4',
                textColor: '#ffffff',
                schedule: this.generateDefaultSchedule('route_2'),
                coordinates: [
                    { lat: 40.7489, lng: -73.9680 },
                    { lat: 40.7580, lng: -73.9855 },
                    { lat: 40.7614, lng: -73.9776 }
                ]
            },
            {
                id: 'route_3',
                name: 'Airport Shuttle',
                shortName: 'AS',
                color: '#45b7d1',
                textColor: '#ffffff',
                schedule: {
                    monday: { start: '05:00', end: '01:00' },
                    tuesday: { start: '05:00', end: '01:00' },
                    wednesday: { start: '05:00', end: '01:00' },
                    thursday: { start: '05:00', end: '01:00' },
                    friday: { start: '05:00', end: '01:00' },
                    saturday: { start: '06:00', end: '00:00' },
                    sunday: { start: '06:00', end: '00:00' }
                },
                coordinates: [
                    { lat: 40.6413, lng: -73.7781 },
                    { lat: 40.7580, lng: -73.9855 }
                ]
            }
        ];
        
        this.checkAllRoutesVisibility();
        this.renderRoutes();
    }
    
    // Show route on Google Maps with demo vehicles
    async showRouteOnMap(routeId) {
        if (!this.map || !window.google) return;
        
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        
        console.log(`Showing route ${routeId} on map with ${route.coordinates?.length || 0} coordinates`);
        
        // Clear existing markers and polylines
        this.markers.forEach(marker => marker.setMap(null));
        this.polylines?.forEach(polyline => polyline.setMap(null));
        this.markers = [];
        this.polylines = [];
        
        // Draw route path if coordinates exist
        if (route.coordinates && route.coordinates.length > 0) {
            const path = new google.maps.Polyline({
                path: route.coordinates,
                geodesic: true,
                strokeColor: route.color || '#0099FF',
                strokeOpacity: 0.8,
                strokeWeight: 6,
                map: this.map
            });
            
            this.polylines.push(path);
            
    
// Weekend vs weekday logic
if (isActive) {
if (currentDay === 0 || currentDay === 6) { // Weekend
console.log(`Route ${route.shortName} (${route.id}): ACTIVE (Weekend)`);
} else { // Weekday
console.log(`Route ${route.shortName} (${route.id}): ACTIVE (Weekday)`);
}
} else {
console.log(`Route ${route.shortName} (${route.id}): INACTIVE (Off hours)`);
}
    
this.visibilityStatus.set(route.id, isActive);
}
    
const activeCount = Array.from(this.visibilityStatus.values()).filter(v => v).length;
console.log(`Visibility check complete: ${activeCount}/${this.routes.length} routes active`);
}
    
// Toggle route visibility in UI
toggleVisibility(routeId, visible) {
this.visibilityStatus.set(routeId, visible);
this.renderRoutes();
}
    
// Get visibility status for a route
isRouteVisible(routeId) {
return this.visibilityStatus.get(routeId) !== false;
}
    
// Start background schedule checker
startScheduleChecker() {
setInterval(async () => {
this.currentDate = new Date();
await this.checkAllRoutesVisibility();
this.renderActiveRoutes();
this.updateCurrentTime();
// Also refresh service alerts periodically
this.loadServiceAlerts();
}, this.updateInterval);
}
    
// Setup event listeners
setupEventListeners() {
// Search functionality for active routes
document.getElementById('routeSearch').addEventListener('input', () => {
this.renderActiveRoutes();
});
}
    
// Load sample routes for testing
loadSampleRoutes() {
this.routes = [
{
id: 'route_1',
name: 'Downtown Express',
shortName: 'DX',
color: '#ff6b6b',
textColor: '#ffffff',
schedule: this.generateDefaultSchedule('route_1'),
coordinates: [
{ lat: 40.7128, lng: -74.0060 },
{ lat: 40.7580, lng: -73.9855 },
{ lat: 40.7831, lng: -73.9712 }
]
},
{
id: 'route_2',
name: 'University Loop',
shortName: 'UL',
color: '#4ecdc4',
textColor: '#ffffff',
schedule: this.generateDefaultSchedule('route_2'),
coordinates: [
{ lat: 40.7489, lng: -73.9680 },
{ lat: 40.7580, lng: -73.9855 },
{ lat: 40.7614, lng: -73.9776 }
]
},
{
id: 'route_3',
name: 'Airport Shuttle',
shortName: 'AS',
color: '#45b7d1',
textColor: '#ffffff',
schedule: {
monday: { start: '05:00', end: '01:00' },
tuesday: { start: '05:00', end: '01:00' },
wednesday: { start: '05:00', end: '01:00' },
thursday: { start: '05:00', end: '01:00' },
friday: { start: '05:00', end: '01:00' },
saturday: { start: '06:00', end: '00:00' },
sunday: { start: '06:00', end: '00:00' }
},
coordinates: [
{ lat: 40.6413, lng: -73.7781 },
{ lat: 40.7580, lng: -73.9855 }
]
}
];
    
this.checkAllRoutesVisibility();
this.renderRoutes();
}
    
// Show route on Google Maps with demo vehicles
async showRouteOnMap(routeId) {
if (!this.map || !window.google) return;
    
const route = this.routes.find(r => r.id === routeId);
if (!route) return;
    
console.log(`Showing route ${routeId} on map with ${route.coordinates?.length || 0} coordinates`);
    
// Clear existing markers and polylines
this.markers.forEach(marker => marker.setMap(null));
this.polylines?.forEach(polyline => polyline.setMap(null));
this.markers = [];
this.polylines = [];
    
// Draw route path if coordinates exist
if (route.coordinates && route.coordinates.length > 0) {
const path = new google.maps.Polyline({
path: route.coordinates,
geodesic: true,
strokeColor: route.color || '#0099FF',
strokeOpacity: 0.8,
strokeWeight: 6,
map: this.map
});
    
this.polylines.push(path);
    
// Center map on route
const bounds = new google.maps.LatLngBounds();
route.coordinates.forEach(coord => {
bounds.extend({ lat: coord.lat, lng: coord.lng });
});
this.map.fitBounds(bounds);
    
console.log(`Drew route path with ${route.coordinates.length} points`);
}
    
// Add demo vehicle markers (since live feed isn't working)
if (route.coordinates && route.coordinates.length > 0) {
// Add 1-2 demo vehicles along the route
const vehiclePositions = [
route.coordinates[Math.floor(route.coordinates.length * 0.3)],
route.coordinates[Math.floor(route.coordinates.length * 0.7)]
];
    
vehiclePositions.forEach((position, index) => {
const vehicleMarker = new google.maps.Marker({
position: position,
map: this.map,
title: `Demo Vehicle ${index + 1} - ${route.shortName}`,
icon: {
path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
fillColor: '#ff4444',
fillOpacity: 0.8,
strokeColor: '#ffffff',
strokeWeight: 2,
scale: 10,
rotation: 45
},
zIndex: 1000
});
    
// Add info window
const infoWindow = new google.maps.InfoWindow({
content: `
<div style="padding: 8px;">
<strong>Demo Vehicle ${index + 1}</strong><br>
Route: ${route.shortName}<br>
Status: On Time<br>
Speed: 25.0 km/h<br>
Next Stop: Harvard Square
</div>
`
});
    
vehicleMarker.addListener('click', () => {
infoWindow.open(this.map, vehicleMarker);
});
    
this.markers.push(vehicleMarker);
});
    
console.log(`Added ${vehiclePositions.length} demo vehicles`);
}
}
    
// Select a route
selectRoute(routeId) {
console.log('=== SELECTING ROUTE ===');
console.log('Route ID:', routeId);
    
this.selectedRoute = this.routes.find(route => route.id === routeId);
console.log('Selected route:', this.selectedRoute);
    
this.renderSelectedRoute();
// Map functionality disabled - just show route details
// this.showRouteOnMap(routeId);
}
    
// Get sample coordinates for demo routes
getSampleCoordinates(routeId) {
const bostonCoords = [
{ lat: 42.3601, lng: -71.0589 }, // Boston Common
{ lat: 42.3736, lng: -71.1097 }, // Harvard Square
{ lat: 42.3894, lng: -71.0994 }, // North Cambridge
{ lat: 42.3655, lng: -71.1048 }, // Porter Square
{ lat: 42.3601, lng: -71.0589 }  // Back to Boston Common
];
    
// Different routes with slightly different paths
const routePaths = {
'777': [ // 1636'er
{ lat: 42.3736, lng: -71.1097 },
{ lat: 42.3655, lng: -71.1048 },
{ lat: 42.3601, lng: -71.0589 },
{ lat: 42.3518, lng: -71.0643 }
],
'778': [ // Allston Loop
{ lat: 42.3736, lng: -71.1097 },
{ lat: 42.3518, lng: -71.1312 },
{ lat: 42.3490, lng: -71.1048 },
{ lat: 42.3601, lng: -71.0589 },
{ lat: 42.3736, lng: -71.1097 }
],
'789': [ // Mather Express
{ lat: 42.3736, lng: -71.1097 },
{ lat: 42.3894, lng: -71.0994 },
{ lat: 42.3954, lng: -71.1217 }
],
'790': [ // Quad Express
{ lat: 42.3736, lng: -71.1097 },
{ lat: 42.3601, lng: -71.0589 },
{ lat: 42.3264, lng: -71.0957 },
{ lat: 42.3311, lng: -71.1167 }
]
};
    
return routePaths[routeId] || bostonCoords;
}

// Render only active routes in the sidebar
renderActiveRoutes() {
console.log('=== RENDERING ACTIVE ROUTES ===');
const activeRouteList = document.getElementById('activeRouteList');
console.log('Active route list element:', activeRouteList);
    
if (!activeRouteList) {
console.error('activeRouteList element not found!');
return;
}
    
const searchTerm = document.getElementById('routeSearch')?.value || '';
console.log('Search term:', searchTerm);
    
// Get only active routes
const activeRoutes = this.routes.filter(route => this.isRouteVisible(route.id));
console.log('Active routes found:', activeRoutes.length);
console.log('All routes:', this.routes.length);
    
// Show all routes for debugging
const filteredRoutes = this.routes; // Show all routes temporarily
    
// Update stats
this.updateRouteStats(activeRoutes.length, this.routes.length);
    
if (filteredRoutes.length === 0) {
console.log('No routes to display');
activeRouteList.innerHTML = `
<div class="empty-state">
<h3>No routes found</h3>
<p>Debugging mode - should show routes</p>
</div>
`;
return;
}
    
console.log('Rendering routes:', filteredRoutes.length);
    
activeRouteList.innerHTML = filteredRoutes.map(route => {
const isActive = this.isRouteVisible(route.id);
const isSelected = this.selectedRoute && this.selectedRoute.id === route.id;
    
return `
<div class="active-route-item ${isSelected ? 'selected' : ''}" 
data-route-id="${route.id}"
style="cursor: pointer; background: ${isActive ? '#4CAF50' : '#f44336'}; color: white; padding: 15px; margin: 10px; border-radius: 8px;">
<div class="route-header">
<span class="route-name" style="font-weight: bold;">${route.shortName || route.name}</span>
<div class="route-status">
<span class="status-indicator"></span>
${isActive ? 'ACTIVE' : 'INACTIVE'}
</div>
</div>
<div class="route-details">
<h4>${route.name}</h4>
<p>Route ID: ${route.id} • Status: ${isActive ? 'Running' : 'Not Running'}</p>
</div>
</div>
`;
}).join('');
    
console.log('Routes rendered successfully');
    
// Add click handlers
document.querySelectorAll('.active-route-item').forEach(item => {
item.addEventListener('click', (e) => {
e.preventDefault();
e.stopPropagation();
const routeId = item.dataset.routeId;
console.log('CLICKED! Route ID:', routeId);
this.selectRoute(routeId);
});

// Get sample coordinates for demo routes
getSampleCoordinates(routeId) {
    const bostonCoords = [
        { lat: 42.3601, lng: -71.0589 }, // Boston Common
        { lat: 42.3736, lng: -71.1097 }, // Harvard Square
        { lat: 42.3894, lng: -71.0994 }, // North Cambridge
        { lat: 42.3655, lng: -71.1048 }, // Porter Square
        { lat: 42.3601, lng: -71.0589 }  // Back to Boston Common
    ];
    
    // Different routes with slightly different paths
    const routePaths = {
        '777': [ // 1636'er
            { lat: 42.3736, lng: -71.1097 },
            { lat: 42.3655, lng: -71.1048 },
            { lat: 42.3601, lng: -71.0589 },
            { lat: 42.3518, lng: -71.0643 }
        ],
        '778': [ // Allston Loop
            { lat: 42.3736, lng: -71.1097 },
            { lat: 42.3518, lng: -71.1312 },
            { lat: 42.3490, lng: -71.1048 },
            { lat: 42.3601, lng: -71.0589 },
            { lat: 42.3736, lng: -71.1097 }
        ],
        '789': [ // Mather Express
            { lat: 42.3736, lng: -71.1097 },
            { lat: 42.3894, lng: -71.0994 },
            { lat: 42.3954, lng: -71.1217 }
        ],
        '790': [ // Quad Express
            { lat: 42.3736, lng: -71.1097 },
            { lat: 42.3601, lng: -71.0589 },
            { lat: 42.3264, lng: -71.0957 },
            { lat: 42.3311, lng: -71.1167 }
        ]
    };
    
    return routePaths[routeId] || bostonCoords;
}
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutePicker;
}
