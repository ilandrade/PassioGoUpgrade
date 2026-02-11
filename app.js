// Harvard Shuttle Tracker - Clean Version
class ShuttleTracker {
    constructor() {
        this.routes = [
            { id: '777', name: "1636er", shortName: '1636' },
            { id: '778', name: 'Allston Loop', shortName: 'AL' },
            { id: '779', name: "Barrys Corner", shortName: 'BC' },
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
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const filteredRoutes = this.routes.filter(route => 
            route.name.toLowerCase().includes(searchTerm) ||
            route.shortName.toLowerCase().includes(searchTerm)
        );
        
        const activeRoutes = filteredRoutes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
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
        document.getElementById('search').addEventListener('input', () => {
            this.renderRoutes();
        });
    }
}

function selectRoute(routeId) {
    const route = tracker.routes.find(r => r.id === routeId);
    const status = tracker.getRouteStatus(route);
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
    
    alert(`Harvard GO - Selected Route\n\n${route.name} (${route.shortName})\nStatus: ${statusEmoji} ${statusText}`);
}

// Initialize the app
const tracker = new ShuttleTracker();
