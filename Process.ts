import { SafeError } from "./helpers/";

process.on("uncaughtException", (err: any) => {
	console.error("uncaughtException:", SafeError(err));
});

process.on("unhandledRejection", (reason: any, p: any) => {
	console.error("unhandledRejection at:", p, "reason:", SafeError(reason));
});
