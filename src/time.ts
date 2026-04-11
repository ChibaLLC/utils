type Unit = "hr" | "min" | "ms" | "s";
export function toMilliSeconds(time: number, unit: Unit) {
	switch (unit) {
		case "hr":
			return 1000 * 60 * 60 * time;
		case "min":
			return 1000 * 60 * time;
		case "s":
			return time * 1000;
		default:
			throw new Error("No time input unit specified");
	}
}

export function toSeconds(time: number, unit: Unit) {
	switch (unit) {
		case "hr":
			return time * 60 * 60;
		case "min":
			return time * 60;
		case "s":
			return time;
		default:
			throw new Error("No time input unit specified");
	}
}

export function sleep(ms: number) {
	return new Promise<undefined>((resolve) => setTimeout(resolve, ms));
}
