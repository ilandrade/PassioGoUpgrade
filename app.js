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
        
        const schedule = this.getDayScheduleBlocks(dayIndex);
        this.renderHorizontalSchedule(schedule);
    }
    
    getDayScheduleBlocks(dayIndex) {
        const isWeekend = dayIndex === 0 || dayIndex === 6;
        
        if (isWeekend) {
            return [
                { route: '1636', start: 8, end: 23, type: 'regular' },
                { route: 'AL', start: 8, end: 23, type: 'regular' },
                { route: 'QE', start: 10, end: 19, type: 'weekend-only' },
                { route: 'ON', start: 23, end: 27, type: 'overnight' } // 23:00 to 3:00 (27:00)
            ];
        } else {
            return [
                { route: '1636', start: 6, end: 23, type: 'regular' },
                { route: 'AL', start: 7, end: 23, type: 'regular' },
                { route: 'BC', start: 7, end: 23, type: 'regular' },
                { route: 'CC', start: 7, end: 23, type: 'regular' },
                { route: 'ME', start: 7, end: 23, type: 'regular' },
                { route: 'QE', start: 7, end: 23, type: 'regular' },
                { route: 'QYE', start: 7, end: 23, type: 'regular' },
                { route: 'ON', start: 23, end: 27, type: 'overnight' } // 23:00 to 3:00 (27:00)
            ];
        }
    }
    
    renderHorizontalSchedule(schedule) {
        // Create time slots from 6AM to 3AM (next day)
        const timeSlots = [];
        for (let hour = 6; hour <= 27; hour++) {
            if (hour <= 24) {
                timeSlots.push(hour === 24 ? '12AM' : (hour < 12 ? hour + 'AM' : (hour === 12 ? '12PM' : (hour - 12) + 'PM')));
            } else {
                timeSlots.push((hour - 24) + 'AM');
            }
        }
        
        // Create time header
        const timeHeaderHtml = timeSlots.map(time => 
            `<div class="time-slot">${time}</div>`
        ).join('');
        
        // Calculate total width and route block positions
        const totalSlots = timeSlots.length;
        const slotWidth = 100 / totalSlots;
        
        // Create route blocks
        const routeBlocksHtml = schedule.map((route, index) => {
            const left = ((route.start - 6) / totalSlots) * 100;
            const width = ((route.end - route.start) / totalSlots) * 100;
            const top = 20 + (index * 35); // Stack routes vertically
            
            return `
                <div class="route-block ${route.type}" 
                     style="left: ${left}%; width: ${width}%; top: ${top}px;"
                     onclick="selectRouteByShortName('${route.route}')"
                     title="${route.route}: ${this.formatTime(route.start)} - ${this.formatTime(route.end)}">
                    ${route.route}
                </div>
            `;
        }).join('');
        
        const scheduleHtml = `
            <div class="schedule-container">
                <div class="time-header">${timeHeaderHtml}</div>
                <div class="schedule-body">${routeBlocksHtml}</div>
            </div>
        `;
        
        document.getElementById('schedule-details').innerHTML = scheduleHtml;
    }
    
    formatTime(hour) {
        if (hour === 24) return '12AM';
        if (hour < 12) return hour + 'AM';
        if (hour === 12) return '12PM';
        if (hour > 24) return (hour - 24) + 'AM';
        return (hour - 12) + 'PM';
    }
}

// Global functions
function selectRoute(routeId) {
    tracker.selectRoute(routeId);
}

function selectRouteByShortName(shortName) {
    const route = tracker.routes.find(r => r.shortName === shortName);
    if (route) {
        tracker.selectRoute(route.id);
    }
}

function showDaySchedule(dayIndex) {
    tracker.showDaySchedule(dayIndex);
}

// Initialize app
const tracker = new ShuttleTracker();
