// Harvard Shuttle Tracker - Real-time Version
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
        
        this.realtimeData = null;
        this.init();
    }
    
    init() {
        this.updateDateTime();
        this.fetchRealtimeData();
        this.renderRoutes();
        this.setupEventListeners();
        
        // Update page title immediately
        this.updatePageTitle();
        
        // Update every 30 seconds for real-time data
        setInterval(() => {
            this.updateDateTime();
            this.fetchRealtimeData();
            this.renderRoutes();
            this.updatePageTitle();
        }, 30000);
    }
    
    async fetchRealtimeData() {
        try {
            // Harvard's JSON stream for real-time vehicle data
            const response = await fetch('https://passio3.com/api/realtime/harvard');
            if (response.ok) {
                const data = await response.json();
                this.realtimeData = data;
                console.log('Real-time data updated:', data);
            }
        } catch (error) {
            console.log('Unable to fetch real-time data, using fallback schedules');
            // Fallback to static schedules if real-time data fails
        }
    }
    
    getRouteStatus(route) {
        // If we have real-time data, use it
        if (this.realtimeData && this.realtimeData.vehiclePositions) {
            const vehicles = this.realtimeData.vehiclePositions.filter(vehicle => 
                vehicle.vehicle.routeId === route.id
            );
            
            if (vehicles.length > 0) {
                // Check if any vehicles are delayed
                const hasDelayedVehicle = vehicles.some(vehicle => 
                    vehicle.vehicle.timestamp && this.isVehicleDelayed(vehicle)
                );
                
                return hasDelayedVehicle ? 'late' : 'running';
            }
        }
        
        // Fallback to static schedule logic
        return this.getStaticRouteStatus(route);
    }
    
    isVehicleDelayed(vehicle) {
        // Simple delay detection based on timestamp
        const now = Date.now();
        const vehicleTime = vehicle.vehicle.timestamp * 1000; // Convert to milliseconds
        const timeDiff = Math.abs(now - vehicleTime);
        
        // If vehicle data is more than 5 minutes old, consider it delayed
        return timeDiff > 5 * 60 * 1000;
    }
    
    getStaticRouteStatus(route) {
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Based on Harvard shuttle schedules from transportation.harvard.edu
        switch (route.shortName) {
            case '1636': // 1636er - M-F 6AM-11PM, Sat-Sun 8AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays
                    return currentHour >= 6 && currentHour < 23 ? 'running' : 'not-running';
                } else { // Weekends
                    return currentHour >= 8 && currentHour < 23 ? 'running' : 'not-running';
                }
                
            case 'AL': // Allston Loop - M-F 7AM-11PM, Sat-Sun 8AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                } else { // Weekends
                    return currentHour >= 8 && currentHour < 23 ? 'running' : 'not-running';
                }
                
            case 'BC': // Barry's Corner - M-F 7AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays only
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                }
                return 'not-running';
                
            case 'CC': // Crimson Cruiser - M-F 7AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays only
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                }
                return 'not-running';
                
            case 'ME': // Mather Express - M-F 7AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays only
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                }
                return 'not-running';
                
            case 'QE': // Quad Express - M-F 7AM-11PM, Sat-Sun 10AM-7PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                } else { // Weekends
                    return currentHour >= 10 && currentHour < 19 ? 'running' : 'not-running';
                }
                
            case 'ON': // Overnight - Daily 11PM-3AM
                return currentHour >= 23 || currentHour < 3 ? 'running' : 'not-running';
                
            case 'QSD': // Quad Stadium Direct - Special events only
                return 'not-running'; // Not regular service
                
            case 'QSE': // Quad Stadium Express - Special events only
                return 'not-running'; // Not regular service
                
            case 'QYE': // Quad Yard Express - M-F 7AM-11PM
                if (currentDay >= 1 && currentDay <= 5) { // Weekdays only
                    return currentHour >= 7 && currentHour < 23 ? 'running' : 'not-running';
                }
                return 'not-running';
                
            default:
                return 'not-running';
        }
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
    
    renderRoutes() {
        // Only show routes that are running or late, hide not-running ones
        const filteredRoutes = this.routes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        const activeRoutes = filteredRoutes;
        
        document.getElementById('stats').textContent = `${activeRoutes.length} Active Routes`;
        
        // Update page title with active route count
        document.title = `Harvard Go! - ${activeRoutes.length} Active Routes`;
        
        if (filteredRoutes.length === 0) {
            document.getElementById('routes').innerHTML = `
                <div class="empty-state">
                    <h3>No Active Routes</h3>
                    <p>No shuttles are currently running. Check back during service hours.</p>
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
}

function selectRoute(routeId) {
    tracker.selectRoute(routeId);
}

// Initialize the app
const tracker = new ShuttleTracker();
