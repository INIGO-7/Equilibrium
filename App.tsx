import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import ProgressBar from './src/components/ProgressBar';
import { downloadModel } from './src/services/model';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initLlama } from 'llama.rn';
import { ModelProvider, useModel } from './src/services/context';
import RAGService from './src/services/ragService';

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const INITIAL_CONVERSATION: Message[] = [
  {
    role: 'system',
    content:
      'This is a conversation between user and assistant, a friendly chatbot.',
  },
];

const PROMPT_TEMPLATE = "Please play the role of a psychiatrist. Your task is to conduct a " +
"professional diagnosis conversation with me based on the DSM-5 criteria, but using your own " +
"language. Your questions should cover at least the following aspects: emotion, sleep, " +
"weight and appetite, loss of interest, energy, social function, self-harm or suicide, " +
"history. You are free to choose the order of questions, but you must collect complete " +
"information on all aspects in the end. Please only ask one question at a time. You need to ask " +
"in-depth questions, such as the duration, causes and specific manifestations of some symptoms." +
"Using these instructions and taking into account previous messages, respond to the new patient's message:";

const MODEL_FILE = 'Llama-3.2-1B-Instruct-Q6_K_L.gguf'
const MODEL_REPO = 'bartowski/Llama-3.2-1B-Instruct-GGUF'
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/${MODEL_FILE}`
const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE}`
const LLAMA_POOLING_TYPE_MEAN = 1

