// Harvard Go! Shuttle Tracker
class ShuttleTracker {
    constructor() {
        this.routes = [
            { id: '777', name: "1636er", shortName: '1636' },
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
        
        this.realtimeData = null;
        this.init();
    }
    
    init() {
        this.updateDateTime();
        this.fetchRealtimeData();
        this.renderRoutes();
        this.initScheduleViews();
        
        // Update every 30 seconds
        setInterval(() => {
            this.updateDateTime();
            this.fetchRealtimeData();
            this.renderRoutes();
            this.updatePageTitle();
        }, 30000);
        
        this.updatePageTitle();
    }
    
    async fetchRealtimeData() {
        try {
            const response = await fetch('https://passio3.com/api/realtime/harvard');
            if (response.ok) {
                const data = await response.json();
                this.realtimeData = data;
                console.log('Real-time data updated');
            }
        } catch (error) {
            console.log('Using fallback schedules');
        }
    }
    
    getRouteStatus(route) {
        // Try real-time data first
        if (this.realtimeData && this.realtimeData.vehiclePositions) {
            const vehicles = this.realtimeData.vehiclePositions.filter(vehicle => 
                vehicle.vehicle.routeId === route.id
            );
            
            if (vehicles.length > 0) {
                return 'running';
            }
        }
        
        // Fallback to static schedules
        return this.getStaticRouteStatus(route);
    }
    
    getStaticRouteStatus(route) {
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();
        
        const schedules = {
            '1636': { weekdays: [6, 23], weekends: [8, 23] },
            'AL': { weekdays: [7, 23], weekends: [8, 23] },
            'BC': { weekdays: [7, 23] },
            'CC': { weekdays: [7, 23] },
            'ME': { weekdays: [7, 23] },
            'QE': { weekdays: [7, 23], weekends: [10, 19] },
            'ON': { daily: [23, 3] },
            'QSD': {},
            'QSE': {},
            'QYE': { weekdays: [7, 23] }
        };
        
        const schedule = schedules[route.shortName];
        if (!schedule || Object.keys(schedule).length === 0) {
            return 'not-running';
        }
        
        if (schedule.daily) {
            const [start, end] = schedule.daily;
            return (currentHour >= start || currentHour < end) ? 'running' : 'not-running';
        }
        
        if (currentDay >= 1 && currentDay <= 5) {
            const [start, end] = schedule.weekdays;
            return currentHour >= start && currentHour < end ? 'running' : 'not-running';
        } else {
            const [start, end] = schedule.weekends;
            return currentHour >= start && currentHour < end ? 'running' : 'not-running';
        }
    }
    
    updatePageTitle() {
        const activeRoutes = this.routes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        document.title = `Harvard Go! - ${activeRoutes.length} Active Routes`;
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
        // Separate routes into active and inactive
        const activeRoutes = this.routes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        const inactiveRoutes = this.routes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'not-running';
        });
        
        document.getElementById('stats').textContent = `${activeRoutes.length} Active Routes`;
        this.updatePageTitle();
        
        // Render active routes
        this.renderActiveRoutes(activeRoutes);
        
