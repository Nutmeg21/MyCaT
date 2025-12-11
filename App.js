import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
    StyleSheet, View, Text, TouchableOpacity, ScrollView, 
    Platform, StatusBar, ActivityIndicator, Alert, TextInput, RefreshControl, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Audio } from 'expo-av'; 
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy'; // SDK 52 uses standard import now
import Papa from 'papaparse';

// --- 1. CONFIGURATION ---
const API_URL = 'http://192.168.0.94:3000'; // <--- CHECK YOUR IP

// --- 2. THEMES ---
const lightTheme = {
    brandPrimary: '#00A3CC', headerAccent: '#406899', success: '#40C38A',
    failure: '#FF8C94', warning: '#FFC857', closed: '#9AA0A6',
    text: '#334155', background: '#FFFFFF', surface: '#F9F9FB',
    shadowColor: 'rgba(0, 0, 0, 0.1)', inputBorder: '#E9ECF1',
};
const darkTheme = {
    brandPrimary: '#007799', headerAccent: '#2A4561', success: '#2E9670',
    failure: '#CC6970', warning: '#FFB84C', closed: '#888888',
    text: '#E0E0E0', background: '#181818', surface: '#2C2C2C',
    shadowColor: 'rgba(0, 0, 0, 0.7)', inputBorder: '#444444',
};

const getStyle = (isDark) => isDark ? darkTheme : lightTheme;

export default function App() {
    const [view, setView] = useState('homepage');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [currentEvent, setCurrentEvent] = useState(null);
    const [eventsData, setEventsData] = useState([]); 
    const [loadingEvents, setLoadingEvents] = useState(false);
    const theme = useMemo(() => getStyle(isDarkMode), [isDarkMode]);

    // --- SOUNDS ---
    const [successSound, setSuccessSound] = useState();
    const [failureSound, setFailureSound] = useState();

    useEffect(() => {
        async function loadSounds() {
            try {
                const s = await Audio.Sound.createAsync({ uri: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_34d193ed7b.mp3?filename=success-1-6297.mp3' });
                const f = await Audio.Sound.createAsync({ uri: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_03d2e1b191.mp3?filename=error-4-88742.mp3' });
                setSuccessSound(s.sound);
                setFailureSound(f.sound);
            } catch (e) { console.log("Sound Error", e); }
        }
        loadSounds();
        return () => { successSound?.unloadAsync(); failureSound?.unloadAsync(); };
    }, []);

    const playSound = async (type) => {
        try {
            if (type === 'success' && successSound) await successSound.replayAsync();
            else if (type === 'failure' && failureSound) await failureSound.replayAsync();
        } catch (error) { console.log("Play Error", error); }
    };

    // --- API ---
    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const response = await fetch(`${API_URL}/api/events`);
            const data = await response.json();
            const mapped = data.map(e => ({
                id: e.venueBSSID, dbId: e._id, name: e.title, location: e.venueBSSID,
            }));
            setEventsData(mapped);
        } catch (error) { Alert.alert("Error", "Could not connect to Server"); } 
        finally { setLoadingEvents(false); }
    };

    useEffect(() => { fetchEvents(); }, []);

    // --- SUB-COMPONENTS ---
    const Header = ({ title, backAction }) => (
        <View style={[styles.header, { backgroundColor: theme.headerAccent }]}> 
            <View style={styles.headerLeft}>
                {backAction && (
                    <TouchableOpacity onPress={backAction} style={{ marginRight: 15 }}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                )}
                <Text style={styles.appName}>{title}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={styles.modeToggleBtn}>
                <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={24} color="white" />
            </TouchableOpacity>
        </View>
    );

    // --- SCANNER PAGE (AUTO-SYNC & REASON DISPLAY) ---
    // --- SCANNER PAGE (PRIVACY FOCUSED & AUTO-RESET) ---
    const ScannerPage = () => {
        const [permission, requestPermission] = useCameraPermissions();
        
        const [scanResult, setScanResult] = useState(null);
        const [matchDetails, setMatchDetails] = useState(null);
        const [verified, setVerified] = useState(false);
        
        // Internal Tracking
        const lastSeenTimestamp = useRef(Date.now());
        const resetTimer = useRef(null);

        useEffect(() => { if (!permission?.granted) requestPermission(); }, [permission]);

        // Reset on Event Change
        useEffect(() => {
            lastSeenTimestamp.current = Date.now(); 
            setScanResult(null);
            setMatchDetails(null);
            setVerified(false);
        }, [currentEvent]);

        // Auto-Polling
        useEffect(() => {
            const interval = setInterval(() => checkServerSilent(), 1000); 
            return () => {
                clearInterval(interval);
                if (resetTimer.current) clearTimeout(resetTimer.current);
            };
        }, [currentEvent]); 

        const checkServerSilent = async () => {
            try {
                const gateId = currentEvent.location; 
                const response = await fetch(`${API_URL}/api/attendance/latest?gate_id=${gateId}`);
                if (!response.ok) return;
                
                const data = await response.json();
                if (!data) return; 

                const scanTime = new Date(data.timestamp).getTime();
                
                if (scanTime > lastSeenTimestamp.current) {
                    lastSeenTimestamp.current = scanTime; 
                    if (resetTimer.current) clearTimeout(resetTimer.current);

                    // Format Time (e.g., "10:45 AM")
                    const timeString = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const rawPhoto = data.photo_url;
                    const finalPhotoUrl = rawPhoto && rawPhoto.startsWith('http') ? rawPhoto : `${API_URL}${rawPhoto}`;

                    setMatchDetails({
                        name: data.name, 
                        uid: data.uid, 
                        photoUrl: finalPhotoUrl, 
                        status: data.status,
                        checkInTime: timeString // <--- Added Time Here
                    });
                    
                    if(data.status === 'VERIFIED') {
                        setScanResult({ type: 'warning', message: 'ID Valid. Aligning Face...' });
                        setVerified(false);

                        setTimeout(() => {
                            setScanResult({ type: 'success', message: '✅ FACE VERIFIED' });
                            setVerified(true);
                            playSound('success');
                        }, 1000);

                    } else {
                        const reasonText = data.reason ? data.reason : data.status;
                        setScanResult({ type: 'failure', message: `ACCESS DENIED:\n${reasonText}` });
                        playSound('failure');
                        setVerified(false);
                    }

                    resetTimer.current = setTimeout(() => {
                        setScanResult(null);
                        setMatchDetails(null);
                        setVerified(false);
                        lastSeenTimestamp.current = Date.now(); 
                    }, 5000);
                }
            } catch (err) {}
        };

        if (!permission?.granted) return <View style={styles.center}><Text>Camera Access Required</Text></View>;

        // --- VISIBILITY LOGIC ---
        // Only show details if Success OR Warning (Processing). Hide on Failure.
        const showDetails = scanResult?.type === 'success' || scanResult?.type === 'warning';
        
        const frameColor = verified ? theme.success : (scanResult?.type === 'failure' ? theme.failure : 'white');

        return (
            <ScrollView style={[styles.mainContent, { backgroundColor: theme.background }]}>
                
                {/* SIDE BY SIDE VIEW */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, height: 220}}>
                    
                    {/* LIVE CAMERA */}
                    <View style={{flex: 1, marginRight: 5, borderRadius: 15, overflow: 'hidden', borderWidth: 3, borderColor: frameColor}}>
                        <CameraView style={{flex: 1}} facing={'front'} />
                        <View style={{...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center'}}>
                            <View style={{width: 100, height: 140, borderWidth: 2, borderColor: frameColor, borderStyle: 'dashed', borderRadius: 20, opacity: 0.7}} />
                        </View>
                        <View style={{position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 4}}>
                            <Text style={{color: verified ? theme.success : 'white', fontWeight: 'bold', fontSize: 12}}>
                                {verified ? "FACE MATCHED" : (scanResult ? "PROCESSING..." : "READY TO SCAN")}
                            </Text>
                        </View>
                    </View>

                    {/* DB RECORD (HIDDEN UNTIL VERIFIED) */}
                    <View style={{flex: 1, marginLeft: 5, borderRadius: 15, overflow: 'hidden', borderWidth: 2, borderColor: theme.inputBorder, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center'}}>
                        {showDetails && matchDetails?.photoUrl ? (
                            <Image source={{ uri: matchDetails.photoUrl }} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
                        ) : (
                            // Placeholder when hidden/denied
                            <View style={{alignItems: 'center'}}>
                                <FontAwesome5 name="user-lock" size={50} color="#ccc" />
                                <Text style={{color: '#999', fontSize: 12, marginTop: 10}}>
                                    {scanResult?.type === 'failure' ? "ACCESS DENIED" : "WAITING..."}
                                </Text>
                            </View>
                        )}
                        
                        {showDetails && (
                            <View style={{position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', backgroundColor: theme.brandPrimary, padding: 4}}>
                                <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>VERIFIED</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* STATUS BOX */}
                <View style={[styles.resultBox, { 
                    borderColor: scanResult?.type === 'success' ? theme.success : (scanResult?.type === 'failure' ? theme.failure : theme.inputBorder),
                    backgroundColor: scanResult?.type === 'success' ? theme.success + '15' : (scanResult?.type === 'failure' ? theme.failure + '15' : 'transparent'),
                    opacity: scanResult ? 1 : 0.5
                }]}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: theme.text, textAlign: 'center' }}>
                        {scanResult ? scanResult.message : 'Ready for next student...'}
                    </Text>
                </View>

                {/* USER DATA BOX (ONLY SHOW WHEN VERIFIED) */}
                {showDetails && matchDetails && (
                    <View style={styles.userDataBox}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                            <Text style={{fontWeight:'bold', fontSize: 18, color: theme.text}}>{matchDetails.name}</Text>
                            <View style={{backgroundColor: theme.success, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4}}>
                                <Text style={{color:'white', fontWeight:'bold', fontSize: 10}}>IN</Text>
                            </View>
                        </View>
                        
                        <Text style={[styles.dataRow, { color: theme.text }]}>
                            <Text style={styles.dataLabel}>ID:</Text> {matchDetails.uid}
                        </Text>
                        <Text style={[styles.dataRow, { color: theme.text }]}>
                            <Text style={styles.dataLabel}>TIME:</Text> {matchDetails.checkInTime}
                        </Text>
                        <Text style={[styles.dataRow, { color: theme.text }]}>
                            <Text style={styles.dataLabel}>GATE:</Text> {currentEvent.location}
                        </Text>
                    </View>
                )}

                <View style={{alignItems: 'center', marginTop: 10}}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success, marginRight: 6}} />
                        <Text style={{color: '#888', fontSize: 12}}>Live Connection: {currentEvent.location}</Text>
                    </View>
                </View>

            </ScrollView>
        );
    };

    // --- EVENT BUILDER ---
    const EventBuilderPage = () => {
        const [name, setName] = useState('');
        const [loc, setLoc] = useState('');
        const [csv, setCsv] = useState(null);
        const [creating, setCreating] = useState(false);

        const handleCsvImport = async () => {
            try {
                // 1. Pick the file (Allowing all text types helps find CSVs)
                const res = await DocumentPicker.getDocumentAsync({ 
                    type: ['text/*', 'application/vnd.ms-excel', 'text/csv'], // Broad types to fix grayed out files
                    copyToCacheDirectory: true 
                });
                
                if (res.canceled) return;
                
                const file = res.assets[0];
                console.log("File picked:", file.uri); // Debug log

                // 2. Read the file content
                const content = await FileSystem.readAsStringAsync(file.uri, {
                    encoding: FileSystem.EncodingType.UTF8
                });

                // 3. Parse CSV
                const parsed = Papa.parse(content, { 
                    header: true, 
                    skipEmptyLines: true,
                    transformHeader: h => h.trim().toLowerCase() // Fix case sensitivity (UID vs uid)
                });

                // 4. Validate Data
                // We look for 'uid' and 'name' columns, regardless of capitalization
                const rows = parsed.data
                    .filter(r => r.uid && r.name)
                    .map(r => ({ 
                        uid: r.uid.trim(), 
                        name: r.name.trim() 
                    }));
                
                if (rows.length > 0) { 
                    setCsv(rows); 
                    Alert.alert("Success", `Loaded ${rows.length} students.\n(Ready to Create Event)`); 
                } else {
                    // Specific error if columns are missing
                    console.log("Parsed Data Headers:", parsed.meta.fields);
                    Alert.alert("Format Error", "Your CSV must have 'uid' and 'name' columns as the first row.");
                }

            } catch (e) { 
                console.log("Import Error:", e);
                Alert.alert("Read Error", e.message); 
            }
        };

        const handleCreate = async () => {
            if (!name || !loc || !csv) return Alert.alert("Missing Info", "Fill all fields & CSV");
            setCreating(true);
            try {
                const res = await fetch(`${API_URL}/api/events`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ title: name, venueBSSID: loc, students: csv })
                });
                if (res.ok) { 
                    Alert.alert("Created!", "Event is live."); fetchEvents(); setView('homepage'); 
                } else throw new Error("Server Error");
            } catch (e) { Alert.alert("Error", e.message); } 
            finally { setCreating(false); }
        };

        return (
            <ScrollView style={[styles.mainContent, { backgroundColor: theme.background }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>New Event</Text>
                <TextInput style={styles.textInput} placeholder="Event Name" value={name} onChangeText={setName} />
                <TextInput style={[styles.textInput, {marginTop: 15}]} placeholder="Gate ID (e.g. ESP32_HALL_A)" value={loc} onChangeText={setLoc} />
                
                <TouchableOpacity style={[styles.csvImportBtn, { backgroundColor: csv ? theme.success : theme.warning, marginTop: 20 }]} onPress={handleCsvImport}>
                    <Text style={styles.primaryBtnText}>{csv ? "CSV Loaded" : "Upload CSV"}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.brandPrimary }]} onPress={handleCreate} disabled={creating}>
                    <Text style={styles.primaryBtnText}>{creating ? "Creating..." : "CREATE EVENT"}</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    };

    // --- MAIN RENDER ---
    const getHeader = () => {
        if(view === 'homepage') return "MyCaT Home";
        if(view === 'eventBuilder') return "Event Builder";
        return "Verification";
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <Header title={getHeader()} backAction={view !== 'homepage' ? () => setView('homepage') : null} />
            {view === 'homepage' ? renderHomePage() : view === 'scanner' ? <ScannerPage /> : <EventBuilderPage />}
        </View>
    );

    function renderHomePage() {
        return (
            <View style={{ flex: 1 }}>
                <ScrollView refreshControl={<RefreshControl refreshing={loadingEvents} onRefresh={fetchEvents} />} style={styles.mainContent}>
                    {eventsData.length === 0 && <Text style={{textAlign:'center', marginTop: 20, color: theme.closed}}>No Active Events</Text>}
                    {eventsData.map(e => (
                        <TouchableOpacity key={e.dbId} style={[styles.eventCard, { backgroundColor: theme.surface, borderLeftColor: theme.success }]} 
                            onPress={() => { setCurrentEvent(e); setView('scanner'); }}>
                            <Text style={[styles.eventName, {color: theme.text}]}>{e.name}</Text>
                            <Text style={styles.infoNote}>Gate: {e.location}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity style={[styles.floatingBtn, { backgroundColor: theme.brandPrimary }]} onPress={() => setView('eventBuilder')}>
                    <FontAwesome5 name="plus" size={24} color="white" />
                </TouchableOpacity>
            </View>
        );
    }
}

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4 },
    appName: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    mainContent: { flex: 1, padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    eventCard: { padding: 20, borderRadius: 15, marginBottom: 15, borderLeftWidth: 6, elevation: 3 },
    eventName: { fontSize: 18, fontWeight: 'bold' },
    infoNote: { fontSize: 14, color: '#888', marginTop: 5 },
    floatingBtn: { position: 'absolute', right: 25, bottom: 25, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    primaryBtn: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
    primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    textInput: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 15, backgroundColor: '#f9f9f9' },
    csvImportBtn: { padding: 15, borderRadius: 10, alignItems: 'center' },
    resultBox: { padding: 15, borderWidth: 2, borderRadius: 10, marginVertical: 15 },
    userDataBox: { padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10 },
    dataRow: { fontSize: 16, marginBottom: 5 },
    dataLabel: { fontWeight: 'bold' },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
});