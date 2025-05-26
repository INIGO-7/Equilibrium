import { openDatabase } from 'react-native-sqlite-storage';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Tokenizer } from 'tokenizers'; // JS‑only bindings that work in RN

/**
 * RAG service — local (on‑device) inference + SQLite persistence.
 * Only minimal changes were made to make the class work with
 * react‑native‑onnxruntime and an on‑device Sentence‑Transformers model.
 */
class RAGService {
  constructor() {
    this.db = null;
    this.session = null;          // ONNX inference session
    this.tokenizer = null;        // HF tokenizer
    this.isInitialized = false;
    this.isInitializing = false;

    // Asset‑relative paths (kept in the project’s /assets or /android_asset/)
    this.modelPath = 'models/paraphrase-multilingual-MiniLM-L12-v2/model.onnx';
    this.tokenizerPath = 'models/paraphrase-multilingual-MiniLM-L12-v2/tokenizer.json';
    this.dbName = 'mental_health.db';
  }

  /** Initialise everything (idempotent) */
  async initialize(databasePath = null) {
    if (this.isInitialized) return;
    if (this.isInitializing) {
      // wait for the first caller to finish
      while (this.isInitializing) await new Promise(r => setTimeout(r, 50));
      return;
    }
    this.isInitializing = true;
    try {
      console.log('🚀 Initialising RAG service…');
      await this.initializeEmbeddingModel();
      await this.initializeDatabase(databasePath);
      this.isInitialized = true;
      console.log('✅ RAG service initialised');
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Load the tokenizer JSON and create the ONNX Runtime session.
   * We avoid Tokenizer.fromFile() because it relies on the Node fs API.
   */
  async initializeEmbeddingModel() {
    console.log('📥 Loading tokenizer & ONNX model…');

    // --- tokenizer --------------------------------------------------------
    const tokenizerJson = await this._loadAsset(this.tokenizerPath, 'utf8');
    this.tokenizer = await Tokenizer.fromString(tokenizerJson);

    // --- model ------------------------------------------------------------
    const modelURI = this._resolveModelURI(this.modelPath);
    this.session = await InferenceSession.create(modelURI, {
      executionProviders: ['cpu'] // mobile only supports CPU at the moment
    });

    console.log('✅ Embedding model ready');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Embeddings
  // ──────────────────────────────────────────────────────────────────────────

  /** Return a normalised embedding for the supplied text. */
  async embedText(text) {
    if (!this.session || !this.tokenizer) {
      throw new Error('RAGService not initialised');
    }

    // Tokenise
    const encoded = this.tokenizer.encode(text);
    const ids32 = Int32Array.from(encoded.ids);
    const mask32 = Int32Array.from(encoded.attentionMask ?? new Array(ids32.length).fill(1));

    // ONNX Runtime mobile doesn’t accept JS BigInt literals, so we build the
    // int64 tensors manually.
    const ids64 = new BigInt64Array(ids32.length);
    const mask64 = new BigInt64Array(mask32.length);
    for (let i = 0; i < ids32.length; ++i) {
      ids64[i] = BigInt(ids32[i]);
      mask64[i] = BigInt(mask32[i]);
    }

    const feeds = {
      input_ids: new Tensor('int64', ids64, [1, ids64.length]),
      attention_mask: new Tensor('int64', mask64, [1, mask64.length])
    };

    const outputMap = await this.session.run(feeds);
    const firstKey = Object.keys(outputMap)[0];
    const outTensor = outputMap['sentence_embedding'] // SBERT export
      ?? outputMap['last_hidden_state']               // fallback (pre‑pool)
      ?? outputMap[firstKey];

    // If the model already produced a pooled vector we’re done
    let vector;
    if (outTensor.dims.length === 2) {
      vector = outTensor.data; // [1, hidden]
    } else {
      // Mean‑pool token embeddings → sentence embedding
      const [_, seqLen, hidden] = outTensor.dims;
      const sum = new Float32Array(hidden);
      for (let i = 0; i < seqLen; ++i) {
        for (let j = 0; j < hidden; ++j) {
          sum[j] += outTensor.data[i * hidden + j];
        }
      }
      vector = sum.map(v => v / seqLen);
    }

    // L2‑normalise
    const norm = Math.hypot(...vector);
    return Array.from(vector.map(v => v / (norm || 1)));
  }

  /**
   * Initialize the SQLite database
   */
  async initializeDatabase(databasePath = null) {
    return new Promise((resolve, reject) => {
      try {
        console.log('📂 Opening database...');
        
        const dbConfig = databasePath 
          ? { name: databasePath, location: 'Documents' }
          : { name: this.dbName, 
            createFromLocation: 1,
            location: 'default'
          };

        this.db = openDatabase(
          dbConfig,
          () => {
            console.log('✅ Database opened successfully');
            this.verifyDatabaseStructure()
              .then(() => resolve())
              .catch(reject);
          },
          (error) => {
            console.error('❌ Failed to open database:', error);
            reject(error);
          }
        );
      } catch (error) {
        console.error('❌ Database initialization error:', error);
        reject(error);
      }
    });
  }

  /**
   * Verify database structure
   */
  async verifyDatabaseStructure() {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('documents', 'collections')",
          [],
          (tx, results) => {
            const tables = [];
            for (let i = 0; i < results.rows.length; i++) {
              tables.push(results.rows.item(i).name);
            }
            
            if (tables.includes('documents') && tables.includes('collections')) {
              console.log('✅ Database structure verified');
              resolve();
            } else {
              reject(new Error(`Missing required tables. Found: ${tables.join(', ')}`));
            }
          },
          (tx, error) => {
            console.error('❌ Database structure verification failed:', error);
            reject(error);
          }
        );
      });
    });
  }

  /**
   * Generate embedding for a text using on-device ONNX model
   */
  async embedText(text) {
    if (!this.session || !this.tokenizer) {
      throw new Error('RAG Service not initialized. Call initialize() first.');
    }

    try {
      // Tokenize input text
      const encoded = this.tokenizer.encode(text);
      const inputIds = Int32Array.from(encoded.ids);
      const attentionMask = Int32Array.from(encoded.attentionMask);

      // Prepare ONNX inputs
      const feeds = {
        input_ids: new Tensor('int64', inputIds, [1, inputIds.length]),
        attention_mask: new Tensor('int64', attentionMask, [1, attentionMask.length])
      };

      // Run inference
      const results = await this.session.run(feeds);
      const output = results['last_hidden_state'] || results[Object.keys(results)[0]];

      // output.dims = [1, seqLen, hiddenSize]
      const [batch, seqLen, hiddenSize] = output.dims;
      const data = output.data;

      // Mean pooling over sequence dimension
      const sumVec = new Float32Array(hiddenSize);
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < hiddenSize; j++) {
          sumVec[j] += data[i * hiddenSize + j];
        }
      }
      const meanVec = sumVec.map(v => v / seqLen);

      // Normalize vector
      const norm = Math.sqrt(meanVec.reduce((acc, v) => acc + v * v, 0));
      const normalized = meanVec.map(v => (norm > 0 ? v / norm : 0));

      return Array.from(normalized);
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Convert blob to embedding array
   */
  blobToEmbedding(blob) {
    // Convert blob to Float32Array then to regular array
    const buffer = new ArrayBuffer(blob.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < blob.length; i++) {
      view[i] = blob.charCodeAt(i);
    }
    const float32Array = new Float32Array(buffer);
    return Array.from(float32Array);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('RAG Service not initialized. Call initialize() first.');
    }

    const {
      topK = 5,
      threshold = 0.0,
      collectionName = null,
      includeEmbeddings = false
    } = options;

    try {
      console.log(`🔍 Searching for: "${query.substring(0, 50)}..."`);

      // Generate query embedding
      const queryEmbedding = await this.embedText(query);

      // Search in database
      const results = await this.performSimilaritySearch(
        queryEmbedding, 
        topK, 
        threshold, 
        collectionName,
        includeEmbeddings
      );

      console.log(`✅ Found ${results.length} similar documents`);
      return results;

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Perform similarity search in database
   */
  async performSimilaritySearch(queryEmbedding, topK, threshold, collectionName, includeEmbeddings) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT id, content, embedding, metadata, collection_name FROM documents';
      let params = [];

      if (collectionName) {
        sql += ' WHERE collection_name = ?';
        params.push(collectionName);
      }

      this.db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (tx, results) => {
            const similarities = [];

            for (let i = 0; i < results.rows.length; i++) {
              const row = results.rows.item(i);
              
              try {
                // Convert blob to embedding
                const docEmbedding = this.blobToEmbedding(row.embedding);
                
                // Calculate similarity
                const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);

                if (similarity >= threshold) {
                  const result = {
                    id: row.id,
                    content: row.content,
                    metadata: JSON.parse(row.metadata || '{}'),
                    collectionName: row.collection_name,
                    similarity: similarity
                  };

                  if (includeEmbeddings) {
                    result.embedding = docEmbedding;
                  }

                  similarities.push(result);
                }
              } catch (embeddingError) {
                console.warn(`⚠️ Failed to process document ${row.id}:`, embeddingError);
              }
            }

            // Sort by similarity (descending) and limit results
            similarities.sort((a, b) => b.similarity - a.similarity);
            const topResults = similarities.slice(0, topK);

            resolve(topResults);
          },
          (tx, error) => {
            console.error('❌ Database search error:', error);
            reject(error);
          }
        );
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.isInitialized) {
      throw new Error('RAG Service not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        // Get collection stats
        tx.executeSql(
          'SELECT * FROM collections',
          [],
          (tx, results) => {
            const collections = [];
            for (let i = 0; i < results.rows.length; i++) {
              collections.push(results.rows.item(i));
            }

            // Get total document count
            tx.executeSql(
              'SELECT COUNT(*) as total_documents FROM documents',
              [],
              (tx, countResults) => {
                const totalDocuments = countResults.rows.item(0).total_documents;

                resolve({
                  totalDocuments,
                  collections,
                  modelName: this.modelName,
                  isInitialized: this.isInitialized
                });
              },
              (tx, error) => {
                reject(error);
              }
            );
          },
          (tx, error) => {
            reject(error);
          }
        );
      });
    });
  }

  /**
   * Perform retrieval - search and generate context
   */
  async retrieval(query, options = {}) {
    const {
      topK = 3,
      threshold = 0.1,
      collectionName = null,
      maxContextLength = 2000
    } = options;

    try {
      // Search for similar documents
      const similarDocs = await this.searchSimilar(query, {
        topK,
        threshold,
        collectionName
      });

      // Build context from similar documents
      let context = '';
      let contextLength = 0;
      const usedDocs = [];

      for (const doc of similarDocs) {
        const docText = `${doc.content}\n\n`;
        
        if (contextLength + docText.length <= maxContextLength) {
          context += docText;
          contextLength += docText.length;
          usedDocs.push({
            id: doc.id,
            similarity: doc.similarity,
            collectionName: doc.collectionName
          });
        } else {
          break;
        }
      }

      return {
        query,
        context: context.trim(),
        contextLength,
        documentsUsed: usedDocs,
        totalDocumentsFound: similarDocs.length
      };

    } catch (error) {
      console.error('❌ RAG operation failed:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.extractor = null;
    this.isInitialized = false;
    console.log('🔒 RAG Service closed');
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId) {
    if (!this.isInitialized) {
      throw new Error('RAG Service not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT id, content, metadata, collection_name FROM documents WHERE id = ?',
          [documentId],
          (tx, results) => {
            if (results.rows.length > 0) {
              const row = results.rows.item(0);
              resolve({
                id: row.id,
                content: row.content,
                metadata: JSON.parse(row.metadata || '{}'),
                collectionName: row.collection_name
              });
            } else {
              resolve(null);
            }
          },
          (tx, error) => {
            reject(error);
          }
        );
      });
    });
  }

  /** Read a bundled asset on both platforms. */
  async _loadAsset(relativePath, encoding = 'utf8') {
    if (Platform.OS === 'ios') {
      return RNFS.readFile(`${RNFS.MainBundlePath}/${relativePath}`, encoding);
    }
    // Android (assets packaged under android_asset)
    return RNFS.readFileAssets(relativePath, encoding);
  }

  /** Convert an asset‑relative path to a URI accepted by ONNX Runtime. */
  _resolveModelURI(relativePath) {
    if (Platform.OS === 'ios') {
      return `${RNFS.MainBundlePath}/${relativePath}`;
    }
    return `file:///android_asset/${relativePath}`;
  }
}

// Export singleton instance
export default new RAGService();