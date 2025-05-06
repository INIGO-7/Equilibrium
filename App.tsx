import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import ProgressBar from './src/components/ProgressBar';
import { downloadModel } from './src/api/model';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initLlama, releaseAllLlama } from 'llama.rn';

type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Chat: { initialMessage: string };
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const MODEL_FILE = 'dolphin-2.9.4-gemma2-2b-Q4_K_M.gguf'
const MODEL_REPO = 'bartowski/dolphin-2.9.4-gemma2-2b-GGUF'
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/${MODEL_FILE}`
const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE}`

// Home Screen Component
function HomeScreen({ navigation }: any) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      navigation.navigate('Chat', { initialMessage: message });
      setMessage('');
    }
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
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Onboarding Screen Component
function OnboardingScreen({ navigation }: any) {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const destPath = await downloadModel(
        'mental-health-assistant.gguf',
        MODEL_URL,
        (progress) => setDownloadProgress(progress)
      );
      
      // Verify model file
      if (await RNFS.exists(destPath)) {
        navigation.navigate('Home');
      } else {
        Alert.alert('Error', 'Failed to verify downloaded model');
      }
    } catch (error) {
      Alert.alert('Download Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.onboardingContainer}>
      <View style={styles.onboardingContent}>
        <Text style={styles.onboardingTitle}>LET'S GET STARTED!</Text>
        
        <View style={styles.messageContainer}>
          <Text style={styles.onboardingText}>
            To assist you we use a first-class personal assistant that lives inside your device.
          </Text>
          <Text style={styles.onboardingText}>
            Thanks to this, all your data and conversations remain private and secured!
          </Text>
          <Text style={styles.onboardingText}>
            Now when you're ready, press the button below to download the assistant.
          </Text>
        </View>

        {isDownloading ? (
          <View style={styles.progressContainer}>
            <ProgressBar progress={downloadProgress} />
            <Text style={styles.progressText}>
              {Math.round(downloadProgress * 100)}% downloaded
            </Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            <Text style={styles.downloadButtonText}>Download my assistant</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// Chat Screen Component
function ChatScreen({ route }: any) {
  const [conversation, setConversation] = useState<Message[]>([
    { role: "user", content: route.params.initialMessage },
    { role: "assistant", content: "" }
  ]);
  const [context, setContext] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {

    const initializeModel = async () => {
      try {
        const llamaContext = await initLlama({
          model: MODEL_PATH,
          n_ctx: 2048,
          n_gpu_layers: 1
        });
        setContext(llamaContext);
        generateResponse();

      } catch (error) {
        Alert.alert("Error", "Failed to initialize model");
      }
    };

    initializeModel();

    return () => {
      if (context) {
        releaseAllLlama();
      }
    };
  }, []);

  const generateResponse = async () => {
    if (!context) return;

    setIsGenerating(true);
    try {
      const result = await context.completion(
        {
          messages: conversation,
          n_predict: 1000,
          stop: ["</s>", "<|end|>", "user:", "assistant:"]
        },
        (data: any) => {
          setConversation(prev => {
            const newConvo = [...prev];
            const lastMessage = newConvo[newConvo.length - 1];
            if (lastMessage.role === "assistant") {
              lastMessage.content += data.token;
            }
            return newConvo;
          });
        }
      );

      setConversation(prev => [...prev, { role: "user", content: "" }]);
    } catch (error) {
      Alert.alert("Error", "Failed to generate response");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.chatContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatWrapper}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
        >
          {conversation.map((msg, index) => (
            <View key={index} style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}>
              <Text style={styles.messageText}>
                {msg.content || (msg.role === 'assistant' ? 'Thinking...' : '')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
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
  chatContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatWrapper: {
    flex: 1,
    padding: 16,
  },
  messagesContainer: {
    paddingBottom: 20,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#213568',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#1E293B',
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: 'rgba(123, 152, 223, 0.7)',
  },
  onboardingContent: {
    flex: 1,
    padding: 40,
    justifyContent: 'space-between',
  },
  onboardingTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'rgba(208, 221, 240, 0.6)',
    textAlign: 'center',
    marginTop: 60,
    letterSpacing: 1.5,
  },
  messageContainer: {
    marginVertical: 40,
    gap: 24,
  },
  onboardingText: {
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(208, 221, 240, 0.6)',
    textAlign: 'center',
  },
  downloadButton: {
    backgroundColor: 'rgba(208, 221, 240, 0.3)',
    borderRadius: 30,
    paddingVertical: 20,
    paddingHorizontal: 40,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: 'rgba(208, 221, 240, 0.4)',
  },
  downloadButtonText: {
    color: 'rgba(208, 221, 240, 0.8)',
    fontSize: 20,
    fontWeight: '600',
  },
  progressContainer: {
    marginHorizontal: 30,
    gap: 16,
  },
  progressText: {
    color: 'rgba(208, 221, 240, 0.6)',
    textAlign: 'center',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7B98DF',
  },
  loadingText: {
    color: '#D0DDF0',
    fontSize: 18,
  }, 
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [isModelReady, setIsModelReady] = useState(false);
  const [isCheckingModel, setIsCheckingModel] = useState(true);

  useEffect(() => {
    const checkModel = async () => {
      try {
        const modelExists = await RNFS.exists(MODEL_PATH);
        setIsModelReady(modelExists);
      } catch (error) {
        console.error('Model check failed:', error);
      } finally {
        setIsCheckingModel(false);
      }
    };

    checkModel();
  }, []);

  if (isCheckingModel) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking requirements...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isModelReady && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}