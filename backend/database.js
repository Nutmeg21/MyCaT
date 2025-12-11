const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/mycat');
        console.log('MongoDB Connected!');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

// 1. RENAME "ExamSchema" to "EventSchema"
const EventSchema = new mongoose.Schema({
    eventId: String, // Changed from examId
    title: String,
    venueBSSID: String,
    startTime: Date,
    endTime: Date
});

const StudentSchema = new mongoose.Schema({
    myKadUID: { type: String, unique: true },
    name: String,
    officialPhotoPath: String,
    allowedExamVenueBSSID: String,
    currentExamStatus: { type: String, default: 'OUT' }
});

const AttendanceLogSchema = new mongoose.Schema({
    myKadUID: String,
    status: String,
    reason: String, // <--- ADD THIS LINE
    tappedVenueBSSID: String,
    timestamp: { type: Date, default: Date.now }
});
// 2. EXPORT AS "Event"
const Event = mongoose.model('Event', EventSchema); // Mongoose will create 'events' collection
const Student = mongoose.model('Student', StudentSchema);
const AttendanceLog = mongoose.model('AttendanceLog', AttendanceLogSchema);

exports.default = { connectDB, Event, Student, AttendanceLog };