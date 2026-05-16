export interface FuelCard {
	serial: string;
	cardName: string;
	cardType: string;
	totalUsedLiters: number;
	usedLiters: number;
	remainingLiters: number;
	lastUsedDate: string;
	isActive: boolean;
	transactions: FuelTransaction[];
}

export interface FuelTransaction {
	vehicleNumber: string;
	fuelType: string;
	transactionType: string;
	date: string;
	time: string;
	stationName: string;
	branchNumber: string;
	serialNumber: string;
	litersOrCost: number;
}

export interface SavedCard {
	id: string;
	holderName: string;
	lastFetched: string;
	data: FuelCard;
}

export interface ApiError {
	message: string;
	code?: string;
}
