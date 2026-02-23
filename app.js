// =============================================================================
// Harvard Go! — Shuttle Tracker
// Fetches live PassioGo bus data and displays routes, stops, and schedules
// for Harvard University's shuttle system.
// MAPBOX_TOKEN is loaded from config.js (not committed to git)
// =============================================================================

// --- Main Class --------------------------------------------------------------

class ShuttleTracker {
    constructor() {
        this.map = null;
        this.shuttleMarkers = [];
        this.stopMarkers = [];
        this.hiddenRouteIds = new Set(); // set of API routeIds currently hidden on map
        this.apiRouteIds = {};            // shortName → API routeId, populated after drawRouteLines
        this.routeTimetables = null;      // populated in drawStopMarkers
        this.routes = [
            { id: '777',   name: "1636'er",           shortName: '1636', color: '#0099FF', schedule: 'Weekends' },
            { id: '778',   name: 'Allston Loop',        shortName: 'AL',   color: '#a50606', schedule: '7:00am – 12:08am, Daily' },
            { id: '783',   name: 'Crimson Cruiser',     shortName: 'CC',   color: '#db0dd7', schedule: '4:30pm – 8:48pm, Daily' },
            { id: '789',   name: 'Mather Express',      shortName: 'ME',   color: '#0000FF', schedule: '7:40am – 3:10pm, M–F' },
            { id: '785',   name: 'Overnight',           shortName: 'ON',   color: '#ff8707', schedule: '8:55pm – 12:13am, M–F' },
            { id: '790',   name: 'Quad Express',        shortName: 'QE',   color: '#136d1c', schedule: '7:50am – 4:00pm, M–F' },
            { id: '791',   name: 'Quad Stadium',        shortName: 'QSD',  color: '#50BC48', schedule: '5:20am – 7:30am, M–F' },
            { id: '792',   name: 'Quad SEC Direct',     shortName: 'QSEC', color: '#9467bd', schedule: '7:00am – 7:40pm, M–F' },
            { id: '793',   name: 'Quad Yard Express',   shortName: 'QYE',  color: '#006600', schedule: '4:20pm – 12:20am, M–F' },
            { id: 'SE',    name: 'SEC Express',         shortName: 'SE',   color: '#fdae6b', schedule: '7:30am – 3:54pm, M–F' },
        ];
        
        this.realtimeData = null;
        this.init();
    }
    
    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    async init() {
        this.updateDateTime();
        await this.fetchRealtimeData();
        this.renderRoutes();
        this.initMap();

        // Refresh all live data every 30 seconds
        setInterval(async () => {
            this.updateDateTime();
            await this.fetchRealtimeData();
            this.renderRoutes();
            this.updateMapMarkers();
            if (this.map) this.drawStopMarkers();
            this.updatePageTitle();
        }, 30000);

        this.updatePageTitle();
    }
    
    // -------------------------------------------------------------------------
    // Map Initialization & Route Lines
    // -------------------------------------------------------------------------

