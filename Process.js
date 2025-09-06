process.on("uncaughtException", (err) => {
	console.error("uncaughtException:", safeErr(err));
});
process.on("unhandledRejection", (reason, p) => {
	console.error("unhandledRejection at:", p, "reason:", safeErr(reason));
});
