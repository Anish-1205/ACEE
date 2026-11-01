/**
 * Brand design tokens shared by web (Tailwind @theme) and mobile (StyleSheet).
 * Matched to www.aceereviewconsultants.com: dark blue headings/footer, crimson buttons, grey body text.
 */
export const colors = {
  navy: '#003A66',
  royal: '#004080',
  crimson: '#E02454',
  gold: '#F2BE35',
  white: '#FFFFFF',
  surface: '#F0F5FB',
  orange: '#E87832',
  ink: '#333333',
  muted: '#6B7A8F',
  border: '#DCE3EE',
  success: '#1E7F4F',
  warning: '#9A6200',
  danger: '#B3261E',
} as const;

export const radii = { sm: 8, md: 10, lg: 10, xl: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
