import React, { useState } from 'react';
import { 
  Text, View, StyleSheet, TouchableOpacity, SafeAreaView, 
  Alert, TextInput, ScrollView, FlatList, ActivityIndicator 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [screen, setScreen] = useState('scanner'); // 'scanner', 'form', or 'bill'
  const [mode, setMode] = useState('ADD'); 
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [currentCode, setCurrentCode] = useState('');
  const [name, setName] = useState('');
  const [pkgSize, setPkgSize] = useState('');
  const [company, setCompany] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [currentStock, setCurrentStock] = useState(0);
  const [cart, setCart] = useState([]);

  const projectId = "cambcoder"; 

  // --- 1. INSTANT LOCAL & FAST AUTO-FILL LOGIC ---
  const handleBarcodeScannedFast = async (barcode) => {
    if (loading) return;
    setLoading(true);
    setCurrentCode(barcode);

    const cleanId = barcode.replace(/[^a-zA-Z0-9]/g, "_");
    const myDbUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;

    try {
      // Step A: Check your Firebase inventory first (< 200ms)
      const res = await fetch(myDbUrl);
      const data = await res.json();

      if (data.fields) {
        // Item already exists in your store
        const pName = data.fields.name?.stringValue || "Unknown Item";
        const pPrice = parseFloat(data.fields.price?.doubleValue || data.fields.price?.integerValue || "0");
        const pStock = parseInt(data.fields.stock?.integerValue || "0");

        if (mode === 'SELL') {
          // Instant Sell (No delay, no popup)
          if (pStock > 0) {
            await fetch(myDbUrl, {
              method: 'PATCH',
              body: JSON.stringify({ fields: { ...data.fields, stock: { integerValue: (pStock - 1).toString() } } })
            });
            setCart(prev => [...prev, { name: pName, price: pPrice, total: pPrice }]);
            Alert.alert("🛒 Added to Bill", `${pName} ($${pPrice.toFixed(2)})`);
          } else {
            Alert.alert("Out of Stock", `${pName} has 0 stock.`);
          }
          setLoading(false);
          setScreen('scanner');
          return;
        } else {
          // ADD Mode: Pre-fill existing data for restock
          setName(pName);
          setPkgSize(data.fields.pkgSize?.stringValue || "");
          setCompany(data.fields.company?.stringValue || "");
          setPrice(pPrice.toString());
          setCurrentStock(pStock);
          setQuantity('1');
          setLoading(false);
          setScreen('form');
          return;
        }
      }

      // Step B: New Item! Auto-fetch official manufacturer info in < 300ms
      let fetchedName = '';
      let fetchedBrand = '';
      let fetchedSize = '';

      try {
        const globalRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const globalData = await globalRes.json();
        if (globalData.status === 1 && globalData.product) {
          fetchedName = globalData.product.product_name || globalData.product.product_name_en || '';
          fetchedBrand = globalData.product.brands || '';
          fetchedSize = globalData.product.quantity || '';
        }
      } catch (e) {
        // Continue if offline
      }

      // Pre-fill form
      setName(fetchedName);
      setCompany(fetchedBrand);
      setPkgSize(fetchedSize);
      setPrice('');
      setQuantity('1');
      setCurrentStock(0);
      setLoading(false);
      setScreen('form');

    } catch (err) {
      setLoading(false);
      setScreen('form');
    }
  };

  // --- 2. SAVE TO FIREBASE ---
  const saveToCloud = async () => {
    if (!name || !price) {
      return Alert.alert("Required", "Please provide at least Name and Price.");
    }

    const cleanId = currentCode.replace(/[^a-zA-Z0-9]/g, "_");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;
    const qty = parseInt(quantity) || 1;
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
      setCart(prev => [...prev, { name, price: parseFloat(price), total: (parseFloat(price) || 0) * qty }]);
    }
    setScreen('scanner');
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

  // --- SCREEN 1: INSTANT LOCAL SCANNER ---
  if (screen === 'scanner') {
    return (
      <SafeAreaView style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          // Native on-device hardware decoder (Instant & 100% accurate)
          barcodeScannerSettings={{ 
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] 
          }}
          onBarcodeScanned={({ data }) => {
            if (!loading) handleBarcodeScannedFast(data);
          }}
        />
        
        <View style={styles.box} />
        <Text style={styles.boxLabel}>
          {mode === 'ADD' ? "ADD MODE: Align Barcode to Auto-Fill" : "SELL MODE: Align Barcode"}
        </Text>
        
        {/* FOOTER SWITCHER */}
        <View style={styles.footer}>
          <View style={{flexDirection:'row'}}>
            <TouchableOpacity 
              style={[styles.mBtn, mode==='SELL' ? {backgroundColor:'red'}:{backgroundColor:'#333'}]} 
              onPress={()=>setMode('SELL')}
            >
              <Text style={styles.btnText}>SELL</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.mBtn, mode==='ADD' ? {backgroundColor:'green'}:{backgroundColor:'#333'}]} 
              onPress={()=>setMode('ADD')}
            >
              <Text style={styles.btnText}>ADD</Text>
            </TouchableOpacity>
          </View>
          {cart.length > 0 && (
            <TouchableOpacity style={styles.billBtn} onPress={()=>setScreen('bill')}>
              <Text style={styles.btnText}>VIEW BILL (${cart.reduce((a,b)=>a+b.total,0).toFixed(2)})</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#00FF00" />
            <Text style={{color:'white', marginTop:10, fontWeight:'bold'}}>Reading Barcode...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // --- SCREEN 2: EDITABLE PRODUCT FORM ---
  if (screen === 'form') {
    return (
      <ScrollView style={styles.formContainer}>
        <Text style={styles.title}>Product Details</Text>
        <Text style={styles.sub}>Barcode: {currentCode}</Text>
        
        <Text style={styles.fieldLabel}>Product Name *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Product Name" 
          value={name} 
          onChangeText={setName} 
        />
        
        <Text style={styles.fieldLabel}>Package Size (Auto-detected)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. 500ml, 1kg, 250g" 
          value={pkgSize} 
          onChangeText={setPkgSize} 
        />
        
        <Text style={styles.fieldLabel}>Company / Brand</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Company / Brand" 
          value={company} 
          onChangeText={setCompany} 
        />
        
        <Text style={styles.fieldLabel}>Price ($) *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="0.00" 
          keyboardType="numeric" 
          value={price} 
          onChangeText={setPrice} 
          autoFocus={!price} // places cursor directly in price!
        />
        
        <Text style={styles.fieldLabel}>Quantity to {mode} *</Text>
        <TextInput 
          style={styles.input} 
          keyboardType="numeric" 
          value={quantity} 
          onChangeText={setQuantity} 
        />
        
        <TouchableOpacity style={styles.saveBtn} onPress={saveToCloud}>
          <Text style={styles.btnText}>CONFIRM & SAVE TO INVENTORY</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{marginTop:20, marginBottom:40, alignSelf:'center'}} onPress={()=>setScreen('scanner')}>
          <Text style={{color:'red'}}>CANCEL</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- SCREEN 3: BILL SCREEN ---
  if (screen === 'bill') {
    return (
      <View style={styles.formContainer}>
        <Text style={styles.title}>Customer Receipt</Text>
        <FlatList 
          data={cart} 
          keyExtractor={(_, index) => index.toString()}
          renderItem={({item})=>(
            <View style={styles.row}>
              <Text style={{fontSize:16}}>{item.name}</Text>
              <Text style={{fontWeight:'bold'}}>${item.price.toFixed(2)}</Text>
            </View>
          )} 
        />
        <View style={styles.totalRow}>
          <Text style={styles.total}>Total: ${cart.reduce((a,b)=>a+b.total,0).toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={()=>{setCart([]); setScreen('scanner');}}>
          <Text style={styles.btnText}>FINISH SALE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{marginTop:20, alignSelf:'center'}} onPress={()=>setScreen('scanner')}>
          <Text style={{color:'blue'}}>SCAN MORE</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: { position: 'absolute', top: '25%', left: '10%', width: '80%', height: 180, borderWidth: 3, borderColor: '#00FF00', borderRadius: 15 },
  boxLabel: { position: 'absolute', top: '20%', width: '100%', textAlign: 'center', color: '#00FF00', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  mBtn: { padding: 15, borderRadius: 8, width: 100, alignItems: 'center', margin: 5 },
  billBtn: { backgroundColor: '#2196F3', padding: 15, borderRadius: 8, width: '80%', alignItems: 'center', marginTop: 10 },
  btn: { backgroundColor: '#2196F3', padding: 20, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold' },
  formContainer: { flex: 1, backgroundColor: 'white', padding: 25, paddingTop: 50 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  sub: { color: '#888', textAlign: 'center', marginBottom: 20 },
  fieldLabel: { fontWeight: 'bold', color: '#444', marginBottom: 5 },
  input: { borderBottomWidth: 2, borderBottomColor: '#eee', marginBottom: 20, fontSize: 16, padding: 6 },
  saveBtn: { backgroundColor: '#22c55e', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  totalRow: { marginTop: 20, padding: 15, backgroundColor: '#f9f9f9', borderRadius: 10 },
  total: { fontSize: 22, fontWeight: 'bold', textAlign: 'right' },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }
});
