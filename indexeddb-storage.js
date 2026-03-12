// IndexedDB Storage Service
class IndexedDBStorage {
    constructor(databaseName = 'PlannerDB', version = 1) {
        this.databaseName = databaseName;
        this.version = version;
        this.db = null;
        this.storageKey = 'planner_data';
        this.data = {};
    }

    async init() {
        return new Promise(async (resolve, reject) => {
            // Verificar suporte ao IndexedDB primeiro
            if (!IndexedDBStorage.isSupported()) {
                console.error('❌ IndexedDB não é suportado neste navegador');
                this.useLocalStorageFallback();
                resolve();
                return;
            }

            console.log('🔄 Inicializando IndexedDB...');
            
            // Garantir que o banco de dados exista
            const dbEnsured = await this.ensureDatabase();
            if (!dbEnsured) {
                console.error('❌ Não foi possível garantir o banco de dados');
                this.useLocalStorageFallback();
                resolve();
                return;
            }
            
            const request = indexedDB.open(this.databaseName, this.version);

            request.onerror = () => {
                console.error('❌ Erro ao abrir IndexedDB:', request.error);
                // Fallback para localStorage
                this.useLocalStorageFallback();
                resolve();
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB aberto/criado com sucesso');
                
                // Verificar se o object store existe, se não, tentar criar
                if (!this.db.objectStoreNames.contains('planner_data')) {
                    console.log('⚠️ Object store não encontrado, tentando upgrade...');
                    // Tentar fazer upgrade para criar o object store
                    this.upgradeDatabase().then(() => {
                        this.loadData().then(resolve);
                    }).catch(() => {
                        this.loadData().then(resolve);
                    });
                } else {
                    this.loadData().then(resolve);
                }
            };

            request.onupgradeneeded = (event) => {
                console.log('🔄 Upgrade necessário do IndexedDB...');
                const db = event.target.result;
                
                // Criar object store se não existir
                if (!db.objectStoreNames.contains('planner_data')) {
                    const objectStore = db.createObjectStore('planner_data', { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('key', 'key', { unique: true });
                    console.log('✅ Object store criado durante upgrade');
                } else {
                    console.log('✅ Object store já existe durante upgrade');
                }
            };

            request.onblocked = () => {
                console.warn('⚠️ IndexedDB bloqueado por outra conexão');
            };
        });
    }

    async upgradeDatabase() {
        return new Promise((resolve, reject) => {
            // Fechar conexão atual se existir
            if (this.db) {
                this.db.close();
            }

            // Tentar abrir com versão incrementada
            const newVersion = this.version + 1;
            const request = indexedDB.open(this.databaseName, newVersion);

            request.onerror = () => {
                console.error('❌ Erro ao fazer upgrade do IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.version = newVersion;
                console.log('✅ IndexedDB upgrade concluído com sucesso');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('🔄 Executando upgrade do IndexedDB...');
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('planner_data')) {
                    const objectStore = db.createObjectStore('planner_data', { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('key', 'key', { unique: true });
                    console.log('✅ Object store criado durante upgrade');
                }
            };

            request.onblocked = () => {
                console.warn('⚠️ Upgrade bloqueado por outra conexão');
            };
        });
    }

    useLocalStorageFallback() {
        console.log('⚠️ Usando localStorage como fallback');
        this.storageMode = 'localStorage';
        this.loadData();
    }

    async loadData() {
        if (this.storageMode === 'localStorage') {
            const stored = localStorage.getItem(this.storageKey);
            this.data = stored ? JSON.parse(stored) : {};
            return;
        }

        if (!this.db) {
            const stored = localStorage.getItem(this.storageKey);
            this.data = stored ? JSON.parse(stored) : {};
            return;
        }

        try {
            const transaction = this.db.transaction(['planner_data'], 'readonly');
            const objectStore = transaction.objectStore('planner_data');
            const request = objectStore.getAll();

            request.onsuccess = () => {
                const records = request.result;
                this.data = {};
                
                records.forEach(record => {
                    this.data[record.key] = record.value;
                });

                console.log('✅ Dados carregados do IndexedDB:', Object.keys(this.data).length, 'itens');
            };

            request.onerror = () => {
                console.error('❌ Erro ao carregar dados do IndexedDB:', request.error);
                this.loadLocalStorageFallback();
            };
        } catch (error) {
            console.error('❌ Erro ao acessar IndexedDB:', error);
            this.loadLocalStorageFallback();
        }
    }

    loadLocalStorageFallback() {
        const stored = localStorage.getItem(this.storageKey);
        this.data = stored ? JSON.parse(stored) : {};
        this.storageMode = 'localStorage';
    }

    async saveData() {
        if (this.storageMode === 'localStorage') {
            this.saveLocalData();
            return;
        }

        if (!this.db) {
            this.saveLocalData();
            return;
        }

        try {
            const transaction = this.db.transaction(['planner_data'], 'readwrite');
            const objectStore = transaction.objectStore('planner_data');

            // Limpar dados existentes
            const clearRequest = objectStore.clear();
            
            clearRequest.onsuccess = () => {
                // Inserir novos dados
                const promises = Object.entries(this.data).map(([key, value]) => {
                    return new Promise((resolve, reject) => {
                        const addRequest = objectStore.add({ key, value });
                        addRequest.onsuccess = resolve;
                        addRequest.onerror = reject;
                    });
                });

                Promise.all(promises).then(() => {
                    console.log('✅ Dados salvos no IndexedDB:', Object.keys(this.data).length, 'itens');
                }).catch(error => {
                    console.error('❌ Erro ao salvar dados no IndexedDB:', error);
                    this.saveLocalData();
                });
            };

            transaction.onerror = () => {
                console.error('❌ Erro na transação do IndexedDB:', transaction.error);
                this.saveLocalData();
            };
        } catch (error) {
            console.error('❌ Erro ao acessar IndexedDB:', error);
            this.saveLocalData();
        }
    }

    saveLocalData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        console.log('✅ Dados salvos no localStorage');
    }

    set(key, value) {
        this.data[key] = value;
        this.saveData();
    }

    get(key) {
        return this.data[key] || null;
    }

    remove(key) {
        delete this.data[key];
        this.saveData();
    }

    getAll() {
        return { ...this.data };
    }

    setAll(data) {
        this.data = { ...data };
        this.saveData();
    }

    async clearAll() {
        this.data = {};
        
        if (this.storageMode === 'localStorage') {
            localStorage.removeItem(this.storageKey);
            return;
        }

        if (!this.db) {
            localStorage.removeItem(this.storageKey);
            return;
        }

        try {
            const transaction = this.db.transaction(['planner_data'], 'readwrite');
            const objectStore = transaction.objectStore('planner_data');
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('✅ IndexedDB limpo');
            };

            request.onerror = () => {
                console.error('❌ Erro ao limpar IndexedDB:', request.error);
                localStorage.removeItem(this.storageKey);
            };
        } catch (error) {
            console.error('❌ Erro ao limpar IndexedDB:', error);
            localStorage.removeItem(this.storageKey);
        }
    }

    // Exportar dados para JSON
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    // Importar dados de JSON
    importData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            this.setAll(data);
            console.log('✅ Dados importados com sucesso');
            return true;
        } catch (error) {
            console.error('❌ Erro ao importar dados:', error);
            return false;
        }
    }

