import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#3498db',
    success: '#2ecc71',
    warning: '#f39c12',
    error: '#e74c3c',
    surface: '#ffffff',
    background: '#f5f5f5',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onSurface: '#2c3e50',
    onBackground: '#2c3e50',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
  },
};