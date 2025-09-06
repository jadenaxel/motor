const getActiveUserLabel = (session: any): string | null => {
	if (!session?.lockedUser) return null;
	return session.lockedUser === "KING" ? "Jose Manuel Polanco Nina" : "Victor Manuel Diaz";
};

export default getActiveUserLabel;
