// Helper para obtener la fecha de hoy en RD en formato YYYY-MM-DD
const rdTodayDateString = (): string => {
	const fmt: Intl.DateTimeFormat = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Santo_Domingo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	// en-CA -> YYYY-MM-DD
	return fmt.format(new Date());
};

export default rdTodayDateString;
