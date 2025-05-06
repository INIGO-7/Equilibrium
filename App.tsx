import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

function App(): React.JSX.Element {
  const handleGetStarted = () => {
    // Will implement navigation later
    console.log('Navigate to chatbot');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Main Title */}
        <Text style={styles.title}>EQUILIBRIUM</Text>
        
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Text style={styles.subtitle}>How have you been feeling today?</Text>
          
          {/* Emotion Selection Grid */}
          <View style={styles.emotionGrid}>
            {['😊', '😢', '😡', '😴', '😰', '😞'].map((emoji, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.emotionButton}
                onPress={() => console.log('Selected emotion:', emoji)}
              >
                <Text style={styles.emotionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Get Started Button */}
        <TouchableOpacity 
          style={styles.getStartedButton}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
    textAlign: 'center',
    marginTop: 40,
    letterSpacing: 1.2,
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 32,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: 20,
  },
  emotionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emotionText: {
    fontSize: 32,
  },
  getStartedButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default App;