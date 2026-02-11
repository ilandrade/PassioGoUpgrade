class PassioGoAPI {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        // Harvard Passio GTFS-RT endpoints
        this.baseUrl = 'https://passio3.com/harvard/passioTransit/gtfs/realtime';
        this.staticBaseUrl = 'https://passio3.com/harvard/passioTransit/gtfs';
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds
        this.gtfsData = new Map(); // Cache for static GTFS data
    }
    
    // Load static GTFS data from remote Harvard Passio (working feeds)
    async loadStaticGTFSData() {
        try {
            // Load from Harvard Passio static GTFS feeds (we know these work)
            const files = [
                'agency.txt',
                'routes.txt', 
                'stops.txt',
                'trips.txt',
                'stop_times.txt',
                'calendar.txt',
                'calendar_dates.txt',
                'shapes.txt',
                'feed_info.txt'
            ];
            
            for (const file of files) {
                try {
                    const data = await this.loadGTFSFile(file);
                    if (data) {
                        const fileName = file.replace('.txt', '');
                        this.gtfsData.set(fileName, this.parseCSV(data));
                        console.log(`Remote GTFS ${fileName} loaded:`, this.gtfsData.get(fileName).length, 'records');
                    }
                } catch (error) {
                    console.warn(`Failed to load remote ${file}:`, error);
                }
            }
            
            console.log('GTFS data loading complete');
            return true;
        } catch (error) {
            console.error('Failed to load static GTFS data:', error);
            return false;
        }
    }
    
    // Load a GTFS file from local folder
    async loadLocalGTFSFile(filename) {
        try {
            const response = await fetch(`./gtfs/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Failed to load local ${filename}:`, error);
            return null;
        }
    }
    
    // Load a GTFS file from Harvard Passio
    async loadGTFSFile(filename) {
        try {
            const response = await fetch(`${this.staticBaseUrl}/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            return null;
        }
    }
    
    // Get service exceptions for a date range
    getServiceExceptions(startDate, endDate) {
        const calendarDates = this.gtfsData.get('calendar_dates') || [];
        const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
        const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '');
        
        return calendarDates.filter(ex => ex.date >= startStr && ex.date <= endStr);
    }
    
    // Load a GTFS file (could be from local storage or API)
    async loadGTFSFile(filename) {
        // For now, we'll simulate loading from the local gtfs folder
        // In production, this might be from your API or local storage
        try {
            const response = await fetch(`./gtfs/${filename}`);
            return await response.text();
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            return null;
        }
    }
    
    // Parse CSV data into array of objects
    parseCSV(csvText) {
        if (!csvText) {
            console.log('CSV text is empty');
            return [];
        }
        
        console.log('Parsing CSV, first 200 chars:', csvText.substring(0, 200));
        
        const lines = csvText.trim().split('\n');
        console.log('CSV lines count:', lines.length);
        
        if (lines.length < 2) {
            console.log('CSV has no data rows');
            return [];
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        console.log('CSV headers:', headers);
        
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines
            
            // Handle quoted fields that may contain commas
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim()); // Add last value
            
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            data.push(row);
        }
        
        console.log('Parsed CSV data length:', data.length);
        if (data.length > 0) {
            console.log('First row:', data[0]);
        }
        return data;
    }
    
    // Get agency information
    getAgencyInfo() {
        return this.gtfsData.get('agency') || [];
    }
    
    // Generic API request method
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Cache the response
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error(`PassioGo API error for ${endpoint}:`, error);
            throw error;
        }
    }
    
    // Get all routes
    async getRoutes() {
        try {
            const response = await this.makeRequest('/routes');
            return response.data || response;
        } catch (error) {
            console.error('Failed to fetch routes:', error);
            throw error;
        }
    }
    
    // Get specific route by ID
    async getRoute(routeId) {
        try {
            const response = await this.makeRequest(`/routes/${routeId}`);
            return response.data || response;
        } catch (error) {
            console.error(`Failed to fetch route ${routeId}:`, error);
            throw error;
        }
    }
    
    // Get vehicles for a specific route
    async getRouteVehicles(routeId) {
        try {
            const response = await this.makeRequest(`/routes/${routeId}/vehicles`);
            return response.data || response;
        } catch (error) {
            console.error(`Failed to fetch vehicles for route ${routeId}:`, error);
            throw error;
        }
    }
    
    // Get all active vehicles
    async getAllVehicles() {
        try {
            const response = await this.makeRequest('/vehicles');
            return response.data || response;
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            throw error;
        }
    }
    
    // Get stops for a specific route
    async getRouteStops(routeId) {
        try {
            const response = await this.makeRequest(`/routes/${routeId}/stops`);
            return response.data || response;
        } catch (error) {
            console.error(`Failed to fetch stops for route ${routeId}:`, error);
            throw error;
        }
    }
    
    // Get route schedule
    async getRouteSchedule(routeId) {
        try {
            const response = await this.makeRequest(`/routes/${routeId}/schedule`);
            return response.data || response;
        } catch (error) {
            console.error(`Failed to fetch schedule for route ${routeId}:`, error);
            throw error;
        }
    }
    
    // Get real-time arrivals for a stop
    async getStopArrivals(stopId) {
        try {
            const response = await this.makeRequest(`/stops/${stopId}/arrivals`);
            return response.data || response;
        } catch (error) {
            console.error(`Failed to fetch arrivals for stop ${stopId}:`, error);
            throw error;
        }
    }
    
    // Get agencies
    async getAgencies() {
        try {
            const response = await this.makeRequest('/agencies');
            return response.data || response;
        } catch (error) {
            console.error('Failed to fetch agencies:', error);
            throw error;
        }
    }
    
    // Transform PassioGo route data to our format
    transformRouteData(passioRoute) {
        return {
            id: passioRoute.route_id || passioRoute.id,
            name: passioRoute.route_long_name || passioRoute.name || 'Unknown Route',
            shortName: passioRoute.route_short_name || passioRoute.short_name || '',
            color: passioRoute.route_color || '#' + Math.floor(Math.random()*16777215).toString(16),
            textColor: passioRoute.route_text_color || '#ffffff',
            agencyId: passioRoute.agency_id,
            type: passioRoute.route_type || 3, // Default to bus
            url: passioRoute.route_url,
            sortOrder: passioRoute.route_sort_order || 0
        };
    }
    
    // Transform vehicle data
    transformVehicleData(passioVehicle) {
        return {
            id: passioVehicle.vehicle_id || passioVehicle.id,
            routeId: passioVehicle.route_id,
            tripId: passioVehicle.trip_id,
            latitude: parseFloat(passioVehicle.latitude),
            longitude: parseFloat(passioVehicle.longitude),
            bearing: passioVehicle.bearing ? parseFloat(passioVehicle.bearing) : null,
            speed: passioVehicle.speed ? parseFloat(passioVehicle.speed) : null,
            timestamp: passioVehicle.timestamp ? new Date(passioVehicle.timestamp) : new Date(),
            occupancyStatus: passioVehicle.occupancy_status,
            licensePlate: passioVehicle.license_plate
        };
    }
    
    // Transform stop data
    transformStopData(passioStop) {
        return {
            id: passioStop.stop_id || passioStop.id,
            name: passioStop.stop_name || passioStop.name || 'Unknown Stop',
            latitude: parseFloat(passioStop.stop_lat || passioStop.latitude),
            longitude: parseFloat(passioStop.stop_lon || passioStop.longitude),
            code: passioStop.stop_code,
            description: passioStop.stop_desc,
            zoneId: passioStop.zone_id,
            wheelchairBoarding: passioStop.wheelchair_boarding
        };
    }
    
    // Get routes with full details
    async getRoutesWithDetails() {
        try {
            const routes = await this.getRoutes();
            const transformedRoutes = routes.map(route => this.transformRouteData(route));
            
            // Add additional details for each route
            for (let route of transformedRoutes) {
                try {
                    // Get schedule for the route
                    const schedule = await this.getRouteSchedule(route.id);
                    route.schedule = this.transformScheduleData(schedule);
                    
                    // Get stops for the route
                    const stops = await this.getRouteStops(route.id);
                    route.stops = stops.map(stop => this.transformStopData(stop));
                    
                    // Get coordinates from stops
                    if (route.stops && route.stops.length > 0) {
                        route.coordinates = route.stops.map(stop => ({
                            lat: stop.latitude,
                            lng: stop.longitude
                        }));
                    }
                    
                } catch (error) {
                    console.warn(`Failed to get details for route ${route.id}:`, error);
                    // Set default values
                    route.schedule = this.generateDefaultSchedule(route.id);
                    route.stops = [];
                    route.coordinates = [];
                }
            }
            
            return transformedRoutes;
        } catch (error) {
            console.error('Failed to get routes with details:', error);
            throw error;
        }
    }
    
    // Transform schedule data
    transformScheduleData(passioSchedule) {
        const schedule = {};
        
        if (passioSchedule && Array.isArray(passioSchedule)) {
            passioSchedule.forEach(daySchedule => {
                const dayName = daySchedule.day_name.toLowerCase();
                schedule[dayName] = {
                    start: daySchedule.start_time || '06:00',
                    end: daySchedule.end_time || '23:00',
                    frequency: daySchedule.frequency || 30
                };
            });
        }
        
        // Default schedule if no data available
        if (Object.keys(schedule).length === 0) {
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
        
        return schedule;
    }
    
    // Generate default schedule
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
    
    // Clear cache
    clearCache() {
        this.cache.clear();
    }
    
    // Get service alerts from Harvard Passio GTFS-RT
    async getServiceAlerts(routeId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/serviceAlerts.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const gtfsData = await response.json();
            
            if (!gtfsData.entity) {
                return [];
            }
            
            let alerts = gtfsData.entity.map(entity => {
                if (!entity.alert) return null;
                
                const alert = entity.alert;
                return {
                    id: entity.id,
                    agencyId: alert.informed_entity?.[0]?.agency_id,
                    routeId: alert.informed_entity?.[0]?.route_id,
                    stopId: alert.informed_entity?.[0]?.stop_id,
                    header: alert.header_text?.translation?.[0]?.text || '',
                    description: alert.description_text?.translation?.[0]?.text || '',
                    activePeriod: alert.active_period?.map(period => ({
                        start: period.start ? new Date(period.start * 1000) : null,
                        end: period.end ? new Date(period.end * 1000) : null,
                        startDatetime: period.startDatetime,
                        endDatetime: period.endDatetime
                    })) || [],
                    cause: alert.cause,
                    effect: alert.effect,
                    severity: alert.severity_level || 'UNKNOWN'
                };
            }).filter(alert => alert !== null);
            
            // Filter by route ID if specified
            if (routeId) {
                alerts = alerts.filter(alert => alert.routeId === routeId);
            }
            
            // Filter by active period (only return currently active alerts)
            const now = new Date();
            alerts = alerts.filter(alert => {
                return alert.activePeriod.some(period => {
                    const start = period.start || new Date(period.startDatetime);
                    const end = period.end || new Date(period.endDatetime);
                    return now >= start && now <= end;
                });
            });
            
            return alerts;
        } catch (error) {
            console.error('Failed to get service alerts:', error);
            return [];
        }
    }
    
    // Get real-time vehicle positions from Harvard Passio GTFS-RT
    async getRealTimeVehicles(routeId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/vehiclePositions.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const gtfsData = await response.json();
            
            if (!gtfsData.entity) {
                return [];
            }
            
            let vehicles = gtfsData.entity.map(entity => {
                if (!entity.vehicle) return null;
                
                const vehicle = entity.vehicle;
                return {
                    id: vehicle.vehicle?.id || entity.id,
                    label: vehicle.vehicle?.label || '',
                    routeId: this.extractRouteIdFromTrip(vehicle.trip?.trip_id),
                    tripId: vehicle.trip?.trip_id,
                    latitude: vehicle.position?.latitude,
                    longitude: vehicle.position?.longitude,
                    bearing: vehicle.position?.bearing,
                    speed: vehicle.position?.speed,
                    timestamp: vehicle.timestamp ? new Date(vehicle.timestamp * 1000) : new Date(),
                    occupancyStatus: this.mapOccupancyStatus(vehicle.occupancy_status),
                    currentStopSequence: vehicle.current_stop_sequence,
                    stopId: vehicle.stop_id
                };
            }).filter(vehicle => vehicle !== null);
            
            // Filter by route ID if specified
            if (routeId) {
                vehicles = vehicles.filter(vehicle => vehicle.routeId === routeId);
            }
            
            return vehicles;
        } catch (error) {
            console.error('Failed to get real-time vehicles:', error);
            return [];
        }
    }
    
    // Get trip updates from Harvard Passio GTFS-RT
    async getTripUpdates(routeId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/tripUpdates.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const gtfsData = await response.json();
            
            if (!gtfsData.entity) {
                return [];
            }
            
            let updates = gtfsData.entity.map(entity => {
                if (!entity.trip_update) return null;
                
                const tripUpdate = entity.trip_update;
                return {
                    id: entity.id,
                    tripId: tripUpdate.trip?.trip_id,
                    routeId: tripUpdate.trip?.route_id,
                    startDate: tripUpdate.trip?.start_date,
                    startTime: tripUpdate.trip?.start_time,
                    scheduleRelationship: tripUpdate.trip?.schedule_relationship,
                    vehicleId: tripUpdate.vehicle?.id,
                    vehicleLabel: tripUpdate.vehicle?.label,
                    stopTimeUpdates: tripUpdate.stop_time_update?.map(stop => ({
                        stopId: stop.stop_id,
                        stopSequence: stop.stop_sequence,
                        arrivalDelay: stop.arrival?.delay,
                        arrivalTime: stop.arrival?.time ? new Date(stop.arrival.time * 1000) : null,
                        departureDelay: stop.departure?.delay,
                        departureTime: stop.departure?.time ? new Date(stop.departure.time * 1000) : null,
                        scheduleRelationship: stop.schedule_relationship
                    })) || []
                };
            }).filter(update => update !== null);
            
            // Filter by route ID if specified
            if (routeId) {
                updates = updates.filter(update => update.routeId === routeId);
            }
            
            return updates;
        } catch (error) {
            console.error('Failed to get trip updates:', error);
            return [];
        }
    }
    
    // Get routes from static GTFS data
    getRoutes() {
        const routes = this.gtfsData.get('routes') || [];
        const trips = this.gtfsData.get('trips') || [];
        const calendar = this.gtfsData.get('calendar') || [];
        const shapes = this.gtfsData.get('shapes') || [];
        
        return routes.map(route => {
            // Find trips for this route
            const routeTrips = trips.filter(trip => trip.route_id === route.route_id);
            
            // Get unique service IDs for this route
            const serviceIds = [...new Set(routeTrips.map(trip => trip.service_id))];
            
            // Get unique shape IDs for this route
            const shapeIds = [...new Set(routeTrips.map(trip => trip.shape_id).filter(id => id))];
            
            // Get shape coordinates for this route
            let coordinates = [];
            if (shapeIds.length > 0) {
                // Get shape points for the first shape (simplified - could handle multiple shapes)
                const shapeId = shapeIds[0];
                const shapePoints = shapes
                    .filter(shape => shape.shape_id === shapeId)
                    .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));
                
                coordinates = shapePoints.map(point => ({
                    lat: parseFloat(point.shape_pt_lat),
                    lng: parseFloat(point.shape_pt_lon)
                }));
            }
            
            // Check if any service is active today
            const today = new Date();
            const hasActiveService = serviceIds.some(serviceId => 
                this.isServiceActiveOnDate(serviceId, today)
            );
            
            return {
                id: route.route_id,
                name: route.route_long_name || route.route_short_name || 'Unknown Route',
                shortName: route.route_short_name || '',
                color: route.route_color || '#' + Math.floor(Math.random()*16777215).toString(16),
                textColor: route.route_text_color || '#ffffff',
                agencyId: route.agency_id,
                type: route.route_type || 3,
                url: route.route_url,
                sortOrder: route.route_sort_order || 0,
                serviceIds: serviceIds,
                shapeIds: shapeIds,
                hasActiveService: hasActiveService,
                tripCount: routeTrips.length,
                coordinates: coordinates
            };
        });
    }
    
    // Check if a service is active on a specific date
    isServiceActiveOnDate(serviceId, date) {
        const calendar = this.gtfsData.get('calendar') || [];
        const calendarDates = this.gtfsData.get('calendar_dates') || [];
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format
        
        // First check if service is in the base calendar
        const serviceCalendar = calendar.find(cal => cal.service_id === serviceId);
        if (!serviceCalendar) {
            console.log(`Service ${serviceId} not found in calendar`);
            return false; // Service not found in calendar
        }
        
        // Check if date is within service period
        const serviceStart = new Date(serviceCalendar.start_date.slice(0, 4) + '-' + 
                                   serviceCalendar.start_date.slice(4, 6) + '-' + 
                                   serviceCalendar.start_date.slice(6, 8));
        const serviceEnd = new Date(serviceCalendar.end_date.slice(0, 4) + '-' + 
                                 serviceCalendar.end_date.slice(4, 6) + '-' + 
                                 serviceCalendar.end_date.slice(6, 8));
        
        console.log(`Service ${serviceId}: ${serviceStart.toISOString()} to ${serviceEnd.toISOString()}, current: ${date.toISOString()}`);
        
        if (date < serviceStart || date > serviceEnd) {
            console.log(`Service ${serviceId} not in date range`);
            return false; // Date outside service period
        }
        
        // Check if service runs on this day of week
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const runsOnThisDay = serviceCalendar[dayMap[dayOfWeek]] === '1';
        
        console.log(`Service ${serviceId} runs on ${dayMap[dayOfWeek]}: ${runsOnThisDay}`);
        
        if (!runsOnThisDay) {
            return false; // Service doesn't run on this day
        }
        
        // Check for exceptions
        const exceptions = calendarDates.filter(ex => ex.service_id === serviceId && ex.date === dateStr);
        
        if (exceptions.length > 0) {
            // If there are exceptions, check the most recent one
            const latestException = exceptions[exceptions.length - 1];
            const result = latestException.exception_type === '1'; // 1 = service added, 2 = service removed
            console.log(`Service ${serviceId} has exception: ${result}`);
            return result;
        }
        
        console.log(`Service ${serviceId} is active`);
        return true; // Service runs on this date
    }
    
    // Extract route ID from trip ID (adjust based on your GTFS data structure)
    extractRouteIdFromTrip(tripId) {
        if (!tripId) return null;
        
        // Example: if trip_id contains route info like "661208" where "66" might be route
        // You may need to adjust this logic based on your actual GTFS data
        return tripId.substring(0, 2); // Adjust this logic as needed
    }
    
    // Map GTFS occupancy status to human-readable format
    mapOccupancyStatus(occupancyStatus) {
        const statusMap = {
            0: 'EMPTY',
            1: 'MANY_SEATS_AVAILABLE', 
            2: 'FEW_SEATS_AVAILABLE',
            3: 'STANDING_ROOM_ONLY',
            4: 'CRUSHED_STANDING_ROOM_ONLY',
            5: 'FULL',
            6: 'NOT_ACCEPTING_PASSENGERS'
        };
        
        return statusMap[occupancyStatus] || 'UNKNOWN';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PassioGoAPI;
}