        // Render inactive routes in dropdown
        this.renderInactiveRoutes(inactiveRoutes);
    }
    
    renderActiveRoutes(routes) {
        const container = document.getElementById('active-routes');
        
        if (routes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Active Routes</h3>
                    <p>No shuttles are currently running. Check back during service hours.</p>
                </div>
            `;
            return;
        }
        
        // Sort active routes alphabetically
        const sortedRoutes = routes.sort((a, b) => a.name.localeCompare(b.name));
        
        const routesHtml = sortedRoutes.map(route => {
            const status = this.getRouteStatus(route);
            const statusInfo = this.getStatusInfo(status);
            
            return `
                <div class="route status-${status}" onclick="selectRoute('${route.id}')">
                    <div class="route-name">${route.shortName}</div>
                    <div class="route-details">${route.name} • ${statusInfo.icon} ${statusInfo.text}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = routesHtml;
    }
    
    renderInactiveRoutes(routes) {
        const container = document.getElementById('inactive-routes');
        const dropdown = document.getElementById('inactive-dropdown');
        
        if (routes.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        dropdown.style.display = 'block';
        
        // Sort inactive routes alphabetically
        const sortedRoutes = routes.sort((a, b) => a.name.localeCompare(b.name));
        
        const routesHtml = sortedRoutes.map(route => `
            <div class="route status-not-running" onclick="selectRoute('${route.id}')">
                <div class="route-name">${route.shortName}</div>
                <div class="route-details">${route.name} • ⏸️ Not Running</div>
            </div>
        `).join('');
        
        container.innerHTML = routesHtml;
    }
    
    getStatusInfo(status) {
        const statusMap = {
            'running': { icon: '🚌', text: 'Running' },
            'late': { icon: '⚠️', text: 'Delayed' },
            'not-running': { icon: '⏸️', text: 'Not Running' }
        };
        return statusMap[status] || statusMap['not-running'];
    }
    
    selectRoute(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        
        // Update selected styling
        document.querySelectorAll('.route').forEach(el => {
            el.classList.remove('selected');
        });
        
        const selectedElement = document.querySelector(`[onclick="selectRoute('${routeId}')"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // Show route info
        const status = this.getRouteStatus(route);
        const statusInfo = this.getStatusInfo(status);
        
        alert(`Harvard Go! - Selected Route\n\n${route.name} (${route.shortName})\nStatus: ${statusInfo.icon} ${statusInfo.text}`);
    }
    
    initScheduleViews() {
        // Load weekday and weekend schedules
        this.renderScheduleView('weekday', false);
        this.renderScheduleView('weekend', true);
    }
    
    renderScheduleView(viewId, isWeekend) {
        const schedule = this.getDaySchedule(isWeekend);
        const scheduleHtml = schedule.map(block => {
            const routeChips = block.routes.map(route => 
                `<span class="route-chip">${route}</span>`
            ).join('');
            
            return `
                <div class="schedule-time-block">
                    <div class="time-label">${block.time}</div>
                    <div class="route-chips">${routeChips}</div>
                </div>
            `;
        }).join('');
        
        document.getElementById(`${viewId}-schedule`).innerHTML = scheduleHtml;
    }
    
    getDaySchedule(isWeekend) {
        if (isWeekend) {
            return [
                { time: '8:00 AM', routes: ['1636', 'AL'] },
                { time: '9:00 AM', routes: ['1636', 'AL'] },
                { time: '10:00 AM', routes: ['1636', 'AL', 'QE'] },
                { time: '11:00 AM', routes: ['1636', 'AL', 'QE'] },
                { time: '12:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '1:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '2:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '3:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '4:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '5:00 PM', routes: ['1636', 'AL', 'QE'] },
                { time: '6:00 PM', routes: ['1636', 'AL'] },
                { time: '7:00 PM', routes: ['1636', 'AL'] },
                { time: '8:00 PM', routes: ['1636', 'AL'] },
                { time: '9:00 PM', routes: ['1636', 'AL'] },
                { time: '10:00 PM', routes: ['1636', 'AL'] },
                { time: '11:00 PM', routes: ['ON'] },
                { time: '12:00 AM', routes: ['ON'] },
                { time: '1:00 AM', routes: ['ON'] },
                { time: '2:00 AM', routes: ['ON'] }
            ];
        } else {
            return [
                { time: '6:00 AM', routes: ['1636'] },
                { time: '7:00 AM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '8:00 AM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '9:00 AM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '10:00 AM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '11:00 AM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '12:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '1:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '2:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '3:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '4:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '5:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '6:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '7:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '8:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '9:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '10:00 PM', routes: ['1636', 'AL', 'BC', 'CC', 'ME', 'QE', 'QYE'] },
                { time: '11:00 PM', routes: ['ON'] },
                { time: '12:00 AM', routes: ['ON'] },
                { time: '1:00 AM', routes: ['ON'] },
                { time: '2:00 AM', routes: ['ON'] }
            ];
        }
    }
}

// Global functions
function selectRoute(routeId) {
    tracker.selectRoute(routeId);
}

function showView(view) {
    // Hide all views
    document.querySelectorAll('.routes').forEach(routeView => {
        routeView.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected view and activate button
    document.getElementById(`${view}-view`).classList.add('active');
    
    // Activate the clicked button
    if (view === 'routes') {
        document.querySelectorAll('.nav-btn')[0].classList.add('active');
    } else if (view === 'weekday') {
        document.querySelectorAll('.nav-btn')[1].classList.add('active');
    } else if (view === 'weekend') {
        document.querySelectorAll('.nav-btn')[2].classList.add('active');
    }
}

function toggleDropdown() {
    document.getElementById('inactive-dropdown').classList.toggle('open');
}

// Initialize app
const tracker = new ShuttleTracker();
