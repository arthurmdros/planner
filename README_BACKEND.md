# Planner Premium - Sistema com Backend

## 🚀 Novidades

Agora o Planner Premium possui sistema completo de backend com:

- ✅ **Autenticação de usuários** (Login/Cadastro)
- ✅ **Banco de dados SQLite** para persistência
- ✅ **Sincronização automática** entre dispositivos
- ✅ **Dados salvos na nuvem** por usuário
- ✅ **Suporte offline** com sincronização quando voltar online

## 🏗️ Arquitetura

### Backend (Node.js + Express)
- `server.js` - Servidor principal com API REST
- `planner.db` - Banco de dados SQLite (criado automaticamente)
- Endpoints de autenticação JWT
- Endpoints CRUD para dados do planner

### Frontend (HTML/CSS/JS)
- `index.html` - Planner principal com sistema de autenticação
- `auth.html` - Página de login/cadastro
- Sistema de sincronização automática
- Interface de usuário com informações do perfil

## 📡 API Endpoints

### Autenticação
- `POST /api/auth/register` - Criar nova conta
- `POST /api/auth/login` - Fazer login

### Planner Data
- `GET /api/planner/data` - Buscar dados do usuário
- `POST /api/planner/data` - Salvar dados do usuário
- `DELETE /api/planner/data` - Limpar dados do usuário

## 🔧 Configuração

### Variáveis de Ambiente
- `JWT_SECRET` - Segredo para tokens JWT
- `PORT` - Porta do servidor (default: 3000)

### Estrutura do Banco
```sql
-- Usuários
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dados do Planner
CREATE TABLE planner_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## 🌐 Deploy no Vercel

### Pré-requisitos
- Conta no Vercel
- CLI do Vercel instalado

### Passos
1. **Fazer deploy**
   ```bash
   vercel --prod --yes
   ```

2. **Configurar variáveis de ambiente**
   - No dashboard Vercel, adicionar `JWT_SECRET`

3. **Rotas configuradas**
   - `/` → `index.html` (planner)
   - `/auth` → `auth.html` (login/cadastro)
   - `/api/*` → `server.js` (API)

## 💾 Fluxo de Dados

1. **Login**: Usuário faz login em `/auth`
2. **Token**: JWT armazenado no localStorage
3. **Sincronização**: Dados sincronizados a cada 30s
4. **Offline**: Dados salvos localmente, sincronizados quando online
5. **Logout**: Token removido, redirecionado para login

## 🔄 Sistema de Sincronização

### Auto-sync
- A cada 30 segundos (se online)
- Após qualquer alteração (se online)
- Ao voltar da conexão offline

### Indicadores Visuais
- 🟡 Sincronizando...
- 🟢 Dados sincronizados
- 🔴 Erro na sincronização

## 🛡️ Segurança

- **Senhas criptografadas** com bcrypt
- **Tokens JWT** com expiração de 7 dias
- **CORS** configurado para produção
- **Helmet** para headers de segurança

## 🚀 Desenvolvimento Local

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Iniciar servidor**
   ```bash
   npm start
   # ou desenvolvimento com hot reload
   npm run dev
   ```

3. **Acessar**
   - Planner: http://localhost:3000
   - Login: http://localhost:3000/auth
   - API: http://localhost:3000/api

## 📱 Funcionalidades

### Para o Usuário
- ✅ Criar conta com email e senha
- ✅ Fazer login seguro
- ✅ Ver informações do perfil
- ✅ Sair da conta
- ✅ Dados salvos automaticamente
- ✅ Acesso offline com sincronização

### Para o Desenvolvedor
- ✅ API RESTful completa
- ✅ Banco de dados automático
- ✅ Sistema de logs
- ✅ Tratamento de erros
- ✅ Deploy automatizado

## 🔮 Próximos Passos

- [ ] Recuperação de senha por email
- [ ] Autenticação social (Google, Facebook)
- [ ] Exportação de dados em PDF
- [ ] Dashboard administrativo
- [ ] Backup automático dos dados
- [ ] Notificações por email

## 🐛 Troubleshooting

### Problemas Comuns

**"Token inválido"**
- Faça login novamente
- Limpe localStorage e recarregue

**"Erro de conexão"**
- Verifique conexão com internet
- Tente novamente em alguns segundos

**"Dados não sincronizam"**
- Verifique status online/offline
- Force refresh da página (F5)

### Logs do Sistema
O sistema exibe logs no console do navegador para debugging:
- 🚀 Inicialização dos sistemas
- 📊 Status da sincronização
- 🔐 Autenticação
- ❌ Erros de conexão
