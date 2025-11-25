// src/theme.ts
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'orange',
  fontFamily: 'Montserrat, system-ui, Arial, sans-serif',
  defaultRadius: 'md',
  colors: {
    orange: ['#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412','#7c2d12'],
    sand:   ['#f7f0ea','#efe3d9','#e5d3c4','#d9bea8','#caa585','#b98a65','#a06f4f','#835a41','#6a4b39','#4f372c'],
    cocoa:  ['#f1efee','#e2dedc','#c5bdb9','#a79b95','#887a73','#6a5e58','#514742','#3d3531','#2b231f','#1f1b18'], // 9 = topo
  },
});
