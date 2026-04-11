import type { OneOf } from "@chiballc/types";

type Operation = "<" | ">" | "=";
type Comparator<T> = (item: T, operation: Operation) => boolean;
type SearchTarget<T> = OneOf<[T, Comparator<T>]>;

export function binarySearch<T>(arr: Array<T>, target: T): number;
export function binarySearch<T>(
	arr: Array<T>,
	comparator: Comparator<T>,
): number;
export function binarySearch<T>(
	arr: Array<T>,
	target: SearchTarget<T>,
): number {
	let low = 0;
	let high = arr.length - 1;

	const isComparator = typeof target === "function";

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const midVal = arr[mid];
		if (!midVal) {
			return -1;
		}

		if (isComparator) {
			if (target(midVal, "=")) {
				return mid;
			} else if (target(midVal, "<")) {
				low = mid + 1;
				continue;
			} else if (target(midVal, ">")) {
				high = mid - 1;
				continue;
			} else {
				console.warn("Invalid comparator function");
				return -1;
			}
		} else {
			if (midVal === target) {
				return mid;
			}

			if (midVal < target) {
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}
	}

	return -1;
}
