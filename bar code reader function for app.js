import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mode, setMode] = useState('SELL');

  const sendToCloud = async (barcode) => {
    const projectId = "cambcoder"; 
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${barcode}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH', 
        body: JSON.stringify({
          fields: {
            barcode: { stringValue: barcode },
            stock: { integerValue: mode === 'SELL' ? "0" : "10" },
            status: { stringValue: mode },
            timestamp: { stringValue: new Date().toISOString() }
          }
        })
      });

      if (response.ok) {
        Alert.alert("✅ Scanned", `Barcode: ${barcode}\nSync: Successful`);
      } else {
        Alert.alert("❌ Sync Error", "Make sure Firestore is in 'Test Mode'");
      }
    } catch (error) {
      Alert.alert("🌐 Network Error", "Check your internet");
    }
  };

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!scanned ? (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            // THIS FIXES THE FOCUS AND DETECTION
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"],
            }}
            onBarcodeScanned={({ data }) => {
              if (!scanned) {
                setScanned(true);
                sendToCloud(data);
              }
            }}
          />
          {/* SCANNER OVERLAY (Target Box) */}
          <View style={styles.overlay}>
            <View style={styles.unfocusedContainer}></View>
            <View style={styles.middleRow}>
              <View style={styles.unfocusedContainer}></View>
              <View style={styles.focusedContainer}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
              </View>
              <View style={styles.unfocusedContainer}></View>
            </View>
            <View style={styles.unfocusedContainer}></View>
          </View>
          <Text style={styles.instruction}>Center the barcode in the box</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>Scan Recorded!</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}>
            <Text style={styles.btnText}>Scan Next Item</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.mBtn, mode === 'SELL' ? {backgroundColor: '#ef4444'} : {backgroundColor: '#374151'}]} 
          onPress={() => setMode('SELL')}
        >
          <Text style={styles.btnText}>SELL</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.mBtn, mode === 'ADD' ? {backgroundColor: '#22c55e'} : {backgroundColor: '#374151'}]} 
          onPress={() => setMode('ADD')}
        >
          <Text style={styles.btnText}>ADD STOCK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row', height: 200 },
  focusedContainer: { width: 280, backgroundColor: 'transparent' },
  instruction: { position: 'absolute', top: 100, width: '100%', textAlign: 'center', color: 'white', fontWeight: 'bold' },
  // Corners for the box
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  btn: { backgroundColor: '#2563eb', padding: 20, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 50, flexDirection: 'row', width: '100%', justifyContent: 'space-evenly' },
  mBtn: { padding: 15, borderRadius: 10, width: 120, alignItems: 'center' }
});
