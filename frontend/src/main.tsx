import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';

import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './app/queryClient';
import { theme } from './theme';
import { NotificationsProvider } from './state/notifications';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

async function maybeEnableMocks() {
  // Habilite o MSW só quando VITE_ENABLE_MSW === 'true'
  if (import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' }, // garante caminho correto
    });
  }
}

maybeEnableMocks().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <MantineProvider theme={theme}>
      <Notifications position="bottom-right" autoClose={10000} zIndex={10000} />
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <RouterProvider router={router} />
        </NotificationsProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
});
