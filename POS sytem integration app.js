import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, ScrollView, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mode, setMode] = useState('SELL'); // SELL or ADD
  
  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  // Form Fields
  const [currentCode, setCurrentCode] = useState('');
  const [name, setName] = useState('');
  const [pkgSize, setPkgSize] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [currentStock, setCurrentStock] = useState(0);

  // Cart for Billing
  const [cart, setCart] = useState([]);

  const projectId = "cambcoder"; 

  // --- 1. SCAN LOGIC ---
  const handleScan = async (barcode) => {
    const cleanId = barcode.replace(/[^a-zA-Z0-9]/g, "_");
    setCurrentCode(barcode);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.fields) {
        // ITEM EXISTS: Auto-fill fields
        setName(data.fields.name?.stringValue || "");
        setPkgSize(data.fields.pkgSize?.stringValue || "");
        setCompany(data.fields.company?.stringValue || "");
        setCategory(data.fields.category?.stringValue || "");
        setPrice(data.fields.price?.doubleValue?.toString() || data.fields.price?.integerValue || "0");
        setCurrentStock(parseInt(data.fields.stock?.integerValue || "0"));
      } else {
        // ITEM IS NEW: Reset fields
        setName(''); setPkgSize(''); setCompany(''); setCategory(''); setPrice(''); setCurrentStock(0);
      }
      setQuantity('1');
      setShowProductModal(true);
    } catch (e) {
      Alert.alert("Error", "Could not connect to Cloud");
      setScanned(false);
    }
  };

  // --- 2. SAVE/UPDATE LOGIC ---
  const processTransaction = async () => {
    const cleanId = currentCode.replace(/[^a-zA-Z0-9]/g, "_");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${cleanId}`;
    const qtyInput = parseInt(quantity);

    if (mode === 'SELL' && qtyInput > currentStock) {
      return Alert.alert("Out of Stock", `Only ${currentStock} left in inventory.`);
    }

    const newStock = mode === 'ADD' ? currentStock + qtyInput : currentStock - qtyInput;

    try {
      await fetch(url, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            name: { stringValue: name },
            pkgSize: { stringValue: pkgSize },
            company: { stringValue: company },
            category: { stringValue: category },
            price: { doubleValue: parseFloat(price) },
            stock: { integerValue: newStock.toString() },
            barcode: { stringValue: currentCode }
          }
        })
      });

      if (mode === 'SELL') {
        const itemTotal = parseFloat(price) * qtyInput;
        setCart([...cart, { name, qty: qtyInput, price: parseFloat(price), total: itemTotal }]);
      }

      setShowProductModal(false);
      setScanned(false);
      Alert.alert("Success", mode === 'ADD' ? "Inventory Updated" : "Added to Bill");
    } catch (err) {
      Alert.alert("Error", "Failed to save.");
    }
  };

  const calculateTotal = () => cart.reduce((sum, item) => sum + item.total, 0).toFixed(2);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}><TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Enable Camera</Text></TouchableOpacity></View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!scanned ? (
        <View style={{flex:1}}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "upc_a", "code128"] }}
            onBarcodeScanned={({ data }) => { setScanned(true); handleScan(data); }}
          />
          <View style={styles.box} />
          <Text style={styles.scanText}>Mode: {mode} - Scan Item</Text>
        </View>
      ) : (
        <View style={styles.center}><Text>Fetching Data...</Text></View>
      )}

      {/* FOOTER NAVIGATION */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.mBtn, mode==='SELL' && {backgroundColor:'red'}]} onPress={()=>setMode('SELL')}><Text style={styles.btnText}>SELL</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.mBtn, mode==='ADD' && {backgroundColor:'green'}]} onPress={()=>setMode('ADD')}><Text style={styles.btnText}>ADD</Text></TouchableOpacity>
        {cart.length > 0 && (
          <TouchableOpacity style={styles.billBtn} onPress={()=>setShowBillModal(true)}>
            <Text style={styles.btnText}>View Bill ({cart.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* PRODUCT MODAL (Handles ADD and SELL) */}
      <Modal visible={showProductModal} animationType="slide">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>{mode === 'ADD' ? "📥 Stock Entry" : "🛒 Selling Item"}</Text>
          
          <Text style={styles.label}>Barcode: {currentCode}</Text>
          <Text style={styles.label}>In Stock: {currentStock}</Text>

          {/* ADD Mode sees all fields. SELL Mode only sees them if item is new */}
          {(mode === 'ADD' || currentStock === 0) ? (
            <>
              <TextInput style={styles.input} placeholder="Product Name" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Package Size (e.g. 500ml)" value={pkgSize} onChangeText={setPkgSize} />
              <TextInput style={styles.input} placeholder="Company Name" value={company} onChangeText={setCompany} />
              <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
              <TextInput style={styles.input} placeholder="Price" keyboardType="numeric" value={price} onChangeText={setPrice} />
            </>
          ) : (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Item: {name}</Text>
              <Text style={styles.infoText}>Price: ${price}</Text>
              <Text style={styles.infoText}>Size: {pkgSize}</Text>
            </View>
          )}

          <Text style={{fontWeight:'bold', marginTop: 10}}>Quantity to {mode}:</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />

          <TouchableOpacity style={styles.saveBtn} onPress={processTransaction}>
            <Text style={styles.btnText}>{mode === 'ADD' ? "Save to Inventory" : "Add to Bill"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={{marginTop:20, alignSelf:'center'}} onPress={()=>{setShowProductModal(false); setScanned(false);}}>
            <Text style={{color:'red'}}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* BILLING MODAL */}
      <Modal visible={showBillModal} animationType="fade">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Final Bill</Text>
          <FlatList 
            data={cart}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({item}) => (
              <View style={styles.billItem}>
                <Text>{item.name} (x{item.qty})</Text>
                <Text>${item.total.toFixed(2)}</Text>
              </View>
            )}
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>TOTAL AMOUNT:</Text>
            <Text style={styles.totalText}>${calculateTotal()}</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={()=>{setCart([]); setShowBillModal(false);}}>
            <Text style={styles.btnText}>Complete Transaction</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  box: { position: 'absolute', top: '25%', left: '15%', width: '70%', height: 250, borderWidth: 3, borderColor: '#00FF00', borderRadius: 20 },
  scanText: { position: 'absolute', top: '20%', width: '100%', textAlign: 'center', color: '#00FF00', fontWeight: 'bold', fontSize: 18 },
  footer: { position: 'absolute', bottom: 30, width: '100%', alignItems:'center' },
  mBtn: { backgroundColor: '#333', padding: 15, borderRadius: 8, width: 120, alignItems: 'center', margin: 5 },
  billBtn: { backgroundColor: '#2196F3', padding: 15, borderRadius: 8, width: 250, alignItems: 'center', marginTop: 10 },
  saveBtn: { backgroundColor: '#22c55e', padding: 20, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  btnText: { color: 'white', fontWeight: 'bold' },
  modal: { flex: 1, padding: 30, backgroundColor: 'white', justifyContent: 'center' },
  modalTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign:'center' },
  label: { color: '#888', marginBottom: 5 },
  input: { borderBottomWidth: 2, borderBottomColor: '#ccc', marginBottom: 20, fontSize: 18, padding: 5 },
  infoBox: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10, marginBottom: 20 },
  infoText: { fontSize: 18, fontWeight: '500', marginBottom: 5 },
  billItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, borderTopWidth: 2, paddingTop: 10 },
  totalText: { fontSize: 22, fontWeight: 'bold' }
});
