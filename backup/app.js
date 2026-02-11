// Global variables
let routePicker;
let map;
let passioAPI;

// Initialize Google Maps
function initMap() {
    console.log('Initializing Google Maps...');
    
    // Check if the map element exists
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }
    
    // Default to Boston coordinates (based on your sample data)
    const defaultLocation = { lat: 42.3601, lng: -71.0589 };
    
    try {
        map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: defaultLocation,
            styles: [
                {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [{ color: "#f2e5d4" }]
                },
                {
                    featureType: "transit.line",
                    elementType: "geometry",
                    stylers: [{ color: "#dfd2ae" }]
                },
                {
                    featureType: "transit.station",
                    elementType: "labels.icon",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });
        
        console.log('Google Maps initialized successfully');
        
        // Initialize PassioGo API
        initializePassioAPI();
    } catch (error) {
        console.error('Error initializing Google Maps:', error);
        showMapError(error.message);
    }
}

// Initialize PassioGo API
function initializePassioAPI() {
    try {
        // Initialize PassioGo API (no API key needed for public feeds)
        passioAPI = new PassioGoAPI();
        
        // Initialize RoutePicker with PassioGo API
        if (typeof RoutePicker !== 'undefined') {
            routePicker = new RoutePicker(passioAPI);
            routePicker.map = map;
        }
    } catch (error) {
        console.error('Failed to initialize PassioGo API:', error);
        // Fallback to RoutePicker without API
        if (typeof RoutePicker !== 'undefined') {
            routePicker = new RoutePicker();
            routePicker.map = map;
        }
    }
}

// Fallback initialization if Google Maps fails
function initializeApp() {
    // Initialize PassioGo API first
    initializePassioAPI();
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // If Google Maps is already loaded, initialize immediately
    if (window.google && window.google.maps) {
        initMap();
    } else {
        // Set a timeout to initialize without maps if it takes too long
        setTimeout(initializeApp, 5000);
    }
});

// Handle Google Maps loading error
window.gm_authFailure = function() {
    console.error('Google Maps authentication failed. Please check your API key.');
    showMapError('Google Maps authentication failed. Please check your API key.');
    initializeApp();
};

// Show map error
function showMapError(message) {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = `
            <div class="map-error">
                <h3>Map Loading Error</h3>
                <p>${message}</p>
                <p>The route picker will still function without the map view.</p>
                <p>Please check:</p>
                <ul>
                    <li>Your Google Maps API key is valid</li>
                    <li>Maps JavaScript API is enabled in Google Cloud Console</li>
                    <li>Your API key has proper referrer restrictions</li>
                </ul>
            </div>
        `;
    }
    initializeApp();
};
