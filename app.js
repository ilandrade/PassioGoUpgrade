// Harvard Shuttle Tracker - Clean Version
class ShuttleTracker {
    constructor() {
        this.routes = [
            { id: '777', name: "1636'er", shortName: '1636' },
            { id: '778', name: 'Allston Loop', shortName: 'AL' },
            { id: '779', name: "Barry's Corner", shortName: 'BC' },
            { id: '783', name: 'Crimson Cruiser', shortName: 'CC' },
            { id: '789', name: 'Mather Express', shortName: 'ME' },
            { id: '790', name: 'Quad Express', shortName: 'QE' },
            { id: '785', name: 'Overnight', shortName: 'ON' },
            { id: '791', name: 'Quad Stadium Direct', shortName: 'QSD' },
            { id: '792', name: 'Quad Stadium Express', shortName: 'QSE' },
            { id: '793', name: 'Quad Yard Express', shortName: 'QYE' }
        ];
        
        this.init();
    }
    
    init() {
        this.updateDateTime();
        this.renderRoutes();
        this.setupEventListeners();
        
        // Update every minute
        setInterval(() => {
            this.updateDateTime();
            this.renderRoutes();
        }, 60000);
    }
    
    updateDateTime() {
        const now = new Date();
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        };
        const timeOptions = { 
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const dateElement = document.getElementById('currentDate');
        const timeElement = document.getElementById('currentTime');
        
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
        }
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
        }
    }
    
    isRouteActive(route) {
        const currentHour = new Date().getHours();
        
        // Overnight routes run 10 PM - 4 AM
        if (route.shortName === 'ON') {
            return currentHour >= 22 || currentHour <= 4;
        }
        
        // Regular routes run 6 AM - 11 PM
        return currentHour >= 6 && currentHour <= 23;
    }
    
    renderRoutes() {
        const searchElement = document.getElementById('routeSearch');
        const routeListElement = document.getElementById('activeRouteList');
        const activeCountElement = document.getElementById('activeCount');
        const totalCountElement = document.getElementById('totalCount');
        
        if (!searchElement || !routeListElement || !activeCountElement || !totalCountElement) {
            console.error('Required DOM elements not found');
            return;
        }

        const searchTerm = searchElement.value.toLowerCase();
        const filteredRoutes = this.routes.filter(route => 
            route.name.toLowerCase().includes(searchTerm) ||
            route.shortName.toLowerCase().includes(searchTerm)
        );

        const activeRoutes = filteredRoutes.filter(route => this.isRouteActive(route));
        
        activeCountElement.textContent = activeRoutes.length;
        totalCountElement.textContent = filteredRoutes.length;
        
        if (filteredRoutes.length === 0) {
            routeListElement.innerHTML = `
                <div class="empty-state">
                    <h3>No routes found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
            return;
        }

        const routesHtml = filteredRoutes.map(route => {
            const isActive = this.isRouteActive(route);
            return `
                <div class="route-item ${!isActive ? 'inactive' : ''}" onclick="selectRoute('${route.id}')">
                    <div class="route-name">${route.shortName}</div>
                    <div class="route-details">${route.name}</div>
                    <div class="route-status">${isActive ? 'Running' : 'Not Running'}</div>
                </div>
            `;
        }).join('');
        
        routeListElement.innerHTML = routesHtml;
    }
    
    setupEventListeners() {
        const searchElement = document.getElementById('routeSearch');
        if (searchElement) {
            searchElement.addEventListener('input', () => {
                this.renderRoutes();
            });
        }
    }
}

function selectRoute(routeId) {
    const route = tracker.routes.find(r => r.id === routeId);
    if (route) {
        alert(`Selected: ${route.name} (${route.shortName})\nStatus: ${tracker.isRouteActive(route) ? 'Currently Running' : 'Not Running'}`);
    } else {
        console.error('Route not found:', routeId);
    }
}

// Initialize the app
const tracker = new ShuttleTracker();