    initMap() {
        if (!mapboxgl || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
            document.getElementById('map').innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#6c757d;flex-direction:column;gap:8px;">
                    <div style="font-size:32px">🗺️</div>
                    <div style="font-weight:bold">Add your Mapbox token to app.js</div>
                    <div style="font-size:11px">Get a free token at mapbox.com</div>
                </div>`;
            return;
        }

        mapboxgl.accessToken = MAPBOX_TOKEN;
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-71.1167, 42.3770], // Harvard campus
            zoom: 14
        });

        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        this.map.on('load', async () => {
            await this.drawRouteLines();
            this.updateMapMarkers();
            this.drawStopMarkers();
        });
    }

    async drawRouteLines() {
        if (!this.map) return;
        try {
            // sA=2 returns routePoints: dense GPS coords that follow roads exactly
            const res = await fetch(
                'https://passiogo.com/mapGetData.php?getStops=2',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ s0: '831', sA: 2 })
                }
            );
            const data = await res.json();
            const routes = data.routes || {};
            const routePoints = data.routePoints || {};

            // Build route color map from routes data
            const routeColors = {};
            for (const [routeId, routeData] of Object.entries(routes)) {
                routeColors[routeId] = routeData[1] || '#A51C30';
            }

            // Draw each route using its dense GPS path
            for (const [routeId, segments] of Object.entries(routePoints)) {
                const apiRouteName = routes[routeId] ? routes[routeId][0] : '';
                const shortName = API_NAME_MAP[apiRouteName];
                const routeDef = shortName ? this.routes.find(r => r.shortName === shortName) : null;

                const color = routeDef ? routeDef.color : (routeColors[routeId] || '#A51C30');
                const routeName = routeDef ? routeDef.name : apiRouteName;

                // Store the API routeId persistently so toggle buttons can find the layer
                if (routeDef) {
                    routeDef.apiRouteId = routeId;
                    this.apiRouteIds[routeDef.shortName] = routeId;
                }

                const coords = [];
                for (const segment of segments) {
                    for (const pt of segment) {
                        const lng = parseFloat(pt.lng);
                        const lat = parseFloat(pt.lat);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            coords.push([lng, lat]);
                        }
                    }
                }

                if (coords.length < 2) continue;
                const isActive = routeDef ? this.getStaticRouteStatus(routeDef) === 'running' : false;
                this.addRouteLine(routeId, routeName, color, coords, isActive);
            }

            this.hiddenRouteIds.clear();
            this.renderScheduleView();
        } catch (e) {
            console.log('drawRouteLines failed:', e.message);
        }
    }

    addRouteLine(routeId, routeName, color, coords, isActive = true) {
        const sourceId = `route-${routeId}`;
        const layerId = `route-line-${routeId}`;

        if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
        if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);

        this.map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: { routeName, color },
                geometry: { type: 'LineString', coordinates: coords }
            }
        });

        this.map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': isActive ? 'visible' : 'none'
            },
            paint: {
                'line-color': color,
                'line-width': 4,
                'line-opacity': 0.85
            }
        });
    }

    // -------------------------------------------------------------------------
    // Stop Markers & Timetable Data
    // -------------------------------------------------------------------------

    drawStopMarkers() {
        if (!this.map) return;

        this.stopMarkers.forEach(m => m.remove());
        this.stopMarkers = [];

        // Day/time context
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // allStopsToday: day-filtered only — used to decide which stop dots to draw
        // activeStopSchedules: day+hour filtered — used for popup upcoming times
        const allStopsToday = {};
        const activeStopSchedules = {};
        const addTimes = (tbl, routeName, color, days = 'daily', activeHours = null) => {
            // Check day
            if (days === 'weekday' && !isWeekday) return;
            if (days === 'weekend' && !isWeekend) return;
            // Register stop as having service today (no hour check)
            for (const [stop, times] of Object.entries(tbl)) {
                if (!allStopsToday[stop]) allStopsToday[stop] = [];
                const mins = toMinList(times).filter(m => m !== null);
                allStopsToday[stop].push({ routeName, color, mins });
            }
            // Check hour window for upcoming times
            if (activeHours) {
                const h = now.getHours();
                const [s, e] = activeHours;
                const active = s <= e ? (h >= s && h < e) : (h >= s || h < e);
                if (!active) return;
            }
            for (const [stop, times] of Object.entries(tbl)) {
                if (!activeStopSchedules[stop]) activeStopSchedules[stop] = [];
                const mins = toMinList(times).filter(m => m !== null);
                activeStopSchedules[stop].push({ routeName, color, mins });
            }
        };

        // Store timetables for schedule modal
        this.routeTimetables = {
            '1636': { label: "1636'er", days: 'Weekends', tbl: ER_times },
            'ME':   { label: 'Mather Express',    days: 'M–F', tbl: ME_times },
            'QSD':  { label: 'Quad Stadium',       days: 'M–F', tbl: QSD_times },
            'QSEC': { label: 'Quad SEC Direct',    days: 'M–F', tbl: QSEC_times },
            'AL':   { label: 'Allston Loop',       days: 'Daily', tbl: AL_times },
            'SE':   { label: 'SEC Express',        days: 'M–F', tbl: SE_times },
            'QE':   { label: 'Quad Express',       days: 'M–F', tbl: QX_times },
            'QYE':  { label: 'Quad Yard Express',  days: 'M–F', tbl: { ...QYE_early, ...Object.fromEntries(Object.entries(QYE_late).map(([k,v]) => [k, [...(QYE_early[k]||[]), ...v]])) } },
            'CC':   { label: 'Crimson Cruiser',    days: 'Daily', tbl: CC_times },
            'ON':   { label: 'Overnight',          days: 'M–F', tbl: ON_times },
        };

        const isFriSat = dayOfWeek === 5 || dayOfWeek === 6;
        addTimes(EO_base,   'Extended Overnight',          '#6c757d', 'daily',   [0, 5]);
        if (isFriSat) addTimes(EO_frisat, 'Extended Overnight', '#6c757d', 'daily', [3, 6]);

        // Mon–Fri Morning/Afternoon routes
        addTimes(ME_times,   'Mather Express',   '#0000FF', 'weekday', [7, 15]);
        addTimes(SE_times,   'SEC Express',       '#fdae6b', 'weekday', [7, 16]);
        addTimes(QX_times,   'Quad Express',      '#136d1c', 'weekday', [7, 16]);
        addTimes(QSD_times,  'Quad Stadium',      '#50BC48', 'weekday', [5, 8]);
        addTimes(QSEC_times, 'Quad SEC Direct',   '#9467bd', 'weekday', [7, 20]);

        addTimes(QYE_early, 'Quad Yard Express',  '#006600', 'weekday', [16, 20]);
        addTimes(QYE_late,  'Quad Yard Express',  '#006600', 'weekday', [20, 3]);

        // Mon–Fri Evening/Night routes
        addTimes(CC_times,   'Crimson Cruiser',   '#db0dd7', 'weekday', [16, 21]);
        addTimes(ON_times,   'Overnight',         '#ff8707', 'weekday', [20, 3]);

        // Allston Loop — weekdays all day + weekends
        addTimes(AL_times,   'Allston Loop',      '#a50606', 'weekday', [7, 24]);
        addTimes(AW_times,   'Allston Loop',      '#a50606', 'weekend', [17, 23]);

        // Weekend-only routes (Crimson Cruiser also runs weekends)
        addTimes(CC_times,   'Crimson Cruiser',   '#db0dd7', 'weekend', [16, 21]);

        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const WINDOW = 60; // only show buses arriving within 60 minutes

        const fmtMin = (m) => {
            const h = Math.floor(m / 60), mn = m % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `${h % 12 || 12}:${String(mn).padStart(2,'0')} ${ampm}`;
        };

        // Only show routes currently scheduled as running
        const activeRouteNames = new Set(
            this.routes.filter(r => this.getStaticRouteStatus(r) === 'running').map(r => r.name)
        );

        // Find next upcoming times per route — merge duplicate route entries, cap at 3 times
        const getNextBuses = (stopName) => {
            const entries = allStopsToday[stopName] || [];
            const byRoute = {};
            for (const { routeName, color, mins } of entries) {
                if (!activeRouteNames.has(routeName)) continue;
                const upcoming = mins.filter(m => m >= nowMin);
                if (upcoming.length === 0) continue;
                if (!byRoute[routeName]) byRoute[routeName] = { routeName, color, allMins: [] };
                byRoute[routeName].allMins.push(...upcoming);
            }
            const results = [];
            for (const { routeName, color, allMins } of Object.values(byRoute)) {
                const sorted = [...new Set(allMins)].sort((a, b) => a - b).slice(0, 3);
                results.push({ routeName, color, times: sorted, mins: sorted[0] });
            }
            results.sort((a, b) => a.mins - b.mins);
            return results;
        };

        // Draw a dot for every stop that has any service registered today
        for (const [stopName, coords] of Object.entries(STOP_COORDS)) {
            if (!allStopsToday[stopName]) continue; // no service at all today

            const nextBuses = getNextBuses(stopName);
            const hasUpcoming = nextBuses.length > 0;

            const el = document.createElement('div');
            el.style.cssText = `
                width: 10px; height: 10px;
                background: ${hasUpcoming ? '#222' : '#aaa'};
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            `;

            let popupContent;
            if (hasUpcoming) {
                const next = nextBuses[0];
                const waitMin = next.mins - nowMin;
                const waitLabel = waitMin <= 1 ? 'Now' : `${waitMin} min`;
                const popupRows = nextBuses.map(b =>
                    `<div style="padding:4px 0;border-bottom:1px solid #eee;">
                        <div style="color:${b.color};font-weight:700;font-size:11px;">${b.routeName}</div>
                        <div style="font-size:11px;color:#333;">${b.times.map(fmtMin).join(', ')}</div>
                    </div>`
                ).join('');
                popupContent = `
                    <div style="font-size:10px;color:#6c757d;margin-bottom:4px">Next buses:</div>
                    ${popupRows}
                    <div style="font-size:10px;color:#6c757d;margin-top:5px">Soonest: <strong>${waitLabel}</strong></div>`;
            } else {
                popupContent = `<div style="font-size:12px;color:#999;">No more buses today</div>`;
            }

            const popup = new mapboxgl.Popup({ offset: 10, closeButton: false, maxWidth: '200px' })
                .setHTML(`
                    <div style="min-width:160px">
                        <div style="font-weight:bold;font-size:13px;margin-bottom:6px;border-bottom:2px solid #A51C30;padding-bottom:4px">${stopName}</div>
                        ${popupContent}
                    </div>
                `);

            const routeNames = (allStopsToday[stopName] || []).map(e => e.routeName);
            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat(coords)
                .setPopup(popup)
                .addTo(this.map);
            marker._routeNames = routeNames;
            this.stopMarkers.push(marker);
        }
    }

    // -------------------------------------------------------------------------
    // Live Vehicle Markers
    // -------------------------------------------------------------------------

    updateMapMarkers() {
        if (!this.map) return;

        this.shuttleMarkers.forEach(m => m.remove());
        this.shuttleMarkers = [];

        if (!this.realtimeData || !this.realtimeData.vehicles) {
            this.updateRouteTogglePanel();
            return;
        }

        this.realtimeData.vehicles.forEach(vehicle => {
            const lat = parseFloat(vehicle.latitude);
            const lng = parseFloat(vehicle.longitude);
            if (!lat || !lng) return;

            const apiRouteName = vehicle.route || '';
            const mappedShort = API_NAME_MAP[apiRouteName];
            const routeDef = mappedShort ? this.routes.find(r => r.shortName === mappedShort) : null;

            // Skip vehicles whose route is outside scheduled hours
            if (routeDef && this.getStaticRouteStatus(routeDef) === 'not-running') return;

            const markerLabel = routeDef ? routeDef.shortName : apiRouteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
            const color = routeDef ? routeDef.color : ((vehicle.color && vehicle.color.startsWith('#')) ? vehicle.color : '#A51C30');
            const displayName = routeDef ? routeDef.name : apiRouteName;

            const el = document.createElement('div');
            el.style.cssText = `
                background: ${color};
                color: white;
                padding: 4px 8px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                cursor: pointer;
                white-space: nowrap;
            `;
            el.textContent = markerLabel;

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <strong>${displayName}</strong><br>
                    <span style="color:${color}">🚌 Live</span>
                `))
                .addTo(this.map);

