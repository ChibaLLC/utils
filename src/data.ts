import type { Keys, Ommit, PPick, Prettify, None } from "@chiballc/types";

/**
 * This function is used to convert a string to a truthy or falsy value.
 *
 * The truthy values are: `true`, `false` or the string itself.
 * The falsy values are: `null` and `undefined`.
 *
 * It takes care of trimming the string and converting it to lowercase.
 * It returns null, true, false, undefined or the original value.
 *
 *
 * @example
 *
 * Boolish("true") // true
 *
 * Boolish("FALSE") // false
 *
 * Boolish("null") // null
 *
 * Boolish("undefined") // undefined
 *
 * Boolish("hello") // "hello"
 *
 * Boolish("") // null
 *
 * Boolish(" ") // null
 *
 * Boolish("TRUE") // true
 *
 */
type MaybeValue<T> = T extends undefined
	? null | boolean | string | undefined | any
	: T;
export function Boolish<T = undefined>(val: any): MaybeValue<T> {
	if (typeof val !== "string") return val;
	val = val.trim();
	switch (true) {
		case val === "":
		case val === "null":
			return null as MaybeValue<T>;
		case val === "true":
			return true as MaybeValue<T>;
		case val === "false":
			return false as MaybeValue<T>;
		case val === "undefined":
			return undefined as MaybeValue<T>;
		default:
			return val;
	}
}

/**
 * This function is used to check if an object has a list of properties.
 *
 * It returns true if the object has all the properties, false otherwise.
 *
 * If `allowNullish` is set to true, it will also check if the property is truthy.
 *
 * @example
 *
 * const obj = {name: "John", age: 20, address: null}
 *
 * hasOwnProperties(obj, ["name", "age"]) // true
 *
 * hasOwnProperties(obj, ["name", "age", "sex"]) // false
 *
 * hasOwnProperties(obj, ["name", "age", "address"], {allowNullish: true}) // false
 */
export function hasOwnProperties<T extends Object>(
	obj: T | any,
	properties: (keyof T)[],
	{
		allowNullish,
		partial,
	}: {
		allowNullish?: boolean;
		partial?: boolean;
	} = {
		allowNullish: true,
		partial: false,
	},
): obj is T {
	if (!obj) return false;
	if (typeof obj !== "object") return false;
	const predicate = (property: keyof T) => {
		if (allowNullish)
			return Object.prototype.hasOwnProperty.call(obj, property);
		return (
			Object.prototype.hasOwnProperty.call(obj, property) &&
			Boolish<T>(obj[property])
		);
	};

	if (partial) {
		return properties.some(predicate);
	}

	return properties.every(predicate);
}

export function isEmpty<T extends Object | None>(obj: T | any): obj is None {
	if (!obj) return true;
	if (typeof obj !== "object") return true;
	if (Array.isArray(obj)) return obj.length === 0;
	if (obj instanceof Map) return obj.size === 0;
	if (obj instanceof Set) return obj.size === 0;

	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			return false;
		}
	}

	return true;
}

export function* keys<T>(obj: T | None, warn = true): Generator<keyof T> {
	if (obj instanceof Map) {
		return obj.keys();
	}

	if (obj instanceof Set) {
		return obj.keys();
	}

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			yield i as any;
		}
		return;
	}

	if (!obj) {
		return;
	}

	if (typeof obj !== "object") {
		if (warn) console.warn("None object passed to function.", obj);
		return;
	}

	for (const key in obj) {
		yield key;
	}
}

export function* entries<T, K extends keyof T>(
	obj: T | None,
	warn = true,
): Generator<[K, T[K]]> {
	if (obj instanceof Map) {
		return obj.entries();
	}

	if (obj instanceof Set) {
		return obj.entries();
	}

	for (const key of keys(obj, warn)) {
		// @ts-expect-error
		yield [key, obj[key]];
	}
}

export function* values<T, K extends keyof T>(
	obj: T | None,
	warn = true,
): Generator<T[K]> {
	if (obj instanceof Map) {
		return obj.values();
	}

	if (obj instanceof Set) {
		return obj.values();
	}

	for (const key of keys(obj, warn)) {
		// @ts-expect-error
		yield obj[key];
	}
}
// TODO: Perf need to go brr
export function omit<T extends object, K extends Keys<T>>(
	data: T,
	key?: K | Array<K>,
): Prettify<Ommit<T, K>> {
	if (!data) return data;
	if (!key) {
		return data as any;
	}

	const keysToRemove = new Set(Array.isArray(key) ? key : [key]);
	const result: any = {};

	// First, copy all properties
	for (const k in data) {
		if (Object.prototype.hasOwnProperty.call(data, k)) {
			result[k] = data[k];
		}
	}

	// Then remove the specified keys (including nested ones)
	for (const keyToRemove of keysToRemove) {
		if (typeof keyToRemove === "string" && keyToRemove.includes(".")) {
			// Handle nested path removal
			const keys = keyToRemove.split(".");
			let current = result;

			for (let i = 0; i < keys.length - 1; i++) {
				if (current && typeof current === "object" && keys[i]! in current) {
					current = current[keys[i]!];
				} else {
					break;
				}
			}

			if (current && typeof current === "object") {
				delete current[keys[keys.length - 1]!];
			}
		} else {
			// Handle top-level property removal
			delete result[keyToRemove];
		}
	}

	return result as Prettify<Ommit<T, K>>;
}

// Helper function to get nested property value
function getNestedValue<T extends object>(obj: T, path: string): any {
	return path.split(".").reduce((current: any, key: string) => {
		return current && current[key];
	}, obj);
}

// Helper function to set nested property value
function setNestedValue(obj: any, path: string, value: any): void {
	const keys = path.split(".");
	const lastKey = keys.pop()!;
	const target = keys.reduce((current: any, key: string) => {
		if (!(key in current)) {
			current[key] = {};
		}
		return current[key];
	}, obj);
	target[lastKey] = value;
}
export function pick<T extends object, K extends Keys<T>>(
	data: T,
	key: K | Array<K>,
): Prettify<PPick<T, K>> {
	if (!data) return {} as any;
	if (!key) {
		return data as any;
	}

	const keysToPick = Array.isArray(key) ? key : [key];

	// If picking a single nested property, return just the value
	if (
		keysToPick.length === 1 &&
		typeof keysToPick[0] === "string" &&
		keysToPick[0].includes(".")
	) {
		return getNestedValue(data, keysToPick[0]);
	}

	const result: any = {};

	for (const keyToPick of keysToPick) {
		if (typeof keyToPick === "string" && keyToPick.includes(".")) {
			// Handle nested property picking
			const value = getNestedValue(data, keyToPick);
			if (value !== undefined) {
				setNestedValue(result, keyToPick, value);
			}
		} else {
			// Handle top-level property picking
			if (Object.prototype.hasOwnProperty.call(data, keyToPick)) {
				// @ts-expect-error
				result[keyToPick] = data[keyToPick];
			}
		}
	}

	return result;
}
