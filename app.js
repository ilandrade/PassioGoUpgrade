// Harvard Shuttle Tracker - Clean Version
class ShuttleTracker {
    constructor() {
        this.routes = [
            { 
                id: '777', 
                name: "1636er", 
                shortName: '1636',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3736, lng: -71.1097 }, // Harvard Yard
                    { lat: 42.3655, lng: -71.1048 }, // Porter Square
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '778', 
                name: 'Allston Loop', 
                shortName: 'AL',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3518, lng: -71.1312 }, // Allston
                    { lat: 42.3490, lng: -71.1048 }, // Brighton
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '779', 
                name: "Barrys Corner", 
                shortName: 'BC',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3640, lng: -71.1240 }, // Barry's Corner
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '783', 
                name: 'Crimson Cruiser', 
                shortName: 'CC',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3894, lng: -71.0994 }, // North Cambridge
                    { lat: 42.3954, lng: -71.1217 }, // Cambridge Commons
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '789', 
                name: 'Mather Express', 
                shortName: 'ME',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3894, lng: -71.0994 }, // North Cambridge
                    { lat: 42.3954, lng: -71.1217 }, // Mather House
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '790', 
                name: 'Quad Express', 
                shortName: 'QE',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3264, lng: -71.0957 }, // Quad
                    { lat: 42.3311, lng: -71.1167 }, // River Houses
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '785', 
                name: 'Overnight', 
                shortName: 'ON',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3736, lng: -71.1097 }, // Harvard Yard
                    { lat: 42.3655, lng: -71.1048 }, // Porter Square
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '791', 
                name: 'Quad Stadium Direct', 
                shortName: 'QSD',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3264, lng: -71.0957 }, // Quad
                    { lat: 42.3736, lng: -71.0300 }, // Stadium
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '792', 
                name: 'Quad Stadium Express', 
                shortName: 'QSE',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3264, lng: -71.0957 }, // Quad
                    { lat: 42.3736, lng: -71.0300 }, // Stadium
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            },
            { 
                id: '793', 
                name: 'Quad Yard Express', 
                shortName: 'QYE',
                coordinates: [
                    { lat: 42.3770, lng: -71.1167 }, // Harvard Square
                    { lat: 42.3736, lng: -71.1097 }, // Harvard Yard
                    { lat: 42.3264, lng: -71.0957 }, // Quad
                    { lat: 42.3770, lng: -71.1167 }  // Back to Harvard
                ]
            }
        ];
        
        this.map = null;
        this.routePolylines = [];
        this.selectedRouteId = null;
        
        this.init();
    }
    
    init() {
        this.updateDateTime();
        this.renderRoutes();
        this.setupEventListeners();
        
        // Update page title immediately
        this.updatePageTitle();
        
        // Initialize map when Google Maps is ready
        if (window.google && window.google.maps) {
            this.initializeMap();
        }
        
        // Update every minute
        setInterval(() => {
            this.updateDateTime();
            this.renderRoutes();
            this.updatePageTitle();
            this.drawAllRoutes(); // Redraw routes with updated status
        }, 60000);
    }
    
    updatePageTitle() {
        const activeRoutes = this.routes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        const newTitle = `Harvard Go! - ${activeRoutes.length} Active Routes`;
        document.title = newTitle;
        console.log('Title updated to:', newTitle); // Debug log
    }
    
    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        document.getElementById('datetime').textContent = now.toLocaleDateString('en-US', options);
    }
    
    getRouteStatus(route) {
        const currentHour = new Date().getHours();
        
        // Overnight routes run 10 PM - 4 AM
        if (route.shortName === 'ON') {
            if (currentHour >= 22 || currentHour <= 4) {
                // Simulate some routes being late during peak hours
                if (currentHour >= 7 && currentHour <= 9 || currentHour >= 16 && currentHour <= 18) {
                    return Math.random() > 0.7 ? 'late' : 'running';
                }
                return 'running';
            }
            return 'not-running';
        }
        
        // Regular routes run 6 AM - 11 PM
        if (currentHour >= 6 && currentHour <= 23) {
            // Simulate some routes being late during peak hours
            if (currentHour >= 7 && currentHour <= 9 || currentHour >= 16 && currentHour <= 18) {
                return Math.random() > 0.7 ? 'late' : 'running';
            }
            return 'running';
        }
        
        return 'not-running';
    }
    
    renderRoutes() {
        const filteredRoutes = this.routes;
        
        const activeRoutes = filteredRoutes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        document.getElementById('stats').textContent = `${activeRoutes.length} Active Routes`;
        
        // Update page title with active route count
        document.title = `Harvard GO - ${activeRoutes.length} Active Routes`;
        
        if (filteredRoutes.length === 0) {
            document.getElementById('routes').innerHTML = `
                <div class="empty-state">
                    <h3>No routes found</h3>
                    <p>Check back later for available routes</p>
                </div>
            `;
            return;
        }
        
        // Sort routes: running/late first, then not running
        const sortedRoutes = filteredRoutes.sort((a, b) => {
            const statusA = this.getRouteStatus(a);
            const statusB = this.getRouteStatus(b);
            
            // Both have same status, maintain original order
            if (statusA === statusB) return 0;
            
            // running and late come before not-running
            if ((statusA === 'running' || statusA === 'late') && statusB === 'not-running') return -1;
            if ((statusB === 'running' || statusB === 'late') && statusA === 'not-running') return 1;
            
            // late comes after running but before not-running
            if (statusA === 'running' && statusB === 'late') return -1;
            if (statusA === 'late' && statusB === 'running') return 1;
            
            return 0;
        });
        
        const routesHtml = sortedRoutes.map(route => {
            const status = this.getRouteStatus(route);
            let statusText, statusIcon;
            
            if (status === 'running') {
                statusText = 'Running';
                statusIcon = '🚌';
            } else if (status === 'late') {
                statusText = 'Delayed';
                statusIcon = '⚠️';
            } else {
                statusText = 'Not Running';
                statusIcon = '⏸️';
            }
            
            return `
                <div class="route status-${status}" onclick="selectRoute('${route.id}')">
                    <div class="route-name">${route.shortName}</div>
                    <div class="route-details">${route.name} • ${statusIcon} ${statusText}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById('routes').innerHTML = routesHtml;
    }
    
    setupEventListeners() {
        // No search functionality needed
    }
    
    initializeMap() {
        if (!window.google || !window.google.maps) {
            console.error('Google Maps not loaded');
            return;
        }
        
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 42.3770, lng: -71.1167 }, // Harvard Square
            zoom: 14,
            styles: [
                {
                    featureType: "transit",
                    elementType: "labels.icon",
                    stylers: [{ visibility: "on" }]
                }
            ]
        });
        
        // Draw all routes on map
        this.drawAllRoutes();
    }
    
    drawAllRoutes() {
        if (!this.map) return;
        
        // Clear existing routes
        this.clearRoutes();
        
        this.routes.forEach(route => {
            const status = this.getRouteStatus(route);
            const color = this.getRouteColor(status);
            
            const polyline = new google.maps.Polyline({
                path: route.coordinates,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: status === 'not-running' ? 0.3 : 0.8,
                strokeWeight: status === 'not-running' ? 2 : 4,
                map: this.map
            });
            
            this.routePolylines.push(polyline);
        });
    }
    
    clearRoutes() {
        this.routePolylines.forEach(polyline => {
            polyline.setMap(null);
        });
        this.routePolylines = [];
    }
    
    getRouteColor(status) {
        switch (status) {
            case 'running': return '#28a745';
            case 'late': return '#ffc107';
            case 'not-running': return '#6c757d';
            default: return '#6c757d';
        }
    }
    
    selectRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        
        // Update selected route styling
        document.querySelectorAll('.route').forEach(el => {
            el.classList.remove('selected');
        });
        
        const selectedElement = document.querySelector(`[onclick="selectRoute('${routeId}')"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // Highlight route on map
        this.highlightRoute(routeId);
        
        // Show alert
        const status = this.getRouteStatus(route);
        let statusEmoji, statusText;
        
        if (status === 'running') {
            statusEmoji = '🚌';
            statusText = 'Currently Running';
        } else if (status === 'late') {
            statusEmoji = '⚠️';
            statusText = 'Running Late';
        } else {
            statusEmoji = '⏸️';
            statusText = 'Not Running';
        }
        
        alert(`Harvard Go! - Selected Route\n\n${route.name} (${route.shortName})\nStatus: ${statusEmoji} ${statusText}`);
    }
    
    highlightRoute(routeId) {
        if (!this.map) return;
        
        this.clearRoutes();
        
        this.routes.forEach(route => {
            const status = this.getRouteStatus(route);
            const color = this.getRouteColor(status);
            const isHighlighted = route.id === routeId;
            
            const polyline = new google.maps.Polyline({
                path: route.coordinates,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: isHighlighted ? 1 : (status === 'not-running' ? 0.2 : 0.5),
                strokeWeight: isHighlighted ? 6 : (status === 'not-running' ? 2 : 3),
                map: this.map
            });
            
            this.routePolylines.push(polyline);
        });
    }
}

function selectRoute(routeId) {
    tracker.selectRoute(routeId);
}

// Google Maps initialization callback
function initMap() {
    if (window.tracker) {
        tracker.initializeMap();
    }
}

// Initialize the app
const tracker = new ShuttleTracker();
