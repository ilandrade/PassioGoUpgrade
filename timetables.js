// --- Constants ---------------------------------------------------------------

// Maps PassioGo API route names → our internal shortName identifiers.
const API_NAME_MAP = {
    'Allston Loop':         'AL',
    'Overnight':            'ON',
    'Quad Express':         'QE',
    'Mather Express':       'ME',
    'Quad SEC Direct':      'QSEC',
    'Quad Yard Express':    'QYE',
    'Quad Stadium Express': 'QSD',
    "1636'er":              '1636',
    'Crimson Cruiser':      'CC',
    'SEC Express':          'SE',
};

// GPS coordinates for each named bus stop on campus.
const STOP_COORDS = {
    'Mather House':                [-71.115333, 42.368759],
    'The Inn':                     [-71.115427, 42.372127],
    'Widener Gate':                [-71.116972, 42.372844],
    'Memorial Hall':               [-71.114393, 42.376452],
    'Lamont Library':              [-71.115007, 42.372867],
    'Quad':                        [-71.125325, 42.381867],
    'Radcliffe Yard':              [-71.122120, 42.376500],
    'Mass and Garden':             [-71.119467, 42.375187],
    'Law School':                  [-71.119937, 42.377977],
    'Maxwell Dworkin':             [-71.116630, 42.378933],
    'Winthrop House':              [-71.117267, 42.371468],
    'SEC':                         [-71.125393, 42.363329],
    "Barry's Corner":              [-71.127742, 42.363958],
    'Stadium':                     [-71.124887, 42.367121],
    'Kennedy School':              [-71.120953, 42.371496],
    'Harvard Square':              [-71.119967, 42.372727],
    'Harvard Square (Southbound)': [-71.119734, 42.373379],
    'Kennedy School (Southbound)': [-71.121339, 42.371203],
    'Stadium (Southbound)':        [-71.125015, 42.367024],
    "Barry's Corner (Southbound)": [-71.127862, 42.363936],
    '1 Western Ave':               [-71.119075, 42.364114],
    'Science Center':              [-71.115974, 42.376902],
    'Leverett House':              [-71.116713, 42.370084],
    'Cambridge Common':            [-71.122418, 42.376995],
};

// --- Timetable Utilities -----------------------------------------------------

// Converts a schedule time string array to minutes-since-midnight.
// Handles bare times (no AM/PM) by inferring the half-day from context.
function toMinList(times) {
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
        if (!hasPM && !hasAM && !isPM) {
            if (h === 12 && lastH >= 10) isPM = true;
            else if (h < lastH && lastH >= 11) isPM = true;
            else if (isPM && h < lastH && h !== 12) isPM = true;
        }
        let h24 = h;
        if (isPM && h !== 12) h24 = h + 12;
        if (!isPM && h === 12) h24 = 0;
        lastH = h;
        return h24 * 60 + m;
    });
}

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