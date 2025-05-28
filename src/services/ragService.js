import { enablePromise, openDatabase, SQLiteDatabase } from 'react-native-sqlite-storage';

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
    this.dbName = 'mental_health_llama32-1B_final.sqlite';
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
      this.isInitialized = true;
      console.log('✅ RAG service initialised');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error.message, error);
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
          name: this.dbName,
          location: 'default',
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

  async verifyDatabaseStructure() {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=='documents';",
          [],
          (_, results) => {
            const tables = [];
            for (let i = 0; i < results.rows.length; i++) {
              tables.push(results.rows.item(i).name);
            }
            if (tables.includes('documents')) {
              console.log('✅ Database structure verified');
              resolve();
            } else {
              reject(
                new Error(
                  `Missing required tables. Found: ${tables.join(', ')}`
                )
              );
            }
          },
          (_, error) => {
            console.error('❌ Database structure verification failed:', error);
            reject(error);
          }
        );
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Vector utilities
  // ──────────────────────────────────────────────────────────────────────
  /** Convert BLOB (stored Float32) → JS number[] */
  blobToEmbedding(blob) {
    if (blob instanceof ArrayBuffer) {
      return Array.from(new Float32Array(blob));
    } else if (blob.buffer instanceof ArrayBuffer) {
      return Array.from(new Float32Array(blob.buffer));
    } else {
      throw new Error("Unexpected blob data type");
    }
  }

  /** Cosine similarity (both vectors assumed same length) */
  cosineSimilarity(a, b) {
    if (a.length !== b.length)
      throw new Error('Vectors must have the same length');
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────
  /**
   * Search similar documents.
   * @param {string|number[]} query  Either a plain string **(unsupported here)**
   *                                 or a pre-computed embedding array.
   * @param {object} options         topK, threshold, collectionName, includeEmbeddings
   */
  async searchSimilar(embedding, options = {}) {
    if (!this.isInitialized)
      throw new Error('RAG Service not initialised. Call initialize() first.');

    console.log('Searching for the most similar documents to user query embedding')

    const {
      topK = 5,
      threshold = 0.7,
      includeEmbeddings = false
    } = options;

    const results = await this.performSimilaritySearch(
      embedding,
      topK,
      threshold,
      includeEmbeddings
    );

    console.log(`✅ Found ${results.length} similar documents`);
    return results;
  }

  /**
   * High-level Retrieval helper – builds a context window from top-K docs.
   * Accepts either a string (unsupported) or an embedding array.
   */
  async retrieval(query, options = {}) {
    const {
      topK = 3,
      threshold = 0.1,
      collectionName = null,
      maxContextLength = 2000
    } = options;

    const similarDocs = await this.searchSimilar(query, {
      topK,
      threshold,
      collectionName
    });

    let context = '';
    let ctxLen = 0;
    const used = [];

    for (const doc of similarDocs) {
      const chunk = `${doc.content}\n\n`;
      if (ctxLen + chunk.length > maxContextLength) break;
      context += chunk;
      ctxLen += chunk.length;
      used.push({
        id: doc.id,
        similarity: doc.similarity,
        collectionName: doc.collectionName
      });
    }

    return {
      query,
      context: context.trim(),
      contextLength: ctxLen,
      documentsUsed: used,
      totalDocumentsFound: similarDocs.length
    };
  }

  /** Close DB */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
    console.log('🔒 RAG Service closed');
  }

  /** Fetch single document by ID */
  async getDocument(documentId) {
    if (!this.isInitialized)
      throw new Error('RAG Service not initialised. Call initialize() first.');
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT id, content, metadata, collection_name FROM documents WHERE id = ?',
          [documentId],
          (_, results) => {
            if (results.rows.length)
              resolve({
                id: results.rows.item(0).id,
                content: results.rows.item(0).content,
                metadata: JSON.parse(results.rows.item(0).metadata || '{}'),
                collectionName: results.rows.item(0).collection_name
              });
            else resolve(null);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────
  // TODO: remove limit 100!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  async performSimilaritySearch(
    queryEmbedding,
    topK,
    threshold,
    includeEmbeddings
  ) {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT id, chunk_text, embedding FROM documents LIMIT 100`,
          params,
          (_, results) => {
            const sims = [];
            for (let i = 0; i < results.rows.length; i++) {
              const row = results.rows.item(i);
              try {
                const docVec = this.blobToEmbedding(row.embedding);
                const sim = this.cosineSimilarity(queryEmbedding, docVec);
                if (sim >= threshold) {
                  sims.push({
                    id: row.id,
                    content: row.chunk_text,
                    similarity: sim,
                    ...(includeEmbeddings ? { embedding: docVec } : {})
                  });
                }
              } catch (e) {
                console.warn(`⚠️  Skipping doc ${row.id}:`, e);
              }
            }
            sims.sort((a, b) => b.similarity - a.similarity);
            resolve(sims.slice(0, topK));
          },
          (_, error) => {
            console.error('❌ Database search error:', error);
            reject(error);
          }
        );
      });
    });
  }
}

// Export singleton
export default new RAGService();