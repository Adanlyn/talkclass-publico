export function stripCpf(value: string): string {
  return (value || '').replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(value: string): string {
  const digits = stripCpf(value);
  if (!digits) return '';

  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  if (digits.length <= 3) return part1;
  if (digits.length <= 6) return `${part1}.${part2}`;
  if (digits.length <= 9) return `${part1}.${part2}.${part3}`;
  return `${part1}.${part2}.${part3}-${part4}`;
}

export function isValidCpf(value: string): boolean {
  const digits = stripCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(digits[i]) * (len + 1 - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const first = calcDigit(9);
  const second = calcDigit(10);
  return Number(digits[9]) === first && Number(digits[10]) === second;
}
