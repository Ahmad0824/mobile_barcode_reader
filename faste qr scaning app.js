import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, SafeAreaView, Alert, TextInput, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [screen, setScreen] = useState('scanner'); // 'scanner', 'form', or 'bill'
  const [mode, setMode] = useState('SELL'); 
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [currentCode, setCurrentCode] = useState('');
  const [name, setName] = useState('');
  const [pkgSize, setPkgSize] = useState('');
  const [company, setCompany] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [currentStock, setCurrentStock] = useState(0);
  const [cart, setCart] = useState([]);

  const projectId = "cambcoder"; 

  // --- 1. QR DATA PARSER ---
  const parseQRData = (data) => {
    let extracted = { name: "", company: "", pkgSize: "" };
    try {
      const lines = data.split(/[\n,;]+/);
      lines.forEach(line => {
        const parts = line.split(':');
        if (parts.length > 1) {
          const key = parts[0].toLowerCase().trim();
          const val = parts[1].trim();
          if (key.includes('name')) extracted.name = val;
          if (key.includes('co') || key.includes('brand')) extracted.company = val;
          if (key.includes('size')) extracted.pkgSize = val;
        }
      });
    } catch (e) {}
    return extracted;
  };

  // --- 2. SCAN HANDLER ---
  const handleScan = async (barcode) => {
    setLoading(true);
    const cleanId = barcode.replace(/[^a-zA-Z0-9]/g, "_");
    setCurrentCode(barcode);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.fields) {
        const pName = data.fields.name?.stringValue || "Unknown";
        const pPrice = parseFloat(data.fields.price?.doubleValue || data.fields.price?.integerValue || "0");
        const pStock = parseInt(data.fields.stock?.integerValue || "0");

        if (mode === 'SELL' && pStock > 0) {
          // INSTANT SELL
          await updateStockOnly(cleanId, data.fields, pStock - 1);
          setCart(prev => [...prev, { name: pName, price: pPrice, total: pPrice }]);
          Alert.alert("🛒 Sold", `${pName} added to bill.`);
          setLoading(false);
          setScreen('scanner');
        } else {
          // SHOW FORM (ADD mode or Out of Stock)
          setName(pName);
          setPkgSize(data.fields.pkgSize?.stringValue || "");
          setCompany(data.fields.company?.stringValue || "");
          setPrice(pPrice.toString());
          setCurrentStock(pStock);
          setLoading(false);
          setScreen('form');
        }
      } else {
        // NEW ITEM
        const qr = parseQRData(barcode);
        setName(qr.name); setCompany(qr.company); setPkgSize(qr.pkgSize);
        setPrice(''); setCurrentStock(0);
        setLoading(false);
        setScreen('form');
      }
    } catch (error) {
      setLoading(false);
      setScreen('scanner');
      Alert.alert("Error", "Cloud connection failed.");
    }
  };

  const updateStockOnly = async (id, fields, newStock) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${id}`;
    await fetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { ...fields, stock: { integerValue: newStock.toString() } } })
    });
  };

  const saveToCloud = async () => {
    const cleanId = currentCode.replace(/[^a-zA-Z0-9]/g, "_");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;
    const qty = parseInt(quantity) || 0;
    const finalStock = mode === 'ADD' ? currentStock + qty : currentStock - qty;

    await fetch(url, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          name: { stringValue: name },
          pkgSize: { stringValue: pkgSize },
          company: { stringValue: company },
          price: { doubleValue: parseFloat(price) || 0 },
          stock: { integerValue: finalStock.toString() },
          barcode: { stringValue: currentCode }
        }
      })
    });

    if (mode === 'SELL') {
      setCart(prev => [...prev, { name, price: parseFloat(price), total: (parseFloat(price)||0) * qty }]);
    }
    setScreen('scanner');
  };

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}><TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Enable Camera</Text></TouchableOpacity></View>
    );
  }

  // --- SCREEN 1: SCANNER ---
  if (screen === 'scanner') {
    return (
      <SafeAreaView style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "upc_a", "code128"] }}
          onBarcodeScanned={({ data }) => { if(!loading) handleScan(data); }}
        />
        <View style={styles.box} />
        <View style={styles.footer}>
          <View style={{flexDirection:'row'}}>
            <TouchableOpacity style={[styles.mBtn, mode==='SELL' ? {backgroundColor:'red'}:{backgroundColor:'#333'}]} onPress={()=>setMode('SELL')}><Text style={styles.btnText}>SELL</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.mBtn, mode==='ADD' ? {backgroundColor:'green'}:{backgroundColor:'#333'}]} onPress={()=>setMode('ADD')}><Text style={styles.btnText}>ADD</Text></TouchableOpacity>
          </View>
          {cart.length > 0 && <TouchableOpacity style={styles.billBtn} onPress={()=>setScreen('bill')}><Text style={styles.btnText}>VIEW BILL (${cart.reduce((a,b)=>a+b.total,0).toFixed(2)})</Text></TouchableOpacity>}
        </View>
        {loading && <View style={styles.loading}><ActivityIndicator size="large" color="white" /></View>}
      </SafeAreaView>
    );
  }

  // --- SCREEN 2: PRODUCT FORM ---
  if (screen === 'form') {
    return (
      <ScrollView style={styles.formContainer}>
        <Text style={styles.title}>Product Details</Text>
        <Text style={styles.sub}>Code: {currentCode}</Text>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Size" value={pkgSize} onChangeText={setPkgSize} />
        <TextInput style={styles.input} placeholder="Company" value={company} onChangeText={setCompany} />
        <TextInput style={styles.input} placeholder="Price" keyboardType="numeric" value={price} onChangeText={setPrice} />
        <Text style={{fontWeight:'bold', marginTop:10}}>Quantity to {mode}:</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
        <TouchableOpacity style={styles.saveBtn} onPress={saveToCloud}><Text style={styles.btnText}>CONFIRM & SAVE</Text></TouchableOpacity>
        <TouchableOpacity style={{marginTop:30, alignSelf:'center'}} onPress={()=>setScreen('scanner')}><Text style={{color:'red'}}>CANCEL</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  // --- SCREEN 3: BILL ---
  if (screen === 'bill') {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.title}>Invoice</Text>
        <FlatList 
          data={cart} 
          renderItem={({item})=>(<View style={styles.row}><Text>{item.name}</Text><Text>${item.price.toFixed(2)}</Text></View>)} 
        />
        <View style={styles.totalRow}><Text style={styles.total}>Total: ${cart.reduce((a,b)=>a+b.total,0).toFixed(2)}</Text></View>
        <TouchableOpacity style={styles.saveBtn} onPress={()=>{setCart([]); setScreen('scanner');}}><Text style={styles.btnText}>FINISH & CLEAR</Text></TouchableOpacity>
        <TouchableOpacity style={{marginTop:20, alignSelf:'center'}} onPress={()=>setScreen('scanner')}><Text style={{color:'blue'}}>BACK TO SCANNER</Text></TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: { position: 'absolute', top: '25%', left: '15%', width: '70%', height: 250, borderWidth: 3, borderColor: '#00FF00', borderRadius: 20 },
  footer: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  mBtn: { padding: 15, borderRadius: 8, width: 100, alignItems: 'center', margin: 5 },
  billBtn: { backgroundColor: '#2196F3', padding: 15, borderRadius: 8, width: '80%', alignItems: 'center', marginTop: 10 },
  btn: { backgroundColor: '#2196F3', padding: 20, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  formContainer: { flex: 1, backgroundColor: 'white', padding: 30, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  sub: { color: '#888', textAlign: 'center', marginBottom: 30 },
  input: { borderBottomWidth: 2, borderBottomColor: '#eee', marginBottom: 25, fontSize: 18, padding: 5 },
  saveBtn: { backgroundColor: '#22c55e', padding: 20, borderRadius: 10, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  totalRow: { marginTop: 20, padding: 15, backgroundColor: '#f9f9f9', borderRadius: 10 },
  total: { fontSize: 22, fontWeight: 'bold', textAlign: 'right' },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
});
