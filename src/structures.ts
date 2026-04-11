interface QNode<T> {
	next?: QNode<T> | undefined;
	prev?: QNode<T> | undefined;
	data: T;
}

export class Queue<T> {
	private head: QNode<T> | null;
	private tail: QNode<T> | null;
	private _length: number;

	constructor() {
		this.head = null;
		this.tail = null;
		this._length = 0;
	}

	enqueue(data: T): void {
		const newNode: QNode<T> = { data, next: undefined, prev: undefined };
		if (!this.head) {
			this.head = this.tail = newNode;
			this._length = 1;
			return;
		}

		if (!this.tail) {
			this.tail = this.head;
		}

		newNode.prev = this.tail;
		this.tail.next = newNode;
		this.tail = newNode;
		this._length++;
	}

	dequeue(): T | null {
		if (!this.head) {
			return null;
		}

		const data = this.head.data;
		this.head = this.head.next || null;

		if (this.head) {
			this.head.prev = undefined;
		} else {
			this.tail = null;
		}
		if (this._length > 0) {
			this._length--;
		}

		return data;
	}

	get length(): number {
		return this._length;
	}
}

export abstract class Cache<K, V> {
	abstract get(key: K): V | undefined;
	abstract set(key: K, value: V): void;
	abstract has(key: K): boolean;
	abstract delete(key: K): boolean;
	abstract clear(): void;
	abstract size(): number;
}

export class LRUCache<K, V> implements Cache<K, V> {
	private maxSize: number;
	private cache: Map<K, V>;

	constructor(maxSize: number) {
		if (maxSize <= 0) {
			throw new Error("LRUCache size must be greater than 0");
		}
		this.maxSize = maxSize;
		this.cache = new Map();
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move key to the end (most recently used)
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			// Refresh key
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove least recently used
			const lruKey = this.cache.keys().next().value;
			if (lruKey !== undefined) {
				this.cache.delete(lruKey);
			}
		}
		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}

export class LRUTimeCache<K, V> implements Cache<K, V> {
	private cache: LRUCache<K, { value: V; timestamp: number; ttl: number }>;

	constructor(maxSize: number) {
		this.cache = new LRUCache(maxSize);
	}

	get(key: K): V | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			const now = Date.now();
			if (now - entry.timestamp < entry.ttl) {
				return entry.value;
			} else {
				this.cache.delete(key);
			}
		}
		return undefined;
	}

	/**
	 * Set a value in the cache with an optional TTL (default 60 seconds)
	 */
	set(key: K, value: V, ttl: number = 60000): void {
		this.cache.set(key, { value, timestamp: Date.now(), ttl });
	}

	has(key: K): boolean {
		return this.get(key) !== undefined;
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size();
	}

	update(key: K, value: V, ttl?: number): void {
		const entry = this.cache.get(key);
		if (entry) {
			this.cache.set(key, {
				value,
				timestamp: Date.now(),
				ttl: ttl ?? entry.ttl,
			});
		}
	}
}
