import { openDatabase } from 'react-native-sqlite-storage';
import { pipeline } from '@fugood/transformers'

class RAGService {
  constructor() {
    this.db = null;
    this.extractor = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
    this.dbName = 'mental_health.db';
  }

  /**
   * Initialize the RAG service - loads embedding model and opens database
   */
  async initialize(databasePath = null) {
    if (this.isInitialized) {
      console.log('RAG Service already initialized');
      return;
    }

    if (this.isInitializing) {
      console.log('RAG Service initialization in progress...');
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🚀 Initializing RAG Service...');

      // Initialize embedding model
      await this.initializeEmbeddingModel();

      // Initialize database
      await this.initializeDatabase(databasePath);

      this.isInitialized = true;
      this.isInitializing = false;
      console.log('✅ RAG Service initialized successfully!');

    } catch (error) {
      this.isInitializing = false;
      console.error('❌ Failed to initialize RAG Service:', error);
      throw error;
    }
  }

  /**
   * Initialize the embedding model
   */
  async initializeEmbeddingModel() {
    try {
      console.log('📥 Loading embedding model...');
      this.extractor = await pipeline(
        'feature-extraction', 
        this.modelName,
        {
          // quantized: true, // Use quantized model for better performance
          progress_callback: (progress) => {
            if (progress.status === 'downloading') {
              console.log(`📥 Downloading model: ${Math.round(progress.progress || 0)}%`);
            }
          }
        }
      );
      console.log('✅ Embedding model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load embedding model:', error);
      throw error;
    }
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
   * Generate embedding for a text
   */
  async embedText(text) {
    if (!this.isInitialized || !this.extractor) {
      throw new Error('RAG Service not initialized. Call initialize() first.');
    }

    try {
      const result = await this.extractor(text, {
        pooling: 'mean',
        normalize: true
      });
      
      return Array.from(result.data);
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
}

// Export singleton instance
export default new RAGService();