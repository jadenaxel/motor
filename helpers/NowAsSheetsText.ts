const NowAsSheetsText = (): string => {
	const d: Date = new Date();

	const pad = (n: number): string => String(n).padStart(2, "0");

	const yyyy: string = d.getFullYear().toString();
	const mm: string = pad(d.getMonth() + 1);
	const dd: string = pad(d.getDate());
	const HH: string = pad(d.getHours());
	const MM: string = pad(d.getMinutes());
	const SS: string = pad(d.getSeconds());

	return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
};

export default NowAsSheetsText;
