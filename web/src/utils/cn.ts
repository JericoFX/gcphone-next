export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export type ClassValue = string | undefined | null | false | 0 | ClassValue[];

export function clsx(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const inner = clsx(...input);
      if (inner) classes.push(inner);
    }
  }
  
  return classes.join(' ');
}
