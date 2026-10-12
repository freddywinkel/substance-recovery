/** Content-free local write generation, independent of wall-clock changes. */
export const BALANCE_EPOCH_KEY = "daily-balance-epoch";
export const INITIAL_BALANCE_EPOCH = "initial";
let currentEpoch = INITIAL_BALANCE_EPOCH;
export const getBalanceEpoch = () => currentEpoch;
export function setBalanceEpoch(epoch: string): void { currentEpoch = epoch; }
