export function decimalToScaled(value: string, scale: number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value);
  if (!match) {
    return 0n;
  }

  const fraction = (match[3] ?? '').padEnd(scale, '0');
  const scaled = BigInt(match[2]) * 10n ** BigInt(scale) +
    BigInt(fraction.slice(0, scale) || '0');
  return match[1] ? -scaled : scaled;
}

export function scaledToDecimal(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = String(absolute % divisor).padStart(scale, '0');
  return `${sign}${whole}.${fraction}`;
}

export function multiplyDecimalsToSix(quantity: string, amount: string): string {
  const quantityMilli = decimalToScaled(quantity, 3);
  const amountMicros = decimalToScaled(amount, 6);
  const product = quantityMilli * amountMicros;
  const divisor = 1000n;
  const rounded = (product + (product >= 0n ? divisor / 2n : -(divisor / 2n))) / divisor;
  return scaledToDecimal(rounded, 6);
}

export function multiplyDecimalValuesToSix(left: string, right: string): string {
  const leftMicros = decimalToScaled(left, 6);
  const rightMicros = decimalToScaled(right, 6);
  const product = leftMicros * rightMicros;
  const divisor = 1_000_000n;
  const rounded = (product + (product >= 0n ? divisor / 2n : -(divisor / 2n))) / divisor;
  return scaledToDecimal(rounded, 6);
}

export function divideDecimalsToSix(dividend: string, divisor: string): string {
  const scaledDividend = decimalToScaled(dividend, 6);
  const scaledDivisor = decimalToScaled(divisor, 6);
  if (scaledDivisor === 0n) {
    return '0.000000';
  }

  const numerator = scaledDividend * 10n ** 6n;
  const quotient = numerator / scaledDivisor;
  const remainder = numerator % scaledDivisor;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const absoluteDivisor = scaledDivisor < 0n ? -scaledDivisor : scaledDivisor;
  const shouldRound = absoluteRemainder * 2n >= absoluteDivisor;
  const positiveResult = (numerator < 0n) === (scaledDivisor < 0n);
  const rounded = quotient + (shouldRound ? (positiveResult ? 1n : -1n) : 0n);
  return scaledToDecimal(rounded, 6);
}

export function sumDecimals(values: string[], scale = 6): string {
  const total = values.reduce((sum, value) => sum + decimalToScaled(value, scale), 0n);
  return scaledToDecimal(total, scale);
}