            marker._routeId = routeDef ? (routeDef.apiRouteId || routeDef.id) : vehicle.routeId;
            this.shuttleMarkers.push(marker);
        });

        this.updateRouteTogglePanel();
    }

    // -------------------------------------------------------------------------
    // Route Toggle Panel (Map tab)
    // -------------------------------------------------------------------------

    updateRouteTogglePanel() {
        const panel = document.getElementById('route-toggle-panel');
        if (!panel) return;

        const activeRoutes = this.routes.filter(r => this.getStaticRouteStatus(r) === 'running');

        if (activeRoutes.length === 0) {
            panel.innerHTML = '<span style="color:#6c757d;font-size:12px">No active routes</span>';
            return;
        }

        activeRoutes.sort((a, b) => a.name.localeCompare(b.name));

        panel.innerHTML = activeRoutes.map(r => {
            const color = r.color || '#A51C30';
            const apiId = this.apiRouteIds[r.shortName] || r.apiRouteId || r.id;
            const isHidden = this.hiddenRouteIds.has(apiId);
            return `<button
                onclick="tracker.toggleRouteVisibility('${apiId}')"
                data-color="${color}"
                style="background:${isHidden ? '#ccc' : color};color:white;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:bold;cursor:pointer;transition:background 0.2s;"
                title="${r.name}"
            >${r.shortName}</button>`;
        }).join('');
    }

    toggleRouteVisibility(apiId) {
        const isHidden = this.hiddenRouteIds.has(apiId);
        if (isHidden) {
            this.hiddenRouteIds.delete(apiId);
        } else {
            this.hiddenRouteIds.add(apiId);
        }
        this._applyVisibility();
        this.updateRouteTogglePanel();
    }

    _applyVisibility() {
        const activeRoutes = this.routes.filter(r => this.getStaticRouteStatus(r) === 'running');

        // Polylines
        for (const r of activeRoutes) {
            const apiId = this.apiRouteIds[r.shortName] || r.apiRouteId || r.id;
            if (this.map.getLayer(`route-line-${apiId}`)) {
                this.map.setLayoutProperty(`route-line-${apiId}`, 'visibility', this.hiddenRouteIds.has(apiId) ? 'none' : 'visible');
            }
        }

        // Vehicle markers
        this.shuttleMarkers.forEach(m => {
            m.getElement().style.display = this.hiddenRouteIds.has(m._routeId) ? 'none' : '';
        });

        // Stop markers always visible
        this.stopMarkers.forEach(m => { m.getElement().style.display = ''; });
    }

    showAllRoutes() {
        this.hiddenRouteIds.clear();
        this._applyVisibility();
        this.updateRouteTogglePanel();
    }

    hideAllRoutes() {
        const activeRoutes = this.routes.filter(r => this.getStaticRouteStatus(r) === 'running');
        activeRoutes.forEach(r => this.hiddenRouteIds.add(this.apiRouteIds[r.shortName] || r.apiRouteId || r.id));
        this._applyVisibility();
        this.updateRouteTogglePanel();
    }

    // -------------------------------------------------------------------------
    // Data Fetching (PassioGo API)
    // -------------------------------------------------------------------------

    async fetchRealtimeData() {
        try {
            // Fetch live vehicles via POST with JSON body (PassioGo API format)
            const res = await fetch(
                'https://passiogo.com/mapGetData.php?getBuses=2',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ s0: '831', sA: 1 })
                }
            );
            const data = await res.json();
            const vehicles = [];
            if (data && data.buses) {
                for (const [routeId, busArray] of Object.entries(data.buses)) {
                    if (routeId === '-1') continue;
                    for (const bus of busArray) {
                        if (bus && bus.latitude && bus.longitude) {
                            vehicles.push({ ...bus, routeId });
                        }
                    }
                }
            }
            this.realtimeData = { vehicles };
        } catch (error) {
            this.realtimeData = null;
        }
    }

    getRouteStatus(route) {
        // Static schedule is the gate — never show a route outside its scheduled hours
        const staticStatus = this.getStaticRouteStatus(route);
        if (staticStatus === 'not-running') return 'not-running';

        // Within scheduled hours: confirm with live vehicles if available
        if (this.realtimeData && this.realtimeData.vehicles) {
            const hasLive = this.realtimeData.vehicles.some(v => API_NAME_MAP[v.route] === route.shortName);
            if (hasLive) return 'running';
        }

        return staticStatus;
    }
    
    // -------------------------------------------------------------------------
    // Schedule Logic
    // -------------------------------------------------------------------------

    getStaticRouteStatus(route) {
        const h = new Date().getHours();
        const day = new Date().getDay(); // 0=Sun,1=Mon..5=Fri,6=Sat
        const isWeekday = day >= 1 && day <= 5;
        const isWeekend = day === 0 || day === 6;
        const isFriSat  = day === 5 || day === 6;

        // inRange: handles overnight windows where end < start (e.g. [20,3])
        const inRange = (s, e) => s <= e ? (h >= s && h < e) : (h >= s || h < e);

        // Rules keyed by shortName
        switch (route.shortName) {
            // Mon–Fri Morning/Afternoon
            case 'ME':   return isWeekday && inRange(7,15)  ? 'running' : 'not-running';
            case 'SE':   return isWeekday && inRange(7,16)  ? 'running' : 'not-running';
            case 'QE':   return isWeekday && inRange(7,16)  ? 'running' : 'not-running';
            case 'QSD':  return isWeekday && inRange(5,8)   ? 'running' : 'not-running';
            case 'QSEC': return isWeekday && inRange(7,20)  ? 'running' : 'not-running';
            // Mon–Fri Evening/Night
            case 'QYE':  return isWeekday && inRange(16,3)  ? 'running' : 'not-running';
            case 'CC':   return (isWeekday || isWeekend) && inRange(16,21) ? 'running' : 'not-running';
            case 'ON':   return isWeekday && inRange(20,3)  ? 'running' : 'not-running';
            // Allston Loop — weekdays all day, weekends evening
            case 'AL':
                if (isWeekday) return inRange(7,24) ? 'running' : 'not-running';
                if (isWeekend) return inRange(17,23) ? 'running' : 'not-running';
                return 'not-running';
            // Weekend-only
            case '1636': return isWeekend && inRange(8,23)  ? 'running' : 'not-running';
            default:     return 'not-running';
        }
    }
    
    // -------------------------------------------------------------------------
    // UI Utilities
    // -------------------------------------------------------------------------

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
    
    // -------------------------------------------------------------------------
    // Live Routes View
    // -------------------------------------------------------------------------

    getVehiclesForRoute(route) {
        if (!this.realtimeData || !this.realtimeData.vehicles) return [];
        return this.realtimeData.vehicles.filter(v => API_NAME_MAP[v.route] === route.shortName);
    }

    getNearestStop(lat, lng) {
        let nearest = null, minDist = Infinity;
        for (const [name, [sLng, sLat]] of Object.entries(STOP_COORDS)) {
            const d = Math.hypot(lat - sLat, lng - sLng);
            if (d < minDist) { minDist = d; nearest = name; }
        }
        return nearest;
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
            const color = route.color || '#2d6a2d';
            const vehicles = this.getVehiclesForRoute(route);
            const busCount = vehicles.length;

            const busLines = vehicles.map(v => {
                const nearest = this.getNearestStop(parseFloat(v.latitude), parseFloat(v.longitude));
                return `<div style="font-size:11px;color:#555;padding:2px 0;">🚌 Bus ${v.busName || v.bus} — near <strong>${nearest || 'en route'}</strong></div>`;
            }).join('');

            const liveInfo = busCount > 0
                ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0;">
                       <div style="font-size:11px;font-weight:600;color:${color};margin-bottom:2px;">${busCount} bus${busCount > 1 ? 'es' : ''} running</div>
                       ${busLines}
                   </div>`
                : '';

            return `
                <div class="route status-${status}" onclick="tracker.selectRoute('${route.id}')" style="border-left: 5px solid ${color}; background:#fff;cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="background:${color};color:#fff;font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px;white-space:nowrap;">${route.shortName}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:14px;color:#222;">${route.name}</div>
                            <div style="font-size:11px;color:#777;">${route.schedule || ''}</div>
                        </div>
                        <span style="font-size:10px;color:#ccc;">&#9654;</span>
                    </div>
                    ${liveInfo}
                </div>
            `;
        }).join('');
        
        container.innerHTML = routesHtml;
    }
    
    renderInactiveRoutes(routes) {
        const container = document.getElementById('inactive-routes');
        const dropdown = document.getElementById('inactive-dropdown');
        if (!container || !dropdown) return;
        
        if (routes.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        dropdown.style.display = 'block';
        
        // Sort inactive routes alphabetically
        const sortedRoutes = routes.sort((a, b) => a.name.localeCompare(b.name));
        
        const routesHtml = sortedRoutes.map(route => {
            const color = route.color || '#999';
            return `
                <div class="route status-not-running" style="border-left: 5px solid ${color}55; background:#fff; opacity:0.7;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="background:#bbb;color:#fff;font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px;white-space:nowrap;">${route.shortName}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:14px;color:#666;">${route.name}</div>
                            <div style="font-size:11px;color:#aaa;">${route.schedule || ''}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = routesHtml;
    }
    
    selectRoute(routeId) {
        // Navigate to schedule tab and highlight the route
        showView('schedule');
        setTimeout(() => {
            const el = document.getElementById(`sched-${routeId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // -------------------------------------------------------------------------
    // Schedules View
    // -------------------------------------------------------------------------

    renderScheduleView() {
        const container = document.getElementById('schedule-content');
        if (!container || !this.routeTimetables) return;

        const active = [...this.routes].filter(r => this.getStaticRouteStatus(r) === 'running').sort((a, b) => a.name.localeCompare(b.name));
        const inactive = [...this.routes].filter(r => this.getStaticRouteStatus(r) !== 'running').sort((a, b) => a.name.localeCompare(b.name));
        const sorted = [...active, ...inactive];

        const sectionHeader = (text) => `<div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.8px;padding:8px 2px 4px;">${text}</div>`;

        const renderCard = (route) => {
            const tt = this.routeTimetables[route.shortName];
            const color = route.color || '#A51C30';
            const isActive = this.getStaticRouteStatus(route) === 'running';

            let tableHtml;
            if (tt) {
                const stops = Object.keys(tt.tbl);
                const rows = stops.map(stop => {
                    const times = tt.tbl[stop].filter(t => t !== '-').join(' · ');
                    return `<div style="padding:5px 0;border-bottom:1px solid #f5f5f5;display:flex;gap:8px;">
                        <span style="font-size:11px;font-weight:600;color:#444;min-width:120px;flex-shrink:0;">${stop}</span>
                        <span style="font-size:11px;color:#666;line-height:1.5;">${times || '—'}</span>
                    </div>`;
                }).join('');
                tableHtml = `
                    <div style="font-size:10px;color:#999;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${tt.days} · Full Schedule</div>
                    ${rows}`;
            } else {
                tableHtml = `<div style="font-size:12px;color:#aaa;">No schedule data available.</div>`;
            }

            return `
                <div id="sched-${route.id}" style="background:#fff;border-radius:10px;border-left:5px solid ${color};margin-bottom:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);opacity:${isActive ? 1 : 0.6};">
                    <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.sch-chev').style.transform=this.nextElementSibling.style.display==='block'?'rotate(180deg)':''">
                        <span style="background:${isActive ? color : '#bbb'};color:#fff;font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px;">${route.shortName}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;font-size:14px;color:${isActive ? '#222' : '#666'};">${route.name}</div>
                            <div style="font-size:11px;color:#999;">${route.schedule || ''}</div>
                        </div>
                        <span class="sch-chev" style="font-size:11px;color:#aaa;transition:transform 0.2s;">▼</span>
                    </div>
                    <div style="display:none;padding:0 14px 12px;border-top:1px solid #f0f0f0;">${tableHtml}</div>
                </div>`;
        };

        const activePart = active.length ? sectionHeader('Active Routes') + active.map(renderCard).join('') : '';
        const inactivePart = inactive.length ? sectionHeader('Inactive Routes') + inactive.map(renderCard).join('') : '';
        container.innerHTML = activePart + inactivePart;
    }
    
}

// --- Global UI Functions -----------------------------------------------------

function showView(view) {
    // Hide all views
    document.querySelectorAll('.routes').forEach(v => v.classList.remove('active'));
    
    // Remove active from all buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected view
    document.getElementById(`${view}-view`).classList.add('active');
    
    // Activate matching button
    // Render schedule view on first open
    if (view === 'schedule' && tracker.routeTimetables) tracker.renderScheduleView();

    const btnMap = { schedule: 0, routes: 1, map: 2 };
    const btnIndex = btnMap[view];
    if (btnIndex !== undefined) {
        document.querySelectorAll('.nav-btn')[btnIndex].classList.add('active');
    }
    
    // Resize map when switching to map view
    if (view === 'map' && tracker.map) {
        setTimeout(() => tracker.map.resize(), 50);
    }
}

// --- App Entry Point ---------------------------------------------------------

const tracker = new ShuttleTracker();