// Onboarding Screen Component
function OnboardingScreen({ navigation }: any) {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const destPath = await downloadModel(
        MODEL_FILE,
        MODEL_URL,
        (progress: any) => setDownloadProgress(progress)
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
              {Math.round(downloadProgress)}% downloaded
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

// Home Screen Component
function HomeScreen({ navigation }: any) {
  const [ message, setMessage ] = useState('');
  const [ isModelLoading, setIsModelLoading ] = useState(true);
  const { llamaContext, setLlamaContext, embeddingContext, setEmbeddingContext, isRAGReady, setIsRAGReady } = useModel();

  const sendAndNavigate = () => {
    if (isModelLoading || !llamaContext || !isRAGReady) {
      Alert.alert("Please wait until the model and RAG are loaded.");
    } else if (message.trim()) {
      navigation.navigate('Chat', { initialMessage: message });
      setMessage('');
    } else {
      Alert.alert("Please write a message before pressing the 'send' button");
    }
  };

  useEffect(() => {

    const initializeServices = async () => {
      setIsModelLoading(true);

      try {
        // init LLM 
        const fileExists = await RNFS.exists(MODEL_PATH);

        if (!fileExists) {
          Alert.alert('Error Loading LLM model', 'The model file does not exist.');
          return;
        }

        const llamaContext = await initLlama({
          model: MODEL_PATH,
          use_mlock: true,
          n_ctx: 4096,
          n_gpu_layers: 1
        });
        setLlamaContext(llamaContext);

        const embeddingContext = await initLlama({
          model: MODEL_PATH,
          embedding: true,
          pooling_type: "mean",
          n_ctx: 256
        })
        setEmbeddingContext(embeddingContext);

        // init RAGService
        await RAGService.initialize();
        await RAGService.testDatabaseConnection();
        setIsRAGReady(true);

        Alert.alert("Success", "Model and RAG service loaded successfully!");

      } catch (error) {
        console.error(error);
        if (!llamaContext) {
          Alert.alert("Error", "Failed to initialize LLM");
        } 
        if (!isRAGReady) {
          Alert.alert("Error", "Failed to initialize RAG system")
        }
      } finally {
        setIsModelLoading(false);
      }
    };

    initializeServices();
  }, []);

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
            onSubmitEditing={sendAndNavigate}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendAndNavigate}>
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Replace your existing ChatScreen component with this fixed version

function ChatScreen({ route }: any) {
  const [conversation, setConversation] = 
    useState<Message[]>(INITIAL_CONVERSATION);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userInput, setUserInput] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [tokensPerSecond, setTokensPerSecond] = useState<number[]>([]);

  const { llamaContext, isRAGReady, embeddingContext } = useModel();

  const handleSendMessage = async (input?: string) => {
    // Check if context is loaded and user input is valid
    if (!llamaContext) {
      Alert.alert('LLM not ready', 'Please make it available first.');
      return;
    }
    if (!isRAGReady) {
      Alert.alert('RAG not ready', 'Please make it available first.');
      return;
    }

    const finalInput = input ?? userInput;

    if (!finalInput.trim()) {
      Alert.alert('Input Error', 'Please enter a message.');
      return;
    } 

    // New user's message and placeholder for assistant's response
    const newConversation : Message[] = [
      ...conversation,
      {role: 'user', content: finalInput},
      {role: "assistant", content: ""}
    ];

    // 1. Update UI state
    setConversation(newConversation);
    setUserInput('');
    setIsGenerating(true);

    // 2. Build the embedding with llama.rn
    let embedding: number[];
    try {
      const resp = await embeddingContext.embedding(finalInput);
      embedding = resp.embedding;
      console.log('✅ Embedding created. Embedding: ', embedding);
    } catch (err) {
      console.error('❌ Embedding error:', err);
      Alert.alert('Embedding error', 'Could not create an embedding');
      setIsGenerating(false);
      return;
    }

    // 3. Search the db for similar documents using RAG service
    let ragResults;
    try {
      ragResults = await RAGService.searchSimilar(embedding, {
        topK: 2,
        threshold: 0.4,
      });
      console.log("RAG document results: ", ragResults);
    } catch (error) {
      console.error('❌ RAG Search Failed - Could not perform similarity search. Error: ', error);
      setIsGenerating(false);
      return;
    }

    // 4. LLM completion
    try {
      const stopWords = [
        '</s>', '<|end|>', 'user:', 'assistant:',
        '<|im_end|>', '<|eot_id|>', '<|end▁of▁sentence|>',
        '<｜end▁of▁sentence｜>',
      ];

      const ragTexts = ragResults.map((item:any, idx:any) => {
        return `Document ${idx + 1}:\n${item.content.trim()}`;
      }).join('\n\n');

      const augmentedUserContent = 
      `Here are some relevant documents to consider before answering:\n\n${ragTexts}\n\n---\n\n` +
      PROMPT_TEMPLATE + `\n` + finalInput;

      const messagesForLlama = [
        ...conversation,  // The original conversation doesn't contain the new user message yet!
        { role: 'user', content: augmentedUserContent },
      ];
    
      console.log("Check if content's correctly passed to the Llama -->", messagesForLlama);

      interface CompletionData {
        token: string;
      }

      interface CompletionResult {
        timings: {
          predicted_per_second: number;
        };
      }

      let currentAssistantMessage = "";

      const result: CompletionResult = await llamaContext.completion(
        {
          messages: messagesForLlama,
          max_tokens: 300,
          stop: stopWords,
        },
        (data: CompletionData) => { 
          const token = data.token;
          currentAssistantMessage += token;

          // Use functional state update to avoid stale closure issues
          setConversation((prevConversation) => {
            const updatedConversation = [...prevConversation];
            const lastIndex = updatedConversation.length - 1;
            
            if (lastIndex >= 0 && updatedConversation[lastIndex].role === 'assistant') {
              updatedConversation[lastIndex] = {
                ...updatedConversation[lastIndex],
                content: currentAssistantMessage.trim()
              };
            }
            
            return updatedConversation;
          });

          // Auto-scroll to bottom as new tokens arrive
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      );

      // Add the final tokens per second measurement
      setTokensPerSecond((prev) => [
        ...prev,
        parseFloat(result.timings.predicted_per_second.toFixed(2)),
      ]);

    } catch (error) {
      console.error('Inference error:', error);
      Alert.alert(
        'Inference error',
        error instanceof Error ? error.message : 'An unknown error occurred.',
      );
      
      // Remove the empty assistant message on error
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  const stopGeneration = async () => {
    try {
      await llamaContext.stopCompletion();
      setIsGenerating(false);

      setConversation((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              content: lastMessage.content + "\n\n*Generation stopped by user*",
            },
          ];
        }
        return prev;
      });
    } catch (error) {
      console.error("Error stopping completion:", error);
    }
  };

  useEffect(() => {
    const sendInitialMessage = async () => {
      if (route.params?.initialMessage) {
        await handleSendMessage(route.params.initialMessage);
      }
    };
    sendInitialMessage();
  }, []);

  // Auto-scroll when conversation updates
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation]);

  return (
    <SafeAreaView style={styles.chatContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatWrapper}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {conversation.slice(1).map((msg, index) => (
            <View key={index} style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}>
              <Text style={[
                styles.messageText,
                msg.role === 'user' ? { color: '#FFFFFF' } : { color: '#1E293B' }
              ]}>
                {msg.content}
              </Text>
              {msg.role === "assistant" && msg.content && (
                <Text style={styles.tokenInfo}>
                  {tokensPerSecond[Math.floor(index / 2)] ? 
                    `${tokensPerSecond[Math.floor(index / 2)]} tokens/s` : 
                    'Processing...'}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#94A3B8"
            value={userInput}
            onChangeText={setUserInput}
            editable={!isGenerating}
          />
          <View style={styles.buttonRow}>
            {isGenerating ? (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: '#EF4444' }]}
                onPress={stopGeneration}>
                <Text style={styles.buttonText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => handleSendMessage()}
                disabled={isGenerating}>
                <Text style={styles.buttonText}>Send</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
  tokenInfo: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "right",
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
    <ModelProvider>
      <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isModelReady ? 'Home' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ModelProvider>
  );
} 