// src/components/layout/AdminTitleContext.tsx
import { createContext, useContext, useEffect } from 'react';

type Ctx = { title: string; setTitle: (t: string) => void };
export const AdminTitleContext = createContext<Ctx | null>(null);

export function useAdminTitle(title: string) {
  const ctx = useContext(AdminTitleContext);
  // se o contexto não existir, não falha: apenas ignora
  useEffect(() => {
    if (ctx) ctx.setTitle(title);
  }, [title]);
}
