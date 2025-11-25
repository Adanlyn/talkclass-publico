# TalkClass 🎓📊

Plataforma de escuta ativa para instituições de ensino: coleta feedbacks dos alunos, organiza perguntas por categorias, prioriza alertas e gera painéis/resumos com apoio de IA. Nasceu como TCC e está estruturada para servir como case de portfólio.

## Visão geral
- Formulário público para feedback (anônimo ou identificado).
- Catálogo de categorias/áreas/perguntas administrável.
- Dashboard com KPIs, filtros e distribuição de notas.
- Assistente de IA para interpretar dados (opcional via variável de ambiente).

## Tecnologias
- Frontend: React + TypeScript (Vite)
- API: .NET 8 (JWT, EF Core)
- IA: FastAPI + Google Gemini (opcional)
- Banco: PostgreSQL
- Infra dev: Docker + docker-compose

## Arquitetura
- `frontend/` – SPA que consome a API e, opcionalmente, o serviço de IA.
- `backend/` – camadas Domain / Application / Infrastructure + API minimal.
- `ai/` – serviço FastAPI para análise de sentimentos/keywords e assistente.
- `backups/` – dumps locais (ignorados no Git) gerados pelo serviço de backup do compose.
- `db/` – schema e scripts relacionados ao banco.

## Segurança e variáveis de ambiente
- `.gitignore` ignora `.env`, `appsettings*.json`, dumps/volumes de banco e pastas de IDE; apenas arquivos `*.example` ficam versionados.
- Templates disponíveis:
  - `frontend/.env.example` – `VITE_API_BASE_URL`, `VITE_AI_BASE_URL`
  - `backend/src/TalkClass.API/appsettings.Development.example.json`
  - `ai/.env.example`
- Use os exemplos para criar seus `.env` locais. Não commit os arquivos reais.

## Rodando localmente (modo dev/demo)
1) Copie os templates:
```bash
cp frontend/.env.example frontend/.env
# crie appsettings/local a partir do exemplo em backend/src/TalkClass.API/
# crie ai/.env a partir de ai/.env.example
```
2) Com Docker instalado, suba tudo:
```bash
docker compose -f docker-compose.dev.yml up --build
```
Serviços padrão:
- API: http://localhost:5252
- Frontend: http://localhost:5174
- IA: http://localhost:8000

### (Opcional) Rodar manualmente
- Banco: PostgreSQL 16 com string `Host=localhost;Port=5432;Database=talkclass;Username=postgres;Password=changeme`.
- API: `cd backend && dotnet run --project src/TalkClass.API`.
- Frontend: `cd frontend && npm install && npm run dev -- --host --port 5174`.

## Deploy
- O projeto está pronto para demos locais. Para produção, adapte para o provedor/infra de sua escolha (ex.: VM, contêiner orquestrado) usando as variáveis reais derivadas dos arquivos `.example`.

## Seeds e dados demo
- Seeds/dumps versionados não contêm PII; use nomes fictícios (ex.: “Infraestrutura”, “Didática”, “Curso de Sistemas”, “Turma A/B”) ao popular o ambiente.
