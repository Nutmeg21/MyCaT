const mongoose = require('mongoose');
// 1. Import 'Event' instead of 'Exam'
const { connectDB, Event, Student, AttendanceLog } = require('./database').default;

const seedData = async () => {
    await connectDB();

    console.log("Cleaning Database...");
    // 2. Use Event.deleteMany
    await Event.deleteMany({});
    await Student.deleteMany({});
    await AttendanceLog.deleteMany({});

    console.log("Creating Preset Events...");

    // --- EVENT 1 ---
    // 3. Use Event.create
    const event1 = await Event.create({
        eventId: "EVT_001", // Changed ID prefix
        title: "Calculus Final 101",
        venueBSSID: "ESP32_HALL_A", 
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000 * 3) 
    });

    // --- EVENT 2 ---
    const event2 = await Event.create({
        eventId: "RELIEF_001",
        title: "Flood Relief Center: KL",
        venueBSSID: "ESP32_TENT_1", 
        startTime: new Date(),
        endTime: new Date(Date.now() + 86400000) 
    });

    console.log("Creating Fake Students...");

    // Students
    await Student.create([
        {
            myKadUID: "A1B2C3D4", 
            name: "Ali bin Abu",
            officialPhotoPath: "https://randomuser.me/api/portraits/men/32.jpg",
            allowedExamVenueBSSID: "ESP32_HALL_A",
            currentExamStatus: "OUT"
        },
        {
            myKadUID: "E5F6G7H8", 
            name: "Siti Sarah",
            officialPhotoPath: "https://randomuser.me/api/portraits/women/44.jpg",
            allowedExamVenueBSSID: "ESP32_HALL_A",
            currentExamStatus: "OUT"
        }
    ]);

    // Victims
    await Student.create([
        {
            myKadUID: "11223344", 
            name: "John Doe (Victim)",
            officialPhotoPath: "https://randomuser.me/api/portraits/men/11.jpg",
            allowedExamVenueBSSID: "ESP32_TENT_1",
            currentExamStatus: "OUT"
        }
    ]);

    console.log("Database Seeded Successfully!");
    process.exit();
};

seedData();