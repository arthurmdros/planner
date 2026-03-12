// API Cache Service com IndexedDB
class APICache {
    constructor(databaseName = 'PlannerAPICache', version = 1) {
        this.databaseName = databaseName;
        this.version = version;
        this.db = null;
        this.cacheEnabled = true;
        this.defaultTTL = 5 * 60 * 1000; // 5 minutos
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.databaseName, this.version);

            request.onerror = () => {
                console.error('❌ Erro ao abrir API Cache IndexedDB:', request.error);
                this.cacheEnabled = false;
                resolve();
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ API Cache IndexedDB inicializado');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Cache para respostas de API
                if (!db.objectStoreNames.contains('api_responses')) {
                    const store = db.createObjectStore('api_responses', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('endpoint', 'endpoint', { unique: false });
                    console.log('✅ API responses store criado');
                }

                // Fila de operações offline
                if (!db.objectStoreNames.contains('offline_queue')) {
                    const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                    queueStore.createIndex('method', 'method', { unique: false });
                    console.log('✅ Offline queue store criado');
                }

                // Cache de dados do usuário
                if (!db.objectStoreNames.contains('user_data')) {
                    const userDataStore = db.createObjectStore('user_data', { keyPath: 'key' });
                    userDataStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('✅ User data store criado');
                }
            };
        });
    }

    // Gerar chave de cache baseada na URL e parâmetros
    generateCacheKey(endpoint, method = 'GET', params = {}) {
        const paramString = Object.keys(params)
            .sort()
            .map(key => `${key}=${JSON.stringify(params[key])}`)
            .join('&');
        return `${method}:${endpoint}:${paramString}`;
    }

    // Salvar resposta da API no cache
    async setCache(endpoint, data, method = 'GET', params = {}, ttl = this.defaultTTL) {
        if (!this.cacheEnabled || !this.db) return false;

        const key = this.generateCacheKey(endpoint, method, params);
        const cacheData = {
            key,
            endpoint,
            method,
            params,
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttl
        };

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['api_responses'], 'readwrite');
                const store = transaction.objectStore('api_responses');
                const request = store.put(cacheData);

                request.onsuccess = () => {
                    console.log(`✅ Cache salvo: ${key}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao salvar cache:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar cache:', error);
                resolve(false);
            }
        });
    }

    // Obter resposta do cache
    async getCache(endpoint, method = 'GET', params = {}) {
        if (!this.cacheEnabled || !this.db) return null;

        const key = this.generateCacheKey(endpoint, method, params);

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['api_responses'], 'readonly');
                const store = transaction.objectStore('api_responses');
                const request = store.get(key);

                request.onsuccess = () => {
                    const cached = request.result;
                    
                    if (!cached) {
                        resolve(null);
                        return;
                    }

                    // Verificar se o cache expirou
                    if (Date.now() > cached.expiresAt) {
                        this.deleteCache(key);
                        resolve(null);
                        return;
                    }

                    console.log(`📋 Cache hit: ${key}`);
                    resolve(cached.data);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao obter cache:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar cache:', error);
                resolve(null);
            }
        });
    }

    // Remover item específico do cache
    async deleteCache(key) {
        if (!this.cacheEnabled || !this.db) return;

        try {
            const transaction = this.db.transaction(['api_responses'], 'readwrite');
            const store = transaction.objectStore('api_responses');
            store.delete(key);
        } catch (error) {
            console.error('❌ Erro ao deletar cache:', error);
        }
    }

    // Limpar cache expirado
    async cleanExpiredCache() {
        if (!this.cacheEnabled || !this.db) return;

        const now = Date.now();
        
        try {
            const transaction = this.db.transaction(['api_responses'], 'readwrite');
            const store = transaction.objectStore('api_responses');
            const index = store.index('timestamp');
            const request = index.openCursor(IDBKeyRange.upperBound(now));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.expiresAt < now) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        } catch (error) {
            console.error('❌ Erro ao limpar cache expirado:', error);
        }
    }

    // Adicionar operação à fila offline
    async addToOfflineQueue(operation) {
        if (!this.cacheEnabled || !this.db) return false;

        const queueItem = {
            ...operation,
            timestamp: Date.now(),
            retryCount: 0
        };

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['offline_queue'], 'readwrite');
                const store = transaction.objectStore('offline_queue');
                const request = store.add(queueItem);

                request.onsuccess = () => {
                    console.log('📤 Operação adicionada à fila offline');
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao adicionar à fila offline:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar fila offline:', error);
                resolve(false);
            }
        });
    }

    // Obter operações da fila offline
    async getOfflineQueue() {
        if (!this.cacheEnabled || !this.db) return [];

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['offline_queue'], 'readonly');
                const store = transaction.objectStore('offline_queue');
                const index = store.index('timestamp');
                const request = index.getAll();

                request.onsuccess = () => {
                    resolve(request.result || []);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao obter fila offline:', request.error);
                    resolve([]);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar fila offline:', error);
                resolve([]);
            }
        });
    }

    // Remover operação da fila offline
    async removeFromOfflineQueue(id) {
        if (!this.cacheEnabled || !this.db) return false;

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['offline_queue'], 'readwrite');
                const store = transaction.objectStore('offline_queue');
                const request = store.delete(id);

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao remover da fila offline:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar fila offline:', error);
                resolve(false);
            }
        });
    }

    // Salvar dados do usuário
    async setUserData(key, data) {
        if (!this.cacheEnabled || !this.db) return false;

        const userData = {
            key,
            data,
            timestamp: Date.now()
        };

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['user_data'], 'readwrite');
                const store = transaction.objectStore('user_data');
                const request = store.put(userData);

                request.onsuccess = () => {
                    console.log(`💾 Dados do usuário salvos: ${key}`);
                    resolve(true);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao salvar dados do usuário:', request.error);
                    resolve(false);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar dados do usuário:', error);
                resolve(false);
            }
        });
    }

    // Obter dados do usuário
    async getUserData(key) {
        if (!this.cacheEnabled || !this.db) return null;

        return new Promise((resolve) => {
            try {
                const transaction = this.db.transaction(['user_data'], 'readonly');
                const store = transaction.objectStore('user_data');
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.data : null);
                };

                request.onerror = () => {
                    console.error('❌ Erro ao obter dados do usuário:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.error('❌ Erro ao acessar dados do usuário:', error);
                resolve(null);
            }
        });
    }

    // Limpar todos os caches
    async clearAll() {
        if (!this.cacheEnabled || !this.db) return;

        const stores = ['api_responses', 'offline_queue', 'user_data'];
        
        for (const storeName of stores) {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                store.clear();
            } catch (error) {
                console.error(`❌ Erro ao limpar ${storeName}:`, error);
            }
        }
        
        console.log('🗑️ Todos os caches limpos');
    }

    // Obter informações do cache
    getCacheInfo() {
        return {
            enabled: this.cacheEnabled,
            dbName: this.databaseName,
            version: this.version,
            supported: 'indexedDB' in window
        };
    }
}

// Exportar para uso global
window.APICache = APICache;
