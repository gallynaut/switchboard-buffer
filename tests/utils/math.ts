import * as anchor from "@project-serum/anchor";

export const ndn = (value: number) => {
  return new anchor.BN(value * Math.pow(10, 6));
};
