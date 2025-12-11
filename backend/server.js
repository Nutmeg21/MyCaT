// backend/server.js
const express = require('express');
const cors = require('cors'); // Ensure you have installed this: npm install cors
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { connectDB, Student, AttendanceLog, Event } = require('./database').default;

const app = express();
const PORT = 3000;

// !!! REPLACE WITH YOUR LAPTOP IP !!!
const YOUR_LOCAL_IP = '192.168.0.94'; 
const SERVER_URL = `http://${YOUR_LOCAL_IP}:${PORT}`; 

// --- Initial Setup & Middleware ---
console.log(`\n*** MyCat Server URL for Clients: ${SERVER_URL} ***\n`);

app.use(cors()); // <--- CRITICAL: Allows Phone to talk to Laptop
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

const UPLOAD_DIR = path.join(__dirname, 'live_scans');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const upload = multer({ dest: UPLOAD_DIR }); 

// ==================================================
// SECTION 1: EVENT MANAGEMENT (Missing in your code)
// ==================================================

// 1. GET Events (For Home Screen)
app.get('/api/events', async (req, res) => {
    try {
        // Sort by newest created
        const events = await Event.find().sort({ _id: -1 }); 
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. CREATE EVENT (For Builder Screen)
app.post('/api/events', async (req, res) => {
    console.log("Received POST /api/events"); // Debug Log
    try {
        const { title, venueBSSID, students } = req.body;
        
        if (!title || !venueBSSID || !students) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Create the Event Record
        await Event.create({
            eventId: `EVENT_${Date.now()}`,
            venueBSSID,
            title,
            startTime: new Date(),
            endTime: new Date(Date.now() + 86400000) // Default 24 hours
        });

        // Register Students
        let count = 0;
        for (const s of students) {
            await Student.findOneAndUpdate(
                { myKadUID: s.uid },
                { 
                    name: s.name, 
                    myKadUID: s.uid,
                    officialPhotoPath: "https://via.placeholder.com/150", 
                    allowedEventVenueBSSID: venueBSSID,
                    currentEventStatus: 'OUT'
                },
                { upsert: true, new: true }
            );
            count++;
        }
        
        console.log(`Event '${title}' created with ${count} students.`);
        res.json({ success: true, count });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ==================================================
// SECTION 2: ATTENDANCE LOGIC (Your Existing Logic)
// ==================================================

const SCAN_COOLDOWN_MS = 15000;
let lastScanTime = {};

function isRecentlyScanned(myKadUID) {
    const currentTime = Date.now();
    const lastScan = lastScanTime[myKadUID] || 0;
    return (currentTime - lastScan < SCAN_COOLDOWN_MS);
}

// --- REPLACE THIS FUNCTION IN BACKEND/SERVER.JS ---

async function processAttendance(myKadUID, currentBSSID, isImageRequired, tempPath = null) {
    let status = "VERIFIED"; 
    let reason = "Access Granted"; 
    let tapType = 'DENIED';
    let finalFileName = null;
    let student = null;
    const timestamp = Date.now();
    
    // 1. HARDWARE CHECK
    if (!myKadUID || !currentBSSID) { 
        status = "DENIED"; reason = "Read Error";
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return { status, reason, tapType, myKadUID, tappedVenueBSSID: currentBSSID, timestamp };
    }

    try {
        // 2. ANTI-CHEAT (Double Scan)
        if (isRecentlyScanned(myKadUID)) {
            status = "DENIED"; reason = "Double Scan Detected";
            console.log(`[DENIED] Double Scan: ${myKadUID}`);
            return { status, reason, tapType: 'DENIED', myKadUID, tappedVenueBSSID: currentBSSID, timestamp };
        }

        // 3. STUDENT CHECK (Unregistered?)
        // We check this FIRST so unknown cards get the correct error
        student = await Student.findOne({ myKadUID }); 
        if (!student) {
            status = "DENIED"; reason = "Unregistered Card";
            console.log(`[DENIED] Unregistered Card: ${myKadUID}`);
        } 
        
        // 4. EVENT CHECK (Only if student is valid so far)
        else {
            // FIND FIX: Look for an event at this location that is ACTIVE (End time is in the future)
            // NEW LOGIC: Get the absolute newest event created for this gate
            const event = await Event.findOne({ venueBSSID: currentBSSID })
                .sort({ _id: -1 }); // -1 means "Descending Order" (Newest First)
            const now = new Date();

            if (!event) {
                status = "DENIED"; reason = "No Event at this Gate";
                console.log(`[DENIED] No Event at: ${currentBSSID}`);
            } 
            // 5. TIME CHECK (Is Event Active?)
            else {
                const start = new Date(event.startTime);
                const end = new Date(event.endTime);

                // DEBUG LOGGING (Check your terminal for this!)
                console.log(`Time Check -> Now: ${now.toLocaleTimeString()} | End: ${end.toLocaleTimeString()}`);

                if (now < start) {
                    status = "DENIED"; reason = "Event Not Started";
                } 
                else if (now > end) {
                    status = "DENIED"; reason = "Event Ended";
                } 
                // 6. LOCATION CHECK (Wrong Hall?)
                else if (currentBSSID !== student.allowedExamVenueBSSID) {
                    status = "DENIED"; reason = "Wrong Hall";
                    console.log(`[DENIED] Wrong Hall. Student assigned to: ${student.allowedExamVenueBSSID}`);
                }
                else {
                    // --- SUCCESS ---
                    if (student.currentExamStatus === 'OUT') {
                        tapType = 'ENTRY';
                        await Student.updateOne({ myKadUID }, { currentExamStatus: 'IN' });
                    } else { 
                        tapType = 'EXIT';
                        await Student.updateOne({ myKadUID }, { currentExamStatus: 'OUT' });
                    }
                    console.log(`[SUCCESS] Access Granted for ${student.name}`);
                }
            }
        }
        
        // Save Image (Only if Verified)
        if (status === "VERIFIED" && isImageRequired) {
            finalFileName = `${myKadUID}_${timestamp}.jpg`;
            const finalPath = path.join(UPLOAD_DIR, finalFileName);
            fs.renameSync(tempPath, finalPath); 
            lastScanTime[myKadUID] = timestamp; 
        } else if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        return { 
            status, reason, 
            tapType: status === 'DENIED' ? 'DENIED' : tapType,
            finalFileName, myKadUID, tappedVenueBSSID: currentBSSID, timestamp 
        };

    } catch (error) {
        console.error("Logic Error:", error);
        return { status: 'ERROR', reason: error.message, tapType: 'DENIED', myKadUID, timestamp };
    }
}

// ==================================================
// SECTION 3: SCANNING ENDPOINTS
// ==================================================

app.post('/api/attendance_check', upload.single('image'), async (req, res) => {
    const { uid, current_bssid } = req.body;
    const tempPath = req.file ? req.file.path : null; 
    
    const result = await processAttendance(uid, current_bssid, true, tempPath);
    
    await AttendanceLog.create({
        myKadUID: result.myKadUID || 'UNKNOWN',
        status: result.status,
        reason: result.reason, // <--- ADD THIS LINE (Save to DB)
        tappedVenueBSSID: result.tappedVenueBSSID,
        timestamp: new Date(result.timestamp)
});

    return res.json({ status: result.status, message: result.reason });
});

app.post('/api/gate_detection', async (req, res) => {
    const { uid, gate_id } = req.body;
    const result = await processAttendance(uid, gate_id, false, null);
    
    await AttendanceLog.create({
        myKadUID: result.myKadUID || 'UNKNOWN',
        status: result.status, reason: result.reason,
        tappedVenueBSSID: result.tappedVenueBSSID, tapType: result.tapType,
        timestamp: new Date(result.timestamp)
    });

    return res.json({ status: result.status, message: result.reason });
});

// ==================================================
// SECTION 4: APP POLLING (Scanner Screen)
// ==================================================

// Modified to return SINGLE OBJECT for App Scanner
app.get('/api/attendance/latest', async (req, res) => {
    try {
        const { gate_id } = req.query; // Get gate_id from URL
        
        // Find logs ONLY for this specific gate
        const query = gate_id ? { tappedVenueBSSID: gate_id } : {};
        
        const logs = await AttendanceLog.find(query).sort({ timestamp: -1 }).limit(1);
        
        if (logs.length === 0) return res.json(null);

        // ... rest of your code ...

        const log = logs[0];
        const student = await Student.findOne({ myKadUID: log.myKadUID });
        const event = await Event.findOne({ venueBSSID: log.tappedVenueBSSID });
        
        // This structure matches what ScannerScreen.js expects
        res.json({
            uid: log.myKadUID,
            name: student ? student.name : 'Unknown',
            photo_url: student ? student.officialPhotoPath : null,
            status: log.status,
            reason: log.reason, // <--- ADD THIS LINE (Send to Phone)
            timestamp: log.timestamp
        });

    } catch (err) {
        res.status(500).json({ message: "Failed to fetch log." });
    }
});

// Static Files & Start
app.use('/live_scans', express.static(UPLOAD_DIR));
app.use('/official_photos', express.static(path.join(__dirname, 'official_photos')));

connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n=== SERVER IS LIVE ===`);
        console.log(`- Builder POST: ${SERVER_URL}/api/events`);
        console.log(`- Scanner GET:  ${SERVER_URL}/api/attendance/latest`);
        console.log(`======================\n`);
    });
});