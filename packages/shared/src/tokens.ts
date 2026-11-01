/** Brand design tokens shared by web (Tailwind @theme) and mobile (StyleSheet). */
export const colors = {
  navy: '#102E5C',
  royal: '#2155A3',
  gold: '#F2BE35',
  white: '#FFFFFF',
  surface: '#F5F8FC',
  orange: '#E87832',
  ink: '#0F1B2D',
  muted: '#5B6B80',
  border: '#DCE3EE',
  success: '#1E7F4F',
  warning: '#9A6200',
  danger: '#B3261E',
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
