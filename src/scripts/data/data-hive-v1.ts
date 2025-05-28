import { world } from "@minecraft/server";

/**
 * A modular database class for managing key-value pairs using dynamic properties.
 * Optimized for Minecraft Bedrock Edition scripting.
 */
export class OptimizedDatabaseV1 {
    private name: string;
    private pointerKey: string;
    private cachedPointers: string[] | null = null;

    /**
     * Constructs an instance of OptimizedDatabase.
     * @param name - The name of the database. Must be unique, non-empty, and follow specific constraints.
     * @throws Will throw an error if the name is empty or contains invalid characters.
     * 
     * @example
     * const db = new OptimizedDatabase('myDatabase');
     */
    constructor(name: string) {
        if (!name || name.length === 0) {
            throw new Error("Database name cannot be empty.");
        }
        if (name.includes('"') || name.includes("/")) {
            throw new Error('Database name cannot include the characters `"` or `/`.');
        }
        this.name = name;
        this.pointerKey = `${this.name}/pointers`;

        // Initialize the pointers array if it doesn't exist.
        if (!world.getDynamicProperty(this.pointerKey)) {
            world.setDynamicProperty(this.pointerKey, JSON.stringify([]));
        }
    }

    /**
     * Retrieves the list of pointers stored in the database (cached).
     * @returns An array of strings representing the dynamic keys in the database.
     */
    private _getPointers(): string[] {
        if (this.cachedPointers !== null) {
            return this.cachedPointers;
        }
        const pointers = world.getDynamicProperty(this.pointerKey) as string | null;
        this.cachedPointers = pointers ? JSON.parse(pointers) : [];
        return this.cachedPointers;
    }

    /**
     * Updates the list of pointers in the database.
     * @param pointers - An array of strings representing the dynamic keys to store.
     */
    private _setPointers(pointers: string[]): void {
        this.cachedPointers = pointers; // Cache the pointers
        world.setDynamicProperty(this.pointerKey, JSON.stringify(pointers));
    }

    /**
     * Stores a key-value pair in the database.
     * If the value exceeds the dynamic property size limit, it will be split into multiple chunks.
     * @param key - The key to store the value under. Must be unique within the database.
     * @param value - The value to associate with the key. Must be serializable to JSON.
     * 
     * @example
     * db.set('key1', { name: 'item', value: 100 });
     */
    public set(key: string, value: any): boolean {
        const serialized = JSON.stringify(value);
        const maxChunkSize = 30000; // Safe estimated size limit per chunk

        const pointers = this._getPointers();
        const dynamicKey = `${this.name}/${key}`;
        let dataExists = false;

        // Remove existing chunks if the key already exists
        if (pointers.includes(dynamicKey)) {
            this.delete(key);
            dataExists = true;
        }

        const chunkCount = Math.ceil(serialized.length / maxChunkSize);

        if (chunkCount > 1) {
            for (let i = 0; i < chunkCount; i++) {
                const chunk = serialized.substring(i * maxChunkSize, (i + 1) * maxChunkSize);
                world.setDynamicProperty(`${dynamicKey}_part${i}`, chunk);
            }
            world.setDynamicProperty(dynamicKey, chunkCount.toString()); // Store chunk count
        } else {
            world.setDynamicProperty(dynamicKey, serialized);
        }

        if (!pointers.includes(dynamicKey)) {
            pointers.push(dynamicKey);
            this._setPointers(pointers);
        }
        return dataExists;
    }

    /**
     * Retrieves a value associated with a given key.
     * If the value was stored in chunks, it will be reconstructed.
     * @param key - The key to retrieve the value for.
     * @returns The value associated with the key, or `undefined` if the key does not exist.
     * 
     * @example
     * const value = db.get('key1');
     * console.log(value); // { name: 'item', value: 100 }
     */
    public get<T = any>(key: string): T | undefined {
        const dynamicKey = `${this.name}/${key}`;
        const meta = world.getDynamicProperty(dynamicKey) as string | null;

        if (!meta) return undefined; // Key not found

        if (/^\d+$/.test(meta)) { // Check if it's chunk count
            const chunkCount = parseInt(meta, 10);
            let fullData = "";
            for (let i = 0; i < chunkCount; i++) {
                const part = world.getDynamicProperty(`${dynamicKey}_part${i}`) as string | null;
                if (part) fullData += part;
            }
            return JSON.parse(fullData) as T;
        } else {
            return JSON.parse(meta) as T;
        }
    }

    /**
     * Deletes a key-value pair from the database.
     * If the value was stored in chunks, all related chunks will be removed.
     * @param key - The key to delete from the database.
     * 
     * @example
     * db.delete('key1');
     */
    public delete(key: string): void {
        const pointers = this._getPointers();
        const dynamicKey = `${this.name}/${key}`;
        const meta = world.getDynamicProperty(dynamicKey) as string | null;

        if (pointers.includes(dynamicKey)) {
            if (/^\d+$/.test(meta || "")) { // If chunked data
                const chunkCount = parseInt(meta!, 10);
                for (let i = 0; i < chunkCount; i++) {
                    world.setDynamicProperty(`${dynamicKey}_part${i}`, null);
                }
            }
            world.setDynamicProperty(dynamicKey, null);
            this._setPointers(pointers.filter(ptr => ptr !== dynamicKey));
        }
    }

    /**
     * Clears all key-value pairs from the database.
     * 
     * @example
     * db.clear(); // Clears all entries in the database
     */
    public clear(): void {
        const pointers = this._getPointers();
        pointers.forEach((dynamicKey) => {
            const meta = world.getDynamicProperty(dynamicKey) as string | null;
            if (/^\d+$/.test(meta || "")) { // If chunked data
                const chunkCount = parseInt(meta!, 10);
                for (let i = 0; i < chunkCount; i++) {
                    world.setDynamicProperty(`${dynamicKey}_part${i}`, null);
                }
            }
            world.setDynamicProperty(dynamicKey, null);
        });
        this._setPointers([]);
    }

    /**
     * Retrieves all entries (key-value pairs) in the database.
     * @returns An array of tuples where each tuple contains a key and its associated value.
     * 
     * @example
     * const entries = db.entries();
     * console.log(entries); // [['key1', { name: 'item', value: 100 }], ['key2', { name: 'another item', value: 50 }]]
     */
    public entries(): [string, any][] {
        return this._getPointers().map((ptr) => {
            const key = ptr.split("/").pop()!; // Extract the actual key
            const value = this.get(key);
            return [key, value];
        });
    }
}