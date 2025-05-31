import { openDatabase } from '@boltcode/react-native-sqlite-storage'

// DON'T use enablePromise(true) - use callbacks instead

/**
 * RAG service — local (on-device) similarity search + SQLite persistence.
 * ───────────────────────────────────────────────────────────────────────────
 *  ⚠️  This version expects *pre-computed* embeddings to be supplied by the
 *      caller.  No ONNX model or tokenizer is loaded here.
 * ───────────────────────────────────────────────────────────────────────────
 */
class RAGService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.isInitializing = false;

    // Bundled DB name (if you ship a starter DB with your app)
    this.dbName = 'mental_health_llama32-1B_final_II.sqlite';
  }

  // ──────────────────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────────────────
  async initialize() {
    if (this.isInitialized) return;

    if (this.isInitializing) {
      while (this.isInitializing) await new Promise(r => setTimeout(r, 50));
      return;
    }
  
    this.isInitializing = true;
  
    try {
      console.log('🚀 Initialising RAG service…');
      await this.initializeDatabase();
      
      // Add database validation
      await this.validateDatabase();
      
      this.isInitialized = true;
      console.log('✅ RAG service initialised');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error.message, error);
      throw error; // Re-throw to let caller handle
    } finally {
      this.isInitializing = false;
    } 
  }

  // ──────────────────────────────────────────────────────────────────────
  // SQLite
  // ──────────────────────────────────────────────────────────────────────
  async initializeDatabase() {
    console.log('📂 Opening database...');
    return new Promise((resolve, reject) => {
      this.db = openDatabase(
        {
          name: "mental_health_db",
          createFromLocation: "~www/" + this.dbName
        },
        () => {
          console.log('✅ Database opened successfully');
          resolve();
        },
        error => {
          console.error('❌ Failed to open database:', error.message, error);
          reject(error);
        }
      );
    });
  }

  // Add database validation method (Callback-based)
  async validateDatabase() {
    console.log('🔍 Validating database structure...');
    return new Promise((resolve, reject) => {
      this.db.executeSql(
        `SELECT COUNT(*) as count FROM documents`,
        [],
        (results) => {
          const count = results.rows.item(0).count;
          console.log(`📊 Found ${count} documents in database`);
          
          // Get a sample row to check structure
          this.db.executeSql(
            `SELECT id, chunk_text, embedding, typeof(embedding) as embedding_type, length(embedding) as embedding_size 
             FROM documents LIMIT 1`,
            [],
            (sampleResults) => {
              if (sampleResults.rows.length > 0) {
                const sample = sampleResults.rows.item(0);
                console.log('📋 Sample document structure:', {
                  id: sample.id,
                  text_length: sample.chunk_text?.length || 0,
                  embedding_type: sample.embedding_type,
                  embedding_size: sample.embedding_size,
                  embedding: JSON.parse(sample.embedding)
                });
              }
              console.log('✅ Database validation completed');
              resolve();
            },
            (error) => {
              console.error('❌ Error getting sample document:', error);
              reject(error);
            }
          );
        },
        (error) => {
          console.error('❌ Error validating database:', error);
          reject(error);
        }
      );
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Vector utilities
  // ──────────────────────────────────────────────────────────────────────
  /** Convert BLOB (stored Float32) → JS number[] */
  blobToEmbedding(blob) {
    try {
      if (blob instanceof ArrayBuffer) {
        return Array.from(new Float32Array(blob));
      } else if (blob && blob.buffer instanceof ArrayBuffer) {
        return Array.from(new Float32Array(blob.buffer));
      } else {
        console.warn('Unexpected blob type:', typeof blob, blob);
        throw new Error("Unexpected blob data type");
      }
    } catch (error) {
      console.error('Error converting blob to embedding:', error);
      throw error;
    }
  }

  /** Cosine similarity (both vectors assumed same length) */
  cosineSimilarity(a, b) {
    if (a.length !== b.length)
      throw new Error(`Vectors must have the same length: ${a.length} vs ${b.length}`);
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const similarity = dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
    return similarity;
  }

  /**
   * Search similar documents.
   * @param {number[]} embedding     Pre-computed embedding array
   * @param {object} options         topK, threshold, includeEmbeddings
   */
  async searchSimilar(embedding, options = {}) {
    if (!this.isInitialized)
      throw new Error('RAG Service not initialised. Call initialize() first.');

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.log('Input embedding: ', embedding);
      throw new Error('Invalid embedding: must be non-empty array');
    }

    console.log(`🔍 Searching for similar documents (embedding dim: ${embedding.length})`);

    const {
      topK = 5,
      threshold = 0.7,
      includeEmbeddings = false
    } = options;

    const startTime = Date.now();
    
    try {
      const results = await this.performSimilaritySearch(
        embedding,
        topK,
        threshold,
        includeEmbeddings
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Found ${results.length} similar documents in ${duration}ms`);
      return results;
    } catch (error) {
      console.error('❌ Error in similarity search:', error);
      throw error;
    }
  }

  async performSimilaritySearch(
    queryEmbedding,
    topK,
    threshold,
    includeEmbeddings
  ) {
    console.log('🔄 Starting similarity search...');
    
    return new Promise((resolve, reject) => {
      const searchStartTime = Date.now();
      
      this.db.executeSql(
        `SELECT id, chunk_text, embedding FROM documents`,
        [],
        (results) => {
          console.log(`📊 Retrieved ${results.rows.length} documents from database`);
          
          const sims = [];
          let processedCount = 0;
          let errorCount = 0;
          
          for (let i = 0; i < results.rows.length; i++) {
            try {
              const row = results.rows.item(i);
              
              // Log every 100th row to track progress
              if (i % 100 === 0) {
                console.log(`[DEBUG] Processing document ${i + 1}/${results.rows.length}`);
              }
              
              const docVec = JSON.parse(row.embedding);
              const sim = this.cosineSimilarity(queryEmbedding, docVec);
              
              if (sim >= threshold) {
                sims.push({
                  id: row.id,
                  content: row.chunk_text,
                  similarity: sim,
                  ...(includeEmbeddings ? { embedding: docVec } : {})
                });
              }
              
              processedCount++;
            } catch (e) {
              errorCount++;
              if (errorCount <= 5) { // Only log first 5 errors to avoid spam
                console.warn(`⚠️  Error processing doc ${i}:`, e.message);
              }
            }
          }
          
          console.log(`📈 Processed: ${processedCount}, Errors: ${errorCount}, Above threshold: ${sims.length}`);
          
          // Sort by similarity (highest first)
          sims.sort((a, b) => b.similarity - a.similarity);
          
          const finalResults = sims.slice(0, topK);
          const searchDuration = Date.now() - searchStartTime;
          
          console.log(`⚡ Search completed in ${searchDuration}ms`);
          console.log(`🎯 Top similarities:`, finalResults.map(r => ({ id: r.id, sim: r.similarity.toFixed(4) })));
          
          resolve(finalResults);
        },
        (error) => {
          console.error('❌ SQL execution error:', error);
          reject(error);
        }
      );
    });
  }

  // Add method to test database connectivity (Callback-based)
  async testDatabaseConnection() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      this.db.executeSql(
        'SELECT 1 as test',
        [],
        (results) => {
          console.log('✅ Database connection test passed');
          resolve(true);
        },
        (error) => {
          console.error('❌ Database connection test failed:', error);
          reject(error);
        }
      );
    });
  }
}

// Export singleton
export default new RAGService();