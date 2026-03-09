# Planner Concurso

Planner Premium para Concurso Público - Uma aplicação web para organização de estudos.

## Deploy no Vercel

Este projeto está configurado para deploy no Vercel.app

### Arquivos de Configuração

- `vercel.json`: Configuração do build e rotas
- `package.json`: Metadados do projeto
- `planner.html`: Arquivo principal da aplicação

### Como fazer o deploy

1. Instale o Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Faça login no Vercel:
   ```bash
   vercel login
   ```

3. Execute o deploy:
   ```bash
   vercel --prod
   ```

### Estrutura do Projeto

```
planner-concurso/
├── planner.html          # Página principal
├── vercel.json          # Configuração do Vercel
├── package.json         # Metadados do projeto
├── generate_planner.py  # Script Python (opcional)
└── requirements.txt     # Dependências Python
```
