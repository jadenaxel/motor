const ParseAmount = (input: string | null): number => {
	if (input == null) return NaN;
	let s: string = String(input).trim().toLowerCase();
	s = s.replace(/[^0-9.,km\-]/g, "");

	let multiplier: number = 1;
	if (s.endsWith("k")) {
		multiplier = 1_000;
		s = s.slice(0, -1);
	} else if (s.endsWith("m")) {
		multiplier = 1_000_000;
		s = s.slice(0, -1);
	}

	let numeric: string = s.replace(/,/g, "");
	let val: number = parseFloat(numeric);

	if (Number.isNaN(val)) {
		numeric = s.replace(/\./g, "").replace(/,/g, ".");
		val = parseFloat(numeric);
	}

	if (Number.isNaN(val)) return NaN;
	return val * multiplier;
};

export default ParseAmount;
