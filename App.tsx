import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';

function App(): React.JSX.Element {
  const [message, setMessage] = useState('');
  
  const handleSend = () => {
    // Will implement navigation later
    console.log('Message to send:', message);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Layers */}
      <View style={styles.backgroundContainer}>
        {/* Base White Layer */}
        <View style={styles.baseLayer} />
        
        {/* Diffused Circles - Deep Layer */}
        <View style={[styles.circle, styles.deepCircle1]} />
        <View style={[styles.circle, styles.deepCircle2]} />
        <View style={[styles.circle, styles.deepCircle3]} />
        
        {/* Diffused Circles - Mid Layer */}
        <View style={[styles.circle, styles.midCircle1]} />
        <View style={[styles.circle, styles.midCircle2]} />
        
        {/* Overlay Color Layer */}
        <View style={styles.colorOverlay} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>EQUILIBRIUM</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="How have you been feeling today?"
            placeholderTextColor="#A6B5D9"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={handleSend}
          >
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  baseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
  colorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33, 53, 104, 0.37)',
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    opacity: 0.37,
  },
  // Deep Layer Circles (100% opacity)
  deepCircle1: {
    backgroundColor: '#7B98DF',
    width: 400,
    height: 400,
    top: -100,
    left: -50,
    opacity: 1,
  },
  deepCircle2: {
    backgroundColor: '#7B98DF',
    width: 300,
    height: 300,
    bottom: -150,
    right: -100,
    opacity: 1,
  },
  deepCircle3: {
    backgroundColor: '#7B98DF',
    width: 250,
    height: 250,
    top: '30%',
    right: -120,
    opacity: 1,
  },
  // Mid Layer Circles
  midCircle1: {
    backgroundColor: '#213568',
    width: 500,
    height: 500,
    top: -200,
    right: -150,
  },
  midCircle2: {
    backgroundColor: '#213568',
    width: 450,
    height: 450,
    bottom: -200,
    left: -100,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    zIndex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#213568',
    textAlign: 'center',
    marginTop: 40,
    letterSpacing: 1.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 16,
    color: '#213568',
    minHeight: 56,
    borderWidth: 1,
    borderColor: 'rgba(123, 152, 223, 0.3)',
    shadowColor: '#213568',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  sendButton: {
    backgroundColor: '#213568',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#213568',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default App;