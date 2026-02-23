// Harvard Go! Shuttle Tracker
const MAPBOX_TOKEN = 'MAPBOX_TOKEN_REMOVED';

class ShuttleTracker {
    constructor() {
        this.map = null;
        this.shuttleMarkers = [];
        this.stopMarkers = [];
        this.hiddenRouteIds = new Set();
        this.apiRouteIds = {}; // shortName → API routeId for map layer lookups
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
    
    async init() {
        this.updateDateTime();
        await this.fetchRealtimeData();
        this.renderRoutes();
        this.initMap();
        
        // Update every 30 seconds
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

            // Explicit map: API route name → our route shortName for reliable matching
            const apiNameMap = {
                'Allston Loop':          'AL',
                'Overnight':             'ON',
                'Quad Express':          'QE',
                'Mather Express':        'ME',
                'Quad SEC Direct':       'QSEC',
                'Quad Yard Express':     'QYE',
                'Quad Stadium Express':  'QSD',
                "1636'er":               '1636',
                'Crimson Cruiser':       'CC',
                'SEC Express':           'SE',
            };

            // Draw each route using its dense GPS path
            for (const [routeId, segments] of Object.entries(routePoints)) {
                const apiRouteName = routes[routeId] ? routes[routeId][0] : '';

                // Match to our route definition via explicit map
                const shortName = apiNameMap[apiRouteName];
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

    drawStopMarkers() {
        if (!this.map) return;

        // Clear existing stop markers
        this.stopMarkers.forEach(m => m.remove());
        this.stopMarkers = [];

        // Stop coordinates from PassioGo API
        const STOPS = {
            'Mather House':             [-71.115333, 42.368759],
            'The Inn':                  [-71.115427, 42.372127],
            'Widener Gate':             [-71.116972, 42.372844],
            'Memorial Hall':            [-71.114393, 42.376452],
            'Lamont Library':           [-71.115007, 42.372867],
            'Quad':                     [-71.125325, 42.381867],
            'Radcliffe Yard':           [-71.122120, 42.376500],
            'Mass and Garden':          [-71.119467, 42.375187],
            'Law School':               [-71.119937, 42.377977],
            'Maxwell Dworkin':          [-71.116630, 42.378933],
            'Winthrop House':           [-71.117267, 42.371468],
            'SEC':                      [-71.125393, 42.363329],
            "Barry's Corner":           [-71.127742, 42.363958],
            'Stadium':                  [-71.124887, 42.367121],
            'Kennedy School':           [-71.120953, 42.371496],
            'Harvard Square':           [-71.119967, 42.372727],
            'Harvard Square (Southbound)': [-71.119734, 42.373379],
            'Kennedy School (Southbound)':  [-71.121339, 42.371203],
            'Stadium (Southbound)':         [-71.125015, 42.367024],
            "Barry's Corner (Southbound)":  [-71.127862, 42.363936],
            '1 Western Ave':            [-71.119075, 42.364114],
            'Science Center':           [-71.115974, 42.376902],
            'Leverett House':           [-71.116713, 42.370084],
            'Winthrop House':           [-71.117267, 42.371468],
            'Cambridge Common':          [-71.122418, 42.376995],
        };

        // Convert a list of schedule times to minutes-since-midnight.
        // The first entry may have AM/PM; subsequent bare times continue in the same
        // half-day, rolling over to the next half when the hour decreases.
        const toMinList = (times) => {
            let isPM = null;
            let lastH = -1;
            return times.map(t => {
                t = t.trim();
                if (!t || t === '-') return null;
                const hasPM = /pm/i.test(t);
                const hasAM = /am/i.test(t);
                t = t.replace(/[apm]/gi, '').trim();
                let [h, m] = t.split(':').map(Number);
                m = m || 0;
                if (hasPM) isPM = true;
                else if (hasAM) isPM = false;
                if (isPM === null) isPM = false;
                // Flip to PM when: no explicit suffix, was AM, and hour rolled from 11→12 or 11→1..
                if (!hasPM && !hasAM && !isPM) {
                    if (h === 12 && lastH >= 10) isPM = true;          // 11:xx → 12:xx = noon
                    else if (h < lastH && lastH >= 11) isPM = true;    // 11:xx → 1:xx = 1 PM
                    else if (isPM && h < lastH && h !== 12) isPM = true; // already PM, hour wrapped
                }
                let h24 = h;
                if (isPM && h !== 12) h24 = h + 12;
                if (!isPM && h === 12) h24 = 0;
                lastH = h;
                return h24 * 60 + m;
            });
        };

        // Mather Express (weekdays)
        const ME_times = {
            'Mather House':  ['7:40AM','8:00','8:20','8:45','9:10','9:30','9:50','10:10','10:30','10:50','11:10','11:30','11:40','12:00','12:20','12:40','1:00','1:20','1:40','2:00','2:20','2:45','3:10'],
            'The Inn':       ['7:42','8:02','8:22','8:47','9:12','9:32','9:52','10:12','10:32','10:52','11:12','11:32','11:42','12:02','12:22','12:42','1:02','1:22','1:42','2:00','2:22','2:47','3:12'],
            'Widener Gate':  ['7:43','8:03','8:23','8:48','9:13','9:33','9:53','10:13','10:33','10:53','11:13','11:33','11:43','12:03','12:23','12:43','1:03','1:23','1:43','2:03','2:23','2:48','3:13'],
            'Memorial Hall': ['7:50','8:10','8:30','8:55','9:20','9:40','10:00','10:20','10:40','11:00','11:20','-','11:50','12:10','12:30','12:50','1:10','1:30','1:50','2:10','2:30','2:55','3:20'],
            'Lamont Library':['7:55','8:15','8:35','9:00','9:25','9:45','10:05','10:25','10:45','-','11:23','-','11:55','11:15','12:35','12:55','1:15','1:35','1:55','2:15','2:35','3:00','-'],
        };


        // Quad Stadium (early AM)
        const QSD_times = {
            'Quad':           ['5:20AM','5:45','6:15','6:40','7:15'],
            'Harvard Square': ['5:22','5:47','6:17','6:42','7:17'],
            'Lamont Library': ['5:24','5:50','6:20','6:45','7:20'],
            'Winthrop House': ['5:26','5:52','6:22','6:48','7:22'],
            'Mather House':   ['5:28','5:55','6:25','6:50','7:25'],
            'Stadium':        ['5:30','6:00','6:30','6:55','7:30'],
        };

        // Allston Weekend
        const AW_times = {
            'SEC':            ['5:15PM','5:45','6:15','6:45','7:15','7:45'],
            "Barry's Corner": ['5:16','5:46','6:16','6:46','7:16','7:46'],
            'Stadium':        ['5:17','5:57','6:17','6:47','7:17','7:47'],
            'Kennedy School': ['5:20','5:50','6:20','6:50','7:20','7:50'],
            'Harvard Square': ['5:22','5:52','6:22','6:52','7:22','7:52'],
            'Law School':     ['5:24','5:54','6:24','6:54','7:24','7:54'],
            'Maxwell Dworkin':['5:26','5:56','6:26','6:56','7:26','-'],
            'Memorial Hall':  ['5:30','6:00','6:30','7:00','7:30','-'],
            'Lamont Library': ['5:35','6:05','6:35','7:05','7:35','-'],
            '1 Western Ave':  ['5:42','6:12','6:42','7:12','7:42','-'],
        };

        // Quad SEC (bidirectional weekdays) — full schedule from image
        const QSEC_times = {
            'SEC':                          ['7:00AM','7:20AM','7:40AM','8:00AM','8:20AM','8:40AM','9:00AM','9:20AM','9:40AM','10:00AM','10:20AM','10:40AM','11:05AM','11:20AM','11:40AM','12:00PM','12:20PM','12:40PM','1:00PM','1:20PM','1:40PM','2:05PM','2:20PM','2:40PM','3:00PM','3:40PM','4:00PM','-','4:40PM','5:05PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','7:20PM'],
            "Barry's Corner":               ['7:01AM','7:21AM','7:41AM','8:01AM','8:21AM','8:41AM','9:01AM','9:21AM','9:41AM','10:01AM','10:21AM','10:41AM','11:06AM','11:21AM','11:41AM','12:01PM','12:21PM','12:41PM','1:01PM','1:21PM','1:41PM','2:06PM','2:21PM','2:41PM','3:01PM','3:41PM','4:01PM','-','4:41PM','5:06PM','5:21PM','5:41PM','6:01PM','6:21PM','6:41PM','7:01PM','7:21PM'],
            'Stadium':                      ['7:02AM','7:22AM','7:42AM','8:02AM','8:22AM','8:42AM','9:02AM','9:22AM','9:42AM','10:02AM','10:22AM','10:42AM','11:07AM','11:22AM','11:42AM','12:02PM','12:22PM','12:42PM','1:02PM','1:22PM','1:42PM','2:07PM','2:22PM','2:42PM','3:02PM','3:42PM','4:02PM','-','4:42PM','5:07PM','5:22PM','5:42PM','6:02PM','6:22PM','6:42PM','7:02PM','7:22PM'],
            'Harvard Square':               ['7:06AM','7:26AM','7:46AM','8:06AM','8:26AM','8:46AM','9:06AM','9:26AM','9:46AM','10:06AM','10:26AM','10:46AM','11:11AM','11:26AM','11:46AM','12:06PM','12:26PM','12:46PM','1:06PM','1:26PM','1:46PM','2:06PM','2:26PM','2:46PM','3:06PM','3:42PM','4:06PM','-','4:46PM','5:06PM','5:26PM','5:46PM','6:06PM','6:26PM','6:46PM','7:06PM','7:26PM'],
            'Quad':                         ['7:20AM','7:40AM','8:00AM','8:20AM','8:40AM','9:00AM','9:20AM','9:40AM','10:00AM','10:20AM','10:40AM','10:55AM','11:20AM','11:40AM','12:00PM','12:20PM','12:40PM','1:00PM','1:20PM','1:40PM','1:55PM','2:20PM','2:40PM','3:00PM','3:20PM','-','4:20PM','4:40PM','4:55PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','7:20PM','7:40PM'],
            'Harvard Square (Southbound)':  ['7:26AM','7:46AM','8:06AM','8:26AM','8:46AM','9:06AM','9:26AM','9:46AM','10:06AM','10:26AM','10:46AM','11:00AM','11:26AM','11:46AM','12:06PM','12:26PM','12:46PM','1:06PM','1:26PM','1:46PM','2:06PM','2:26PM','2:46PM','3:06PM','3:26PM','-','4:26PM','4:46PM','5:06PM','5:26PM','5:46PM','6:06PM','6:26PM','6:46PM','7:06PM','7:26PM','7:46PM'],
            'Stadium (Southbound)':         ['7:28AM','7:48AM','8:08AM','8:28AM','8:48AM','9:08AM','9:28AM','9:48AM','10:08AM','10:28AM','10:48AM','11:02AM','11:28AM','11:48AM','12:08PM','12:28PM','12:48PM','1:08PM','1:28PM','1:48PM','2:08PM','2:28PM','2:48PM','3:08PM','3:28PM','-','4:28PM','4:48PM','5:08PM','5:28PM','5:48PM','6:08PM','6:28PM','6:48PM','7:08PM','7:28PM','7:48PM'],
            "Barry's Corner (Southbound)":  ['7:29AM','7:49AM','8:09AM','8:29AM','8:49AM','9:09AM','9:29AM','9:49AM','10:09AM','10:29AM','10:49AM','11:03AM','11:29AM','11:49AM','12:09PM','12:29PM','12:49PM','1:09PM','1:29PM','1:49PM','2:09PM','2:29PM','2:49PM','3:09PM','3:29PM','-','4:29PM','-','5:09PM','5:29PM','5:49PM','6:09PM','6:29PM','6:49PM','7:09PM','7:29PM','-'],
        };

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

        // Allston Loop (weekdays)
        const AL_times = {
            'SEC':            ['7:00AM','7:40AM','8:20AM','9:00AM','9:40AM','10:20AM','11:00AM','-','12:30PM','1:20PM','2:00PM','-','3:35PM','4:15PM','4:20PM','4:40PM','5:00PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','7:20PM','8:00PM','8:10PM','8:40PM','-','9:10PM','9:40PM','10:10PM','10:46PM','11:16PM','11:46PM'],
            "Barry's Corner": ['7:01AM','7:41AM','8:21AM','9:01AM','9:42AM','10:21AM','11:01AM','-','12:31PM','1:21PM','2:01PM','-','3:36PM','4:16PM','4:21PM','4:41PM','5:01PM','5:21PM','5:41PM','6:01PM','6:21PM','6:41PM','7:01PM','7:21PM','8:01PM','8:11PM','8:41PM','-','9:11PM','9:41PM','10:11PM','10:47PM','11:17PM','11:47PM'],
            'Stadium':        ['7:02AM','7:42AM','8:22AM','9:02AM','9:42AM','10:22AM','11:02AM','-','12:32PM','1:22PM','2:02PM','-','3:37PM','4:17PM','4:22PM','4:42PM','5:02PM','5:22PM','5:42PM','6:02PM','6:22PM','6:42PM','7:02PM','7:22PM','8:02PM','8:12PM','8:42PM','-','9:12PM','9:42PM','10:12PM','10:48PM','11:18PM','11:48PM'],
            'Kennedy School': ['7:06AM','7:46AM','8:26AM','9:06AM','9:46AM','10:26AM','11:06AM','-','12:36PM','1:26PM','2:06PM','-','3:38PM','4:21PM','4:26PM','4:46PM','5:06PM','5:26PM','5:46PM','6:06PM','6:26PM','6:46PM','7:06PM','7:26PM','8:06PM','8:16PM','8:46PM','-','9:16PM','9:46PM','10:16PM','10:52PM','11:22PM','11:52PM'],
            'Harvard Square': ['7:09AM','7:49AM','8:29AM','9:09AM','9:49AM','10:29AM','11:09AM','-','12:39PM','1:29PM','2:09PM','-','3:39PM','4:24PM','4:29PM','4:49PM','5:09PM','5:29PM','5:49PM','6:09PM','6:29PM','6:49PM','7:09PM','7:29PM','8:09PM','8:19PM','8:49PM','-','9:19PM','9:49PM','10:19PM','10:55PM','11:25PM','11:55PM'],
            'Law School':     ['7:13AM','7:53AM','8:33AM','9:13AM','9:53AM','10:33AM','11:13AM','11:35AM','12:43PM','1:33PM','2:13PM','-','3:43PM','4:26PM','4:33PM','4:53PM','5:13PM','5:33PM','5:53PM','6:13PM','6:33PM','6:53PM','-','7:33PM','8:13PM','8:21PM','8:51PM','-','9:21PM','9:51PM','10:21PM','10:57PM','11:27PM','11:57PM'],
            'Maxwell Dworkin':['7:16AM','7:56AM','8:36AM','9:16AM','9:56AM','10:36AM','11:16AM','11:38AM','12:46PM','1:36PM','2:16PM','3:46PM','3:46PM','4:28PM','4:36PM','4:56PM','5:16PM','5:36PM','5:56PM','6:16PM','6:36PM','6:56PM','-','7:36PM','8:16PM','8:23PM','8:53PM','-','9:23PM','9:53PM','10:23PM','10:57PM','11:27PM','-'],
            'Memorial Hall':  ['7:20AM','8:00AM','8:40AM','9:20AM','10:00AM','10:40AM','11:20AM','11:45AM','1:00PM','1:40PM','2:20PM','3:10PM','4:00PM','4:30PM','4:40PM','5:00PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','-','7:40PM','8:20PM','8:25PM','-','-','9:23PM','9:55PM','10:25PM','11:00PM','11:30PM','12:00AM'],
            'Lamont Library': ['7:25AM','8:05AM','8:45AM','9:25AM','10:05AM','10:45AM','-','11:47AM','1:05PM','1:45PM','2:25PM','3:15PM','4:05PM','4:35PM','4:45PM','5:05PM','5:25PM','5:45PM','6:05PM','6:25PM','6:45PM','7:05PM','-','7:45PM','-','8:30PM','-','-','9:30PM','10:00PM','10:30PM','11:08PM','11:38PM','12:08AM'],
            '1 Western Ave':  ['7:32AM','8:12AM','8:52AM','9:32AM','10:12AM','10:52AM','-','11:54AM','1:12PM','1:52PM','2:32PM','3:26PM','4:12PM','4:41PM','4:52PM','5:12PM','5:32PM','5:52PM','6:12PM','6:32PM','6:52PM','7:12PM','-','7:52PM','-','8:37PM','-','-','9:37PM','10:07PM','-','11:15PM','11:45PM','-'],
        };

        // SEC Express (weekdays 7:30 AM – 3:45 PM)
        const SE_times = {
            'SEC':            ['7:30AM','8:00AM','8:15AM','8:30AM','8:45AM','9:00AM','9:15AM','9:30AM','9:45AM','10:00AM','10:15AM','10:30AM','10:45AM','11:00AM','11:15AM','11:30AM','11:45AM','12:00PM','-','12:30PM','12:45PM','1:00PM','1:15PM','1:30PM','1:45PM','2:00PM','2:15PM','2:30PM','2:45PM','3:00PM','3:15PM','-','3:45PM'],
            "Barry's Corner": ['7:31AM','8:01AM','8:16AM','8:31AM','8:46AM','9:01AM','9:16AM','9:31AM','9:46AM','10:01AM','10:16AM','10:31AM','10:46AM','11:01AM','11:16AM','11:31AM','11:46AM','12:01PM','-','12:31PM','12:46PM','1:01PM','1:16PM','1:31PM','1:46PM','2:01PM','2:16PM','2:31PM','2:46PM','3:01PM','3:16PM','-','3:46PM'],
            'Stadium':        ['7:32AM','8:02AM','8:17AM','8:32AM','8:47AM','9:02AM','9:17AM','9:32AM','9:47AM','10:02AM','10:17AM','10:32AM','10:47AM','11:02AM','11:17AM','11:32AM','11:47AM','12:02PM','-','12:32PM','12:47PM','1:02PM','1:17PM','1:32PM','1:47PM','2:02PM','2:17PM','2:32PM','2:47PM','3:02PM','3:17PM','-','3:47PM'],
            'Kennedy School': ['7:36AM','8:06AM','8:21AM','8:36AM','8:51AM','9:06AM','9:21AM','9:36AM','9:51AM','10:06AM','10:21AM','10:36AM','10:51AM','11:06AM','11:21AM','11:36AM','11:51AM','12:06PM','-','12:36PM','12:51PM','1:06PM','1:21PM','1:36PM','1:51PM','2:06PM','2:21PM','2:36PM','2:51PM','3:06PM','3:21PM','-','3:51PM'],
            'Harvard Square': ['7:39AM','8:09AM','8:24AM','8:39AM','8:54AM','9:09AM','9:24AM','9:39AM','9:54AM','10:09AM','10:24AM','10:39AM','10:54AM','11:09AM','11:24AM','11:39AM','-','12:09PM','-','12:39PM','12:54PM','1:09PM','1:24PM','1:39PM','1:54PM','2:09PM','2:24PM','2:39PM','2:54PM','3:09PM','3:24PM','-','3:54PM'],
            'Lamont Library': ['7:45AM','8:15AM','8:30AM','8:45AM','9:00AM','9:15AM','9:30AM','9:45AM','10:00AM','10:15AM','10:30AM','10:45AM','11:00AM','11:15AM','11:30AM','-','-','12:15PM','12:30PM','12:45PM','1:00PM','1:15PM','1:30PM','1:45PM','2:00PM','2:15PM','2:30PM','2:45PM','3:00PM','3:15PM','3:30PM','-','-'],
            '1 Western Ave':  ['7:52AM','8:22AM','8:35AM','8:52AM','9:05AM','9:22AM','9:35AM','9:52AM','10:05AM','10:22AM','10:35AM','10:52AM','11:05AM','11:22AM','11:35AM','-','-','12:35PM','-','12:52PM','1:05PM','1:22PM','1:35PM','1:52PM','2:05PM','2:22PM','2:35PM','2:52PM','3:05PM','3:15PM','3:35PM','-','-'],
        };

        // Quad Express — every 10 min 7:50 AM–3:50 PM with exceptions per official schedule
        // Quad times: no 1:30, no 4:00; 8:50→8:45, 11:00→10:55; every 20 min 12:00–1:00
        // Mass&Garden: Quad+3 min each
        // Memorial Hall: Quad+10 min each; no departures at 9:10, 1:20, 1:40, 3:50 (from Quad)
        const QX_quad = [
            '7:50AM','8:00AM','8:10AM','8:20AM','8:30AM','8:45AM',  // 8:50→8:45
            '9:00AM','9:10AM','9:20AM','9:30AM','9:40AM','9:50AM',
            '10:00AM','10:10AM','10:20AM','10:30AM','10:40AM','10:55AM', // 11:00→10:55
            '11:10AM','11:20AM','11:30AM','11:40AM','11:50AM',
            '12:00PM','12:20PM',                                    // every 20 min 12–1
            '1:00PM','1:10PM','1:20PM','1:40PM','1:50PM',           // no 1:30
            '2:00PM','2:10PM','2:20PM','2:30PM','2:40PM','2:50PM',
            '3:00PM','3:10PM','3:20PM','3:30PM','3:40PM','3:50PM',  // no 4:00
        ];
        // Mass and Garden = Quad + 3 min (3:40 PM run terminates here)
        const QX_mag = QX_quad.map((t, i) => {
            const m = toMinList([t])[0]; if (m === null) return '-';
            const nm = m + 3;
            const h = Math.floor(nm/60), mn = nm%60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `${h%12||12}:${String(mn).padStart(2,'0')}${ampm}`;
        });
        // Memorial Hall = Quad + 10 min; skip where Quad is 9:10, 1:20, 1:40, 3:40, 3:50
        const QX_mh_skip = new Set(['9:10AM','1:20PM','1:40PM','3:40PM','3:50PM']);
        const QX_mh = QX_quad.map(t => {
            if (QX_mh_skip.has(t)) return '-';
            const m = toMinList([t])[0]; if (m === null) return '-';
            const nm = m + 10;
            const h = Math.floor(nm/60), mn = nm%60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `${h%12||12}:${String(mn).padStart(2,'0')}${ampm}`;
        });
        const QX_times = {
            'Quad':           QX_quad,
            'Mass and Garden': QX_mag,
            'Memorial Hall':   QX_mh,
        };

        // Quad Yard Express — 4:20–7:50 PM (every 25 min, with Cambridge Common)
        //                      8:00 PM–12:20 AM (every 20 min, no Cambridge Common)
        //                      Exception: no 8:35 PM from Lamont (resumes 8:40 PM from Widener)
        const QYE_early = { // 4:20–7:50 PM, every 25 min
            'Quad':            ['4:20PM','4:45PM','5:10PM','5:35PM','6:00PM','6:25PM','6:50PM','7:15PM','7:40PM'],
            'Radcliffe Yard':  ['4:22PM','4:47PM','5:12PM','5:37PM','6:02PM','6:27PM','6:52PM','7:17PM','7:42PM'],
            'Mass and Garden': ['4:24PM','4:49PM','5:14PM','5:39PM','6:04PM','6:29PM','6:54PM','7:19PM','7:44PM'],
            'Lamont Library':  ['4:27PM','4:52PM','5:17PM','5:42PM','6:07PM','6:32PM','6:57PM','7:22PM','7:47PM'],
            'Widener Gate':    ['4:30PM','4:55PM','5:20PM','5:45PM','6:10PM','6:35PM','7:00PM','7:25PM','7:50PM'],
            'Cambridge Common':['4:33PM','4:58PM','5:23PM','5:48PM','6:13PM','6:38PM','7:03PM','7:28PM','7:53PM'],
        };
        const QYE_late = { // 8:00 PM–12:20 AM, every 20 min; no Cambridge Common; no 8:35 from Lamont
            'Quad':           ['8:00PM','8:20PM','8:40PM','9:00PM','9:20PM','9:40PM','10:00PM','10:20PM','10:40PM','11:00PM','11:20PM','11:40PM','12:00AM','12:20AM'],
            'Radcliffe Yard': ['8:02PM','8:22PM','8:42PM','9:02PM','9:22PM','9:42PM','10:02PM','10:22PM','10:42PM','11:02PM','11:22PM','11:42PM','12:02AM','-'],
            'Mass and Garden':['8:04PM','8:24PM','8:44PM','9:04PM','9:24PM','9:44PM','10:04PM','10:24PM','10:44PM','11:04PM','11:24PM','11:44PM','12:04AM','-'],
            'Lamont Library': ['8:07PM','-','8:47PM','9:07PM','9:27PM','9:47PM','10:07PM','10:27PM','10:47PM','11:07PM','11:27PM','11:47PM','12:07AM','-'],
            'Widener Gate':   ['8:10PM','8:40PM','8:50PM','9:10PM','9:30PM','9:50PM','10:10PM','10:30PM','10:50PM','11:10PM','11:30PM','11:50PM','12:10AM','-'],
        };

        // Crimson Cruiser (weekdays 4:30 PM – ~9 PM)
        // Route: Mather → Inn → Widener Gate → (Quad from 6:20) → (Mass&Garden from 6:20) → Law School → Maxwell Dworkin → Memorial Hall → Lamont
        const CC_times = {
            'Mather House':   ['4:30PM','4:55PM','5:20PM','5:50PM','6:20PM','7:00PM','7:40PM','8:20PM'],
            'The Inn':        ['4:32PM','4:57PM','5:22PM','5:52PM','6:22PM','7:02PM','7:42PM','8:22PM'],
            'Widener Gate':   ['4:35PM','5:00PM','5:30PM','6:00PM','6:30PM','7:10PM','7:50PM','8:25PM'],
            'Quad':           ['-','-','-','-','6:40PM','7:20PM','8:00PM','8:35PM'],
            'Mass and Garden':['-','-','-','-','6:43PM','7:23PM','8:03PM','8:38PM'],
            'Law School':     ['4:37PM','5:02PM','5:32PM','6:02PM','6:45PM','7:25PM','8:05PM','8:40PM'],
            'Maxwell Dworkin':['4:38PM','5:03PM','5:33PM','6:03PM','6:46PM','7:26PM','8:06PM','8:41PM'],
            'Memorial Hall':  ['4:45PM','5:10PM','5:40PM','6:10PM','6:50PM','7:30PM','8:10PM','8:45PM'],
            'Lamont Library': ['4:48PM','5:13PM','5:43PM','6:13PM','6:53PM','7:33PM','8:13PM','8:48PM'],
        };

        // Overnight (weekdays ~9 PM – 12:20 AM)
        // Route: Mather → Inn → Widener Gate → Quad → Mass&Garden → Law School → Maxwell Dworkin → Memorial Hall → Lamont → Winthrop
        const ON_times = {
            'Mather House':   ['8:55PM','9:20PM','9:40PM','10:00PM','10:20PM','10:40PM','11:00PM','11:20PM','11:40PM','12:00AM'],
            'The Inn':        ['8:57PM','9:27PM','9:47PM','10:07PM','10:27PM','10:47PM','11:07PM','11:27PM','11:47PM','12:07AM'],
            'Widener Gate':   ['9:00PM','9:30PM','9:50PM','10:10PM','10:30PM','10:50PM','11:10PM','11:30PM','11:50PM','12:10AM'],
            'Quad':           ['-','9:20PM','9:40PM','10:00PM','10:20PM','10:40PM','11:00PM','11:20PM','11:40PM','12:00AM'],
            'Mass and Garden':['-','9:23PM','9:43PM','10:03PM','10:23PM','10:43PM','11:03PM','11:23PM','11:43PM','12:03AM'],
            'Law School':     ['-','9:25PM','9:45PM','10:05PM','10:25PM','10:45PM','11:05PM','11:25PM','11:45PM','12:05AM'],
            'Maxwell Dworkin':['-','9:26PM','9:46PM','10:06PM','10:26PM','10:46PM','11:06PM','11:26PM','11:46PM','12:06AM'],
            'Memorial Hall':  ['9:05PM','9:30PM','9:50PM','10:10PM','10:30PM','10:50PM','11:10PM','11:30PM','11:50PM','12:10AM'],
            'Lamont Library': ['9:08PM','9:33PM','9:53PM','10:13PM','10:33PM','10:53PM','11:13PM','11:33PM','11:53PM','12:13AM'],
            'Winthrop House': ['9:17PM','9:37PM','9:57PM','10:17PM','10:37PM','10:57PM','11:17PM','11:37PM','11:57PM','-'],
        };

        // Extended Overnight — daily 12:42 AM–3:45 AM; Fri/Sat also 3:55–4:50 AM
        const EO_base = {
            'The Inn':        ['12:42AM'],
            'Widener Gate':   ['12:45AM'],
            'Quad':           ['12:50AM','1:25AM','2:00AM','2:35AM','3:10AM','3:45AM'],
            'Mass and Garden':['12:52AM','1:27AM','2:02AM','2:37AM','3:12AM','3:47AM'],
            'Law School':     ['12:53AM','1:28AM','2:03AM','2:38AM','3:13AM','-'],
            'Memorial Hall':  ['1:00AM','1:35AM','2:10AM','2:45AM','3:20AM','-'],
            'Lamont Library': ['1:03AM','1:38AM','2:13AM','2:48AM','3:23AM','-'],
            'Winthrop House': ['1:07AM','1:42AM','2:17AM','2:52AM','3:27AM','-'],
            'Mather House':   ['1:10AM','1:45AM','2:20AM','2:55AM','3:30AM','-'],
        };
        const EO_frisat = {
            'Memorial Hall':  ['3:55AM','4:30AM'],
            'Lamont Library': ['3:58AM','4:33AM'],
            'Winthrop House': ['4:02AM','4:37AM'],
            'Mather House':   ['4:05AM','4:40AM'],
            'The Inn':        ['4:12AM','4:47AM'],
            'Widener Gate':   ['4:15AM','4:50AM'],
            'Quad':           ['4:20AM','-'],
            'Mass and Garden':['4:22AM','-'],
            'Law School':     ['4:23AM','-'],
        };
        // 1636'er (weekends)
        const ER_times = {
            'Quad':             ['-','-','4:30PM','4:50PM','5:10PM','5:30PM','5:50PM','6:10PM','6:30PM','6:50PM','7:10PM','7:30PM','7:50PM','8:10PM','-','-','8:45PM','9:05PM','9:25PM','9:45PM','10:05PM','10:25PM','10:45PM','11:05PM','11:25PM','11:45PM','12:10PM','12:25PM'],
            'Mass and Garden':  ['-','-','4:33PM','4:53PM','5:13PM','5:33PM','5:53PM','6:13PM','6:33PM','6:53PM','7:13PM','7:33PM','7:53PM','8:13PM','-','-','8:48PM','9:08PM','9:28PM','9:48PM','10:08PM','10:28PM','10:48PM','11:08PM','11:28PM','11:48PM','-','-'],
            'Law School':       ['-','-','4:35PM','4:55PM','5:15PM','5:35PM','5:55PM','6:15PM','6:35PM','6:55PM','7:15PM','7:35PM','-','-','-','-','8:50PM','9:10PM','9:30PM','9:50PM','10:10PM','10:30PM','10:50PM','11:10PM','11:30PM','11:50PM','-','-'],
            'Maxwell Dworkin':  ['-','-','4:36PM','4:56PM','5:16PM','5:36PM','5:56PM','6:16PM','6:36PM','6:56PM','7:16PM','7:36PM','-','-','-','-','8:51PM','9:11PM','9:31PM','9:51PM','10:11PM','10:31PM','10:51PM','11:11PM','11:31PM','11:51PM','-','-'],
            'Memorial Hall':    ['-','-','4:40PM','5:00PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','7:20PM','7:40PM','-','-','-','-','8:55PM','9:15PM','9:35PM','9:55PM','10:15PM','10:35PM','10:55PM','11:15PM','11:35PM','11:55PM','-','-'],
            'Lamont Library':   ['-','-','4:43PM','5:03PM','5:23PM','5:43PM','6:03PM','6:23PM','6:43PM','7:03PM','7:23PM','7:43PM','-','-','-','-','8:58PM','9:18PM','9:38PM','9:58PM','10:18PM','10:38PM','10:58PM','11:18PM','11:38PM','11:58PM','-','-'],
            'Mather House':     ['-','-','4:50PM','5:10PM','5:30PM','5:50PM','6:10PM','6:30PM','6:50PM','7:10PM','7:30PM','7:50PM','-','-','8:32PM','8:52PM','9:05PM','9:25PM','9:45PM','10:05PM','10:25PM','10:45PM','11:05PM','11:25PM','11:45PM','12:05AM','-','-'],
            'The Inn':          ['-','-','4:57PM','5:17PM','5:37PM','5:57PM','6:17PM','6:37PM','6:57PM','7:17PM','7:37PM','7:57PM','-','-','8:32PM','8:52PM','9:12PM','9:32PM','9:52PM','10:12PM','10:32PM','10:52PM','11:12PM','11:32PM','11:52PM','12:12AM','-','-'],
            'Widener Gate':     ['4:20PM','4:40PM','5:00PM','5:20PM','5:40PM','6:00PM','6:20PM','6:40PM','7:00PM','7:20PM','7:40PM','8:00PM','-','-','8:35PM','8:55PM','9:15PM','9:35PM','9:55PM','10:15PM','10:35PM','10:55PM','11:15PM','11:35PM','11:55PM','12:15AM','-','-'],
            'Cambridge Common': ['4:25PM','4:45PM','5:05PM','5:25PM','5:45PM','6:05PM','6:25PM','6:45PM','7:05PM','7:25PM','7:45PM','8:05PM','-','-','-','-','-','-','-','-','-','-','-','-','-','-','-','-'],
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
        for (const [stopName, coords] of Object.entries(STOPS)) {
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

    updateMapMarkers() {
        if (!this.map) return;

        // Remove existing markers
        this.shuttleMarkers.forEach(m => m.remove());
        this.shuttleMarkers = [];

        if (!this.realtimeData || !this.realtimeData.vehicles) {
            this.updateRouteTogglePanel();
            return;
        }

        // Same explicit map used in drawRouteLines
        const apiNameMap = {
            'Allston Loop':          'AL',
            'Overnight':             'ON',
            'Quad Express':          'QE',
            'Mather Express':        'ME',
            'Quad SEC Direct':       'QSEC',
            'Quad Yard Express':     'QYE',
            'Quad Stadium Express':  'QSD',
            "1636'er":               '1636',
            'Crimson Cruiser':       'CC',
            'SEC Express':           'SE',
        };

        this.realtimeData.vehicles.forEach(vehicle => {
            const lat = parseFloat(vehicle.latitude);
            const lng = parseFloat(vehicle.longitude);
            if (!lat || !lng) return;

            const apiRouteName = vehicle.route || '';
            const mappedShort = apiNameMap[apiRouteName];
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
            const apiNameMap = {
                'Allston Loop': 'AL', 'Overnight': 'ON', 'Quad Express': 'QE',
                'Mather Express': 'ME', 'Quad SEC Direct': 'QSEC', 'Quad Yard Express': 'QYE',
                'Quad Stadium Express': 'QSD', "1636'er": '1636', 'Crimson Cruiser': 'CC', 'SEC Express': 'SE',
            };
            const hasLive = this.realtimeData.vehicles.some(v => apiNameMap[v.route] === route.shortName);
            if (hasLive) return 'running';
        }

        return staticStatus;
    }
    
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
    
    getVehiclesForRoute(route) {
        if (!this.realtimeData || !this.realtimeData.vehicles) return [];
        const apiNameMap = {
            'Allston Loop': 'AL', 'Overnight': 'ON', 'Quad Express': 'QE',
            'Mather Express': 'ME', 'Quad SEC Direct': 'QSEC', 'Quad Yard Express': 'QYE',
            'Quad Stadium Express': 'QSD', "1636'er": '1636', 'Crimson Cruiser': 'CC', 'SEC Express': 'SE',
        };
        return this.realtimeData.vehicles.filter(v => apiNameMap[v.route] === route.shortName);
    }

    getNearestStop(lat, lng) {
        const STOPS = {
            'Mather House':[-71.115333,42.368759],'The Inn':[-71.115427,42.372127],
            'Widener Gate':[-71.116972,42.372844],'Memorial Hall':[-71.114393,42.376452],
            'Lamont Library':[-71.115007,42.372867],'Quad':[-71.125325,42.381867],
            'Radcliffe Yard':[-71.122120,42.376500],'Mass and Garden':[-71.119467,42.375187],
            'Law School':[-71.119937,42.377977],'Maxwell Dworkin':[-71.116630,42.378933],
            'Winthrop House':[-71.117267,42.371468],'SEC':[-71.125393,42.363329],
            "Barry's Corner":[-71.127742,42.363958],'Stadium':[-71.124887,42.367121],
            'Kennedy School':[-71.120953,42.371496],'Harvard Square':[-71.119967,42.372727],
            '1 Western Ave':[-71.119075,42.364114],'Science Center':[-71.115974,42.376902],
            'Cambridge Common':[-71.122418,42.376995],
        };
        let nearest = null, minDist = Infinity;
        for (const [name, [sLng, sLat]] of Object.entries(STOPS)) {
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
    
    getStatusInfo(status) {
        const statusMap = {
            'running': { icon: '🚌', text: 'Running' },
            'late': { icon: '⚠️', text: 'Delayed' },
            'not-running': { icon: '⏸️', text: 'Not Running' }
        };
        return statusMap[status] || statusMap['not-running'];
    }
    
    selectRoute(routeId) {
        // Navigate to schedule tab and highlight the route
        showView('schedule');
        setTimeout(() => {
            const el = document.getElementById(`sched-${routeId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

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

// Global functions
function selectRoute(routeId) {
    tracker.selectRoute(routeId);
}

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

function toggleDropdown() {
    document.getElementById('inactive-dropdown').classList.toggle('open');
}

// Initialize app
const tracker = new ShuttleTracker();
