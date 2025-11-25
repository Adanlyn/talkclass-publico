import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/feedbacks', () => HttpResponse.json([{ id: 1, categoria: 'Infraestrutura', media: 4.2 }])),
  http.post('/feedbacks', async ({ request }) => {
    const body = await request.json();
    if (typeof body === 'object' && body !== null) {
      return HttpResponse.json({ id: Date.now(), ...body }, { status: 201 });
    }
    return HttpResponse.json({ error: 'Body inválido' }, { status: 400 });
  }),
];