    // Método estático para criar e inicializar o banco de dados automaticamente
    static async createAndInit(databaseName = 'PlannerDB', version = 1) {
        const storage = new IndexedDBStorage(databaseName, version);
        
        try {
            await storage.init();
            console.log('✅ IndexedDB criado e inicializado com sucesso');
            return storage;
        } catch (error) {
            console.error('❌ Erro ao criar/inicializar IndexedDB:', error);
            throw error;
        }
    }

    // Verificar suporte ao IndexedDB
    static isSupported() {
        return 'indexedDB' in window && indexedDB !== null;
    }

    // Método para verificar e criar o banco de dados explicitamente
    async ensureDatabase() {
        if (!IndexedDBStorage.isSupported()) {
            console.error('❌ IndexedDB não é suportado');
            return false;
        }

        try {
            // Verificar se o banco já existe
            const databases = await indexedDB.databases();
            const dbExists = databases.some(db => db.name === this.databaseName);
            
            if (!dbExists) {
                console.log('🔄 Banco de dados não encontrado, criando novo...');
                // Criar banco diretamente sem chamar init() para evitar recursão
                return await this.createDatabase();
            } else {
                console.log('✅ Banco de dados já existe');
                return true;
            }
        } catch (error) {
            console.error('❌ Erro ao verificar/criar banco de dados:', error);
            return false;
        }
    }

    // Método para criar o banco de dados diretamente
    async createDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.databaseName, this.version);

            request.onerror = () => {
                console.error('❌ Erro ao criar banco de dados:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Banco de dados criado com sucesso');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                console.log('🔄 Criando estrutura do banco de dados...');
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('planner_data')) {
                    const objectStore = db.createObjectStore('planner_data', { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('key', 'key', { unique: true });
                    console.log('✅ Object store criado');
                }
            };
        });
    }

    // Obter informações de armazenamento
    getStorageInfo() {
        const info = {
            mode: this.storageMode || (this.db ? 'indexedDB' : 'localStorage'),
            itemCount: Object.keys(this.data).length,
            supported: IndexedDBStorage.isSupported()
        };

        if (this.db) {
            info.dbName = this.databaseName;
            info.version = this.version;
        }

        return info;
    }
}

// Exportar para uso global
window.IndexedDBStorage = IndexedDBStorage;
