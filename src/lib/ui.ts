// Shared UI types for the general card / header components.
export type IconName = 'key' | 'book' | 'shield' | 'wifi' | 'flask' | 'spark' | 'mail' | 'check' | 'chat' | 'doc' | 'bolt' | 'clock' | 'user' | 'scale' | 'receipt' | 'compass' | 'wrench';
export type Accent = 'cyan' | 'magenta' | 'violet' | 'amber';
/** A colored label pill, e.g. a category. `tone` maps to the accent colors. */
export interface Badge { label: string; tone?: Accent; class?: string }
export interface Crumb { href?: string; label: string }
