import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { API_URL, cacheAssignments, cacheChecklist, completeInspection, getCachedAssignments, getCachedChecklist, getPendingInspections, initOfflineStore, syncPendingInspections, type ChecklistResponse, type EvidenceDraft, type PendingInspection } from './src/offlineStore';

type ChecklistItem = { id: string; label: string; expectedCondition?: string | null; required: boolean };

const evidenceTypes = [
  { value: 'instrument_overview', label: 'Overview' },
  { value: 'serial_nameplate', label: 'Nameplate' },
  { value: 'seal_marking', label: 'Seal' },
  { value: 'inspection_observation', label: 'Observation' },
  { value: 'other', label: 'Other' }
];

export default function App() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<PendingInspection[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [assignments, setAssignments] = useState<{ id: string; scheduledDate: string; application: { applicationCode: string; instrument: { instrumentCode: string; type: string }; business: { name: string } } }[]>([]);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [inspectionStartedAt, setInspectionStartedAt] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('lmo@smartmetri.demo');
  const [password, setPassword] = useState('');
  const [remarks, setRemarks] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [selectedEvidenceType, setSelectedEvidenceType] = useState('inspection_observation');
  const reload = async () => setPending(await getPendingInspections());
  useEffect(() => {
    let storeReady = false;
    initOfflineStore().then(() => { storeReady = true; return reload(); }); AsyncStorage.getItem('token').then(setToken);
    const unsubscribe = NetInfo.addEventListener(state => { const connected = Boolean(state.isConnected); setOnline(connected); if (connected && storeReady) void syncPendingInspections().then(reload); });
    AsyncStorage.getItem('token').then(async currentToken => {
      const headers: Record<string, string> = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      const assignmentResponse = await fetch(`${API_URL}/inspections`, { headers });
      const assignmentData = assignmentResponse.ok ? await assignmentResponse.json() : null;
      const available = assignmentData?.assignments || await getCachedAssignments<typeof assignments[number]>();
      if (assignmentData?.assignments) await cacheAssignments(assignmentData.assignments);
      setAssignments(available); setAssignmentId(current => current || available[0]?.id || null);
    }).catch(async () => { const cached = storeReady ? await getCachedAssignments<typeof assignments[number]>() : []; setAssignments(cached); setAssignmentId(current => current || cached[0]?.id || null); });
    return unsubscribe;
  }, [token]);

  useEffect(() => {
    const selected = assignments.find(a => a.id === assignmentId);
    const instrumentType = selected?.application?.instrument?.type;
    AsyncStorage.getItem('token').then(async currentToken => {
      const headers: Record<string, string> = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      const checklistUrl = instrumentType ? `${API_URL}/checklists?instrumentType=${encodeURIComponent(instrumentType)}` : `${API_URL}/checklists`;
      const checklistResponse = await fetch(checklistUrl, { headers });
      const checklistData = checklistResponse.ok ? await checklistResponse.json() : null;
      const configuredItems = checklistData?.templates?.[0]?.items || [];
      const cachedItems = configuredItems.length ? configuredItems : await getCachedChecklist<ChecklistItem>();
      if (configuredItems.length) await cacheChecklist(configuredItems);
      setItems(cachedItems);
    }).catch(async () => { setItems(await getCachedChecklist<ChecklistItem>()); });
  }, [assignmentId, assignments]);
  const login = async () => { const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (!response.ok || !data.token || data.user?.role !== 'LMO') return Alert.alert('Login failed', data.message || 'An LMO account is required.'); await AsyncStorage.setItem('token', data.token); setToken(data.token); };
  const logout = async () => { await AsyncStorage.removeItem('token'); setToken(null); setAssignments([]); setAssignmentId(null); setAnswers({}); setEvidence([]); setInspectionStartedAt(null); setRemarks(''); setFailureReason(''); setSelectedEvidenceType('inspection_observation'); };
  const captureEvidence = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera permission required', 'Evidence capture needs camera access.');
    const photo = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (photo.canceled || !photo.assets[0]) return;
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    const position = locationPermission.granted ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }) : null;
    if (!position) return Alert.alert('Location required', 'GPS context is required for inspection evidence.');
    setEvidence(current => [...current, { localUri: photo.assets[0].uri, fileUrl: photo.assets[0].uri, evidenceType: selectedEvidenceType as any, latitude: position.coords.latitude, longitude: position.coords.longitude, capturedAt: new Date().toISOString() }]);
  };
  const complete = async (result: 'PASS' | 'FAIL') => {
    if (!items.length || items.some(item => answers[item.id] === undefined)) return Alert.alert('Checklist incomplete', 'Complete every configured checklist item before saving.');
    if (!evidence.length) return Alert.alert('Evidence required', 'Capture at least one GPS-tagged evidence image.');
    if (result === 'FAIL' && !failureReason.trim()) return Alert.alert('Failure reason required', 'Please provide a failure reason.');
    const checklistResults: ChecklistResponse[] = items.map(item => ({ checklistItemId: item.id, passed: answers[item.id] === true, remarks: item.expectedCondition || undefined }));
    if (!assignmentId) return Alert.alert('No assignment', 'No inspection has been assigned to this officer.');
    await completeInspection({ assignmentId, result, remarks: remarks.trim() || (result === 'FAIL' ? 'Officer recorded a failed configured check.' : 'All configured checks passed.'), failureReason: result === 'FAIL' ? failureReason.trim() : undefined, checklistResults, evidence, startedAt: inspectionStartedAt || new Date().toISOString() });
    setEvidence([]); setAnswers({}); setInspectionStartedAt(null); setRemarks(''); setFailureReason(''); await reload();
  };
  const sync = async () => { if (online) { await syncPendingInspections(); await reload(); } };
  const startSelectedInspection = async () => {
    if (!assignmentId) return Alert.alert('No assignment', 'Select an assigned inspection first.');
    const startedAt = new Date().toISOString();
    if (online && token) {
      const response = await fetch(`${API_URL}/inspections/${assignmentId}/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) return Alert.alert('Unable to start inspection', data.message || 'The assignment could not be started.');
    }
    setInspectionStartedAt(startedAt);
    Alert.alert(online ? 'Inspection started' : 'Inspection started offline', 'You can now record the checklist, evidence, and result.');
  };
  if (!token) return <SafeAreaView style={styles.safe}><View style={styles.page}><Text style={styles.kicker}>SMARTMETRI / LMO FIELD APP</Text><Text style={styles.title}>Officer Login</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="LMO email" /><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" /><Pressable style={styles.sync} onPress={login}><Text style={styles.buttonText}>SIGN IN AS LMO</Text></Pressable></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}><View><Text style={styles.kicker}>SMARTMETRI / LMO FIELD APP</Text><Text style={styles.title}>Inspection Console</Text></View><Pressable style={styles.logoutButton} onPress={logout}><Text style={styles.buttonText}>LOGOUT</Text></Pressable></View><View style={styles.status}><Text style={styles.statusText}>{online ? 'ONLINE' : 'OFFLINE'}</Text><Text>{pending.length} pending sync</Text></View><View style={styles.card}><Text style={styles.heading}>Assigned inspections</Text>{assignments.length ? assignments.map(item => <Pressable key={item.id} style={[styles.assignment, assignmentId === item.id && styles.selected]} onPress={() => setAssignmentId(item.id)}><Text style={styles.label}>{item.application.instrument.instrumentCode} — {item.application.instrument.type}</Text><Text>{item.application.business.name} / {new Date(item.scheduledDate).toLocaleString()}</Text></Pressable>) : <Text style={styles.muted}>No assigned inspections available.</Text>}<Pressable style={[styles.sync, !assignmentId && styles.disabled]} disabled={!assignmentId} onPress={startSelectedInspection}><Text style={styles.buttonText}>{online ? 'START SELECTED INSPECTION' : 'START INSPECTION OFFLINE'}</Text></Pressable></View><View style={styles.card}><Text style={styles.heading}>Configured checklist</Text>{items.length ? items.map(item => <View key={item.id} style={styles.check}><Text style={styles.label}>{item.label}</Text><Text style={styles.muted}>{item.expectedCondition || 'Department-configured observation'}</Text><View style={styles.row}><Pressable style={[styles.choice, answers[item.id] === true && styles.selected]} onPress={() => setAnswers(current => ({ ...current, [item.id]: true }))}><Text>PASS</Text></Pressable><Pressable style={[styles.choice, answers[item.id] === false && styles.failed]} onPress={() => setAnswers(current => ({ ...current, [item.id]: false }))}><Text>FAIL</Text></Pressable></View></View>}) : <Text style={styles.muted}>No active checklist template available.</Text>}
<TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Officer Remarks" />
{Object.values(answers).includes(false) && <TextInput style={styles.input} value={failureReason} onChangeText={setFailureReason} placeholder="Failure Reason" />}
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Text style={[styles.label, {width: '100%'}]}>Evidence Type:</Text>{evidenceTypes.map(type => (<Pressable key={type.value} style={[styles.typeChoice, selectedEvidenceType === type.value && styles.typeSelected]} onPress={() => setSelectedEvidenceType(type.value)}><Text style={[styles.typeText, selectedEvidenceType === type.value && styles.typeTextSelected]}>{type.label}</Text></Pressable>))}</View>
<Pressable style={styles.capture} onPress={captureEvidence}><Text style={styles.buttonText}>CAPTURE GPS-TAGGED EVIDENCE ({evidence.length})</Text></Pressable>
{evidence.length > 0 && <ScrollView horizontal style={styles.previewScroll}>{evidence.map((ev, index) => (<View key={index} style={styles.previewContainer}><Image source={{ uri: ev.localUri }} style={styles.previewImage} /><Pressable style={styles.deleteButton} onPress={() => setEvidence(current => current.filter((_, i) => i !== index))}><Text style={styles.deleteButtonText}>X</Text></Pressable></View>))}</ScrollView>}
<View style={styles.row}><Pressable style={styles.button} onPress={() => complete('PASS')}><Text style={styles.buttonText}>PASS</Text></Pressable><Pressable style={styles.fail} onPress={() => complete('FAIL')}><Text style={styles.buttonText}>FAIL</Text></Pressable></View></View><View style={styles.card}><Text style={styles.heading}>Sync center</Text>{pending.map(item => <Text key={item.clientSyncId} style={styles.item}>Saved offline — {item.result} — {item.syncState}</Text>)}<Pressable disabled={!online || !pending.length} style={[styles.sync, (!online || !pending.length) && styles.disabled]} onPress={sync}><Text style={styles.buttonText}>{online ? 'SYNC PENDING INSPECTIONS' : 'OFFLINE — SYNC UNAVAILABLE'}</Text></Pressable></View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f5f5f4' }, page: { padding: 20, gap: 18 }, kicker: { color: '#b91c1c', fontSize: 12, fontWeight: '700' }, title: { fontSize: 30, fontWeight: '800', color: '#1c1917' }, input: { borderWidth: 2, borderColor: '#1c1917', padding: 12, backgroundColor: '#fafaf9' }, status: { borderWidth: 2, borderColor: '#1c1917', padding: 14, flexDirection: 'row', justifyContent: 'space-between' }, statusText: { color: '#b91c1c', fontWeight: '800' }, card: { backgroundColor: '#fafaf9', borderWidth: 2, borderColor: '#1c1917', padding: 18, gap: 12 }, heading: { fontSize: 18, fontWeight: '800' }, muted: { color: '#57534e' }, label: { fontWeight: '600' }, assignment: { borderWidth: 1, borderColor: '#1c1917', padding: 10, gap: 4 }, check: { borderBottomWidth: 1, borderBottomColor: '#d6d3d1', paddingBottom: 10, gap: 5 }, row: { flexDirection: 'row', gap: 12 }, choice: { borderWidth: 1, borderColor: '#1c1917', padding: 9, flex: 1, alignItems: 'center' }, selected: { backgroundColor: '#bbf7d0' }, failed: { backgroundColor: '#fecaca' }, button: { backgroundColor: '#166534', padding: 15, flex: 1, alignItems: 'center' }, fail: { backgroundColor: '#b91c1c', padding: 15, flex: 1, alignItems: 'center' }, capture: { backgroundColor: '#1c1917', padding: 15, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800', textAlign: 'center' }, item: { borderBottomWidth: 1, borderBottomColor: '#d6d3d1', paddingVertical: 8 }, sync: { backgroundColor: '#1c1917', padding: 15, alignItems: 'center' }, disabled: { opacity: 0.4 }, logoutButton: { backgroundColor: '#1c1917', paddingHorizontal: 12, paddingVertical: 8 }, previewScroll: { marginTop: 10, flexDirection: 'row' }, previewContainer: { position: 'relative', marginRight: 10 }, previewImage: { width: 80, height: 80, borderWidth: 2, borderColor: '#1c1917' }, deleteButton: { position: 'absolute', top: -5, right: -5, backgroundColor: '#b91c1c', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1c1917' }, deleteButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }, typeChoice: { borderWidth: 1, borderColor: '#1c1917', padding: 8, backgroundColor: '#fafaf9' }, typeSelected: { backgroundColor: '#1c1917' }, typeText: { fontSize: 12, fontWeight: '600' }, typeTextSelected: { color: '#fff' } });
