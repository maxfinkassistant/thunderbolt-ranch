/* "2¾" with the fraction set smaller than the whole number. */

import { steerCountParts } from "../lib/availability";

export default function SteerCount({ n }: { n: number }) {
  const { whole, frac } = steerCountParts(n);
  return (
    <>
      {whole}
      {frac && <span className="frac">{frac}</span>}
    </>
  );
}
