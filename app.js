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
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const filteredRoutes = this.routes.filter(route => 
            route.name.toLowerCase().includes(searchTerm) ||
            route.shortName.toLowerCase().includes(searchTerm)
        );
        
        const activeRoutes = filteredRoutes.filter(route => this.isRouteActive(route));
        document.getElementById('stats').textContent = `${activeRoutes.length} Active Routes`;
        
        if (filteredRoutes.length === 0) {
            document.getElementById('routes').innerHTML = `
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
                <div class="route ${!isActive ? 'inactive' : ''}" onclick="selectRoute('${route.id}')">
                    <div class="route-name">${route.shortName}</div>
                    <div class="route-details">${route.name} • ${isActive ? 'Running' : 'Not Running'}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById('routes').innerHTML = routesHtml;
    }
    
    setupEventListeners() {
        document.getElementById('search').addEventListener('input', () => {
            this.renderRoutes();
        });
    }
}

function selectRoute(routeId) {
    const route = tracker.routes.find(r => r.id === routeId);
    alert(`Selected: ${route.name} (${route.shortName})\nStatus: ${tracker.isRouteActive(route) ? 'Currently Running' : 'Not Running'}`);
}

// Initialize the app
const tracker = new ShuttleTracker();
