declare global {
	namespace App {
		interface Locals {
			phone: string | null;
			base: string | null;
			userBases: string[];
		}
	}
}

export {};
