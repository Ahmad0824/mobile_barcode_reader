import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mode, setMode] = useState('SELL');

  const projectId = "cambcoder"; 

  // --- CLOUD CONNECTION ---
  // --- CLOUD CONNECTION (With QR Cleaning) ---
  const sendToCloud = async (barcode) => {
    // 1. CLEAN THE DATA: Replace slashes, dots, and symbols with underscores
    // This allows QR codes with URLs to be saved safely.
    const cleanBarcode = barcode.replace(/[^a-zA-Z0-9]/g, "_");

    const projectId = "cambcoder"; 
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanBarcode}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH', 
        body: JSON.stringify({
          fields: {
            original_code: { stringValue: barcode }, // Keep the original text here
            clean_id: { stringValue: cleanBarcode },
            stock: { integerValue: mode === 'SELL' ? "0" : "10" },
            status: { stringValue: mode },
            lastScanned: { stringValue: new Date().toISOString() }
          }
        })
      });

      if (response.ok) {
        Alert.alert("✅ QR/Barcode Success", `Data: ${barcode}\nSaved safely to Cloud.`);
      } else {
        // If it still fails, it might be a rules issue
        Alert.alert("❌ Firebase Error", "Check if your Firestore Test Mode has expired (30 days limit).");
      }
    } catch (error) {
      Alert.alert("🌐 Network Error", "Check your connection");
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
            // --- ENABLED QR AND BARCODE TYPES BELOW ---
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "upc_a", "code128", "ean8", "aztec", "pdf417"],
            }}
            onBarcodeScanned={({ data }) => {
              if (!scanned) {
                setScanned(true);
                sendToCloud(data);
              }
            }}
          />
          {/* SCANNER OVERLAY */}
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
          <Text style={styles.instruction}>Scan Barcode or QR Code</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>Scan Complete!</Text>
          <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}>
            <Text style={styles.btnText}>Ready for Next Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SELL/ADD SWITCHER */}
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
          <Text style={styles.btnText}>ADD</Text>
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
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  middleRow: { flexDirection: 'row', height: 250 },
  focusedContainer: { width: 250, backgroundColor: 'transparent' },
  instruction: { position: 'absolute', top: 80, width: '100%', textAlign: 'center', color: 'white', fontWeight: 'bold' },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  btn: { backgroundColor: '#2196F3', padding: 20, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-evenly' },
  mBtn: { padding: 15, borderRadius: 10, width: 100, alignItems: 'center' }
});
