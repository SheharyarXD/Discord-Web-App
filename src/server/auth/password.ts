import bcrypt from "bcryptjs";

const COST = 12;

// Hash of a throwaway value, compared against when the user is unknown so that response
// time does not reveal whether an email exists.
const dummyHash = bcrypt.hash("not-a-real-password", COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  const ok = await bcrypt.compare(plain, hash ?? (await dummyHash));
  return hash !== null && ok;
}
