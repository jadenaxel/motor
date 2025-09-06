const getSheetNameForUser = (userId: string): string => (userId === "KING" ? "King" : "Zohan");

export default getSheetNameForUser;
