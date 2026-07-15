Você é um Staff Software Engineer especialista em:

- Model Context Protocol (MCP)
- Node.js
- TypeScript
- Bitbucket Cloud API v2
- OAuth 2.0
- Cursor
- Claude Desktop
- AI Agents
- Clean Architecture
- DDD
- Observabilidade
- Segurança

Objetivo:

Criar um servidor MCP completo para Bitbucket Cloud chamado:

bitbucket-mcp-server

O projeto deve ser pronto para produção e suportar milhares de requisições diárias.

========================================================
TECNOLOGIAS
========================================================

- Node.js 22+
- TypeScript
- MCP SDK oficial
- Fastify
- Zod
- Axios
- Pino
- OpenTelemetry
- Vitest
- ESLint
- Prettier

========================================================
AUTENTICAÇÃO
========================================================

Implementar duas estratégias.

PRINCIPAL:

OAuth 2.0 Bitbucket Cloud

Authorization Code Flow

Suportar:

- login
- refresh token
- token rotation
- logout
- reautenticação

Variáveis:

BITBUCKET_CLIENT_ID
BITBUCKET_CLIENT_SECRET

Criar:

OAuthService
TokenStore
AuthMiddleware

========================================================
SECUNDÁRIA
========================================================

Bearer Token

Variáveis:

BITBUCKET_ACCESS_TOKEN

Criar:

TokenAuthProvider

========================================================
ABSTRAÇÃO
========================================================

interface AuthProvider {

  getAccessToken(): Promise<string>;

}

Implementações:

OAuthProvider
TokenProvider

========================================================
ARQUITETURA
========================================================

src

├── application
├── domain
├── infrastructure
├── mcp
├── tools
├── services
├── repositories
├── auth
├── clients
├── telemetry
├── cache
├── shared
└── tests

========================================================
CLIENTE BITBUCKET
========================================================

Criar:

BitbucketClient

Responsável por:

- autenticação
- paginação automática
- retry
- rate limiting
- cache
- tratamento de erros

Implementar wrapper completo da API v2.

========================================================
TOOLS MCP
========================================================

PULL REQUESTS

list_pull_requests

get_pull_request

create_pull_request

approve_pull_request

unapprove_pull_request

decline_pull_request

merge_pull_request

get_pull_request_diff

get_pull_request_files

get_pull_request_comments

comment_pull_request

comment_pull_request_inline

========================================================
REPOSITÓRIOS
========================================================

list_repositories

get_repository

search_repositories

========================================================
COMMITS
========================================================

list_commits

get_commit

get_commit_diff

comment_commit

========================================================
BRANCHES
========================================================

list_branches

create_branch

delete_branch

get_branch

========================================================
TAGS
========================================================

list_tags

create_tag

delete_tag

========================================================
PIPELINES
========================================================

list_pipelines

get_pipeline

run_pipeline

stop_pipeline

rerun_pipeline

get_pipeline_steps

get_pipeline_logs

IMPORTANTE:

Logs devem retornar texto completo.

Suportar pipelines muito grandes.

Implementar paginação de logs.

========================================================
ISSUES
========================================================

list_issues

get_issue

create_issue

update_issue

close_issue

comment_issue

========================================================
WORKSPACES
========================================================

list_workspaces

get_workspace

========================================================
USUÁRIOS
========================================================

get_current_user

list_workspace_members

========================================================
BUSCA
========================================================

search_pull_requests

search_commits

search_issues

search_code

========================================================
FERRAMENTAS PARA IA
========================================================

analyze_pull_request

Fluxo:

1 Buscar PR
2 Buscar diff
3 Buscar arquivos
4 Buscar comentários
5 Buscar commits

Retornar:

- resumo executivo
- impacto arquitetural
- riscos
- possíveis bugs
- performance
- segurança
- observabilidade
- breaking changes

========================================================
AUTO REVIEW
========================================================

auto_review_pull_request

Modo:

dry_run

publish_comments

Fluxo:

- analisar PR
- gerar review
- publicar comentários inline

========================================================
DOTNET REVIEW
========================================================

Criar ferramenta especializada:

analyze_dotnet_pull_request

Detectar:

- N+1 queries
- problemas Redis
- problemas MySQL
- problemas Mongo
- problemas SQS
- problemas Kafka
- problemas de concorrência
- memory leaks
- async await incorreto
- DI incorreta
- code smells
- problemas de observabilidade
- problemas OpenTelemetry
- problemas de performance

========================================================
CACHE
========================================================

Implementar cache TTL para:

- usuários
- repositórios
- workspaces
- branches

========================================================
RATE LIMIT
========================================================

Implementar:

- backoff exponencial
- retry automático
- controle de quota

========================================================
OBSERVABILIDADE
========================================================

OpenTelemetry

Métricas:

- requests
- erros
- latência
- chamadas Bitbucket

========================================================
SEGURANÇA
========================================================

Nunca registrar:

- tokens
- refresh tokens
- authorization headers
- secrets

Mascarar automaticamente.

========================================================
TESTES
========================================================

Vitest

Mocks da API Bitbucket

Cobertura mínima:

90%

========================================================
DOCUMENTAÇÃO
========================================================

Gerar:

README

Instalação

Cursor

Claude Desktop

MCP Inspector

Docker

Docker Compose

Kubernetes

========================================================
ENTREGÁVEIS
========================================================

1 Projeto completo

2 Estrutura final

3 Código de todas as tools MCP

4 Dockerfile

5 docker-compose.yml

6 Helm Chart

7 Exemplos de configuração Cursor

8 Exemplos OAuth

9 Exemplos Token

10 Guia de deploy em produção