// frontend/js/storage.js

class StorageService {
    constructor() {
        this.dbName = 'SupermarketBI_DB';
        this.dbVersion = 1;
        this.storeName = 'analyses';
    }

    // Inicializa la base de datos IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);

            request.onsuccess = (e) => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    // Guarda un análisis
    async saveAnalysis(filename, data) {
        if (!this.db) await this.init();
        
        const timestamp = Date.now();
        const record = {
            id: timestamp,
            filename: filename,
            date: new Date().toISOString(),
            rows: data.rows,
            kpis: data.kpis, // Resumen rápido
            data: data // Todo el JSON gigante
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(record);

            request.onsuccess = () => {
                // Configurar como el análisis actual activo para verlo en el dashboard
                localStorage.setItem('currentAnalysisId', timestamp.toString());
                resolve(timestamp);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Obtiene toda la lista de historiales (sin cargar toda la data gigante a menos que se requiera)
    async getAllHistory() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                // Retornar la metadata ordenada desde la más reciente
                const items = request.result.map(r => ({
                    id: r.id,
                    filename: r.filename,
                    date: r.date,
                    rows: r.rows,
                    kpis: r.kpis
                })).sort((a,b) => b.id - a.id);
                resolve(items);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Borra un análisis del historial
    async deleteHistory(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(Number(id));

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Obtiene el análisis que está marcado como actual
    async getCurrentAnalysis() {
        const currentId = localStorage.getItem('currentAnalysisId');
        if (!currentId) return null;

        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(Number(currentId));

            request.onsuccess = () => {
                if (request.result) resolve(request.result.data);
                else resolve(null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    setCurrentAnalysisId(id) {
        localStorage.setItem('currentAnalysisId', id.toString());
    }
}

window.appStorage = new StorageService();
