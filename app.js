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
        this.initCalendar();
        
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
        // Show all routes with their current status
        const sortedRoutes = this.routes.sort((a, b) => {
            const statusA = this.getRouteStatus(a);
            const statusB = this.getRouteStatus(b);
            
            // Running routes first
            if (statusA === 'running' && statusB !== 'running') return -1;
            if (statusB === 'running' && statusA !== 'running') return 1;
            
            // Then alphabetical
            return a.name.localeCompare(b.name);
        });
        
        const activeRoutes = sortedRoutes.filter(route => {
            const status = this.getRouteStatus(route);
            return status === 'running' || status === 'late';
        });
        
        document.getElementById('stats').textContent = `${activeRoutes.length} Active Routes`;
        this.updatePageTitle();
        
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
        
        document.getElementById('routes').innerHTML = routesHtml;
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
    
    initCalendar() {
        const today = new Date();
        const currentDay = today.getDay();
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        let calendarHtml = '';
        
        // Get Sunday of current week (start of week)
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDay);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + i);
            
            const dayName = weekDays[i];
            const dayDate = (date.getMonth() + 1) + '/' + date.getDate();
            const isActive = i === currentDay;
            const dayType = this.getDayType(i);
            
            calendarHtml += `
                <button class="day-btn ${isActive ? 'active' : ''}" onclick="showDaySchedule(${i})">
                    <span class="day-name">${dayName}</span>
                    <span class="day-date">${dayDate}</span>
                    <span class="day-schedule">${dayType}</span>
                </button>
            `;
        }
        
        document.getElementById('week-days').innerHTML = calendarHtml;
        
        // Show today's schedule by default
        this.showDaySchedule(currentDay);
    }
    
    getDayType(dayIndex) {
        if (dayIndex === 0 || dayIndex === 6) {
            return 'Weekend';
        } else {
            return 'Weekday';
        }
    }
    
    showDaySchedule(dayIndex) {
        // Update active button
        document.querySelectorAll('.day-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index === dayIndex);
        });
        
        const schedule = this.getDaySchedule(dayIndex);
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
        
        document.getElementById('schedule-details').innerHTML = scheduleHtml;
    }
    
    getDaySchedule(dayIndex) {
        // Sunday = 0, Saturday = 6
        const isWeekend = dayIndex === 0 || dayIndex === 6;
        
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

function showDaySchedule(dayIndex) {
    tracker.showDaySchedule(dayIndex);
}

// Initialize app
const tracker = new ShuttleTracker();
