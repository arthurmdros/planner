const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'seu-secreto-super-seguro';

// Configuração de email (em desenvolvimento, usa Ethereal)
let transporter;

async function setupEmail() {
    if (process.env.NODE_ENV === 'production') {
        // Configuração para produção - usar variáveis de ambiente
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false, // true para 465, false para outras portas
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        // Configuração para desenvolvimento - conta Ethereal
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log('📧 Email de teste configurado:', testAccount.user);
    }
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configurado para Vercel
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(__dirname));

// Banco de dados SQLite
let db;

// Inicialização do banco de dados
const initDb = () => {
    if (process.env.NODE_ENV === 'production') {
        // No Vercel, usar banco em memória com persistência
        db = new sqlite3.Database(':memory:');
        
        // Criar tabelas
        db.serialize(() => {
            db.run(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE planner_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    data TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);

            db.run(`
                CREATE TABLE password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);
        });
    } else {
        // Local development
        db = new sqlite3.Database('./planner.db');
        
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS planner_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    data TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);
        });
    }
};

initDb();

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Middleware de verificação de JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Rotas de autenticação
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Registro iniciado:', req.body.email);
    
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    try {
        // Verificar se usuário já existe
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error('❌ Erro no banco de dados:', err);
                return res.status(500).json({ error: 'Erro no banco de dados' });
            }

            if (row) {
                console.log('⚠️ Email já cadastrado:', email);
                return res.status(400).json({ error: 'Email já cadastrado' });
            }

            // Criar hash da senha
            const hashedPassword = await bcrypt.hash(password, 10);

            // Inserir usuário
            db.run(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                [name, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('❌ Erro ao criar usuário:', err);
                        return res.status(500).json({ error: 'Erro ao criar usuário' });
                    }

                    console.log('✅ Usuário criado com sucesso:', email);

                    // Criar token JWT
                    const token = jwt.sign(
                        { id: this.lastID, name, email },
                        JWT_SECRET,
                        { expiresIn: '7d' }
                    );

                    res.status(201).json({
                        message: 'Usuário criado com sucesso',
                        token,
                        user: { id: this.lastID, name, email }
                    });
                }
            );
        });
    } catch (error) {
        console.error('❌ Erro no servidor:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erro no banco de dados' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Criar token JWT
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    });
});

// Esqueceu senha
app.post('/api/auth/forgot-password', async (req, res) => {
    console.log('🔑 Solicitação de recuperação de senha:', req.body.email);
    
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
    }

    try {
        // Verificar se usuário existe
        db.get('SELECT id, name FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('❌ Erro no banco de dados:', err);
                return res.status(500).json({ error: 'Erro no banco de dados' });
            }

            if (!user) {
                // Por segurança, não informamos que o email não existe
                console.log('⚠️ Email não encontrado, mas simulando envio:', email);
                return res.json({ message: 'Se o email existir, um link de recuperação foi enviado' });
            }

            // Gerar token de reset
            const crypto = require('crypto');
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hora

            // Salvar token no banco
            db.run(
                'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
                [user.id, resetToken, expiresAt.toISOString()],
                async function(err) {
                    if (err) {
                        console.error('❌ Erro ao salvar token:', err);
                        return res.status(500).json({ error: 'Erro ao gerar token de recuperação' });
                    }

                    console.log('✅ Token de recuperação gerado para:', email);

                    // Enviar email real
                    const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
                    
                    try {
                        await sendResetEmail(email, user.name, resetLink);
                        console.log('📧 Email de recuperação enviado para:', email);
                        
                        res.json({ 
                            message: 'Link de recuperação enviado para seu email',
                            // Em desenvolvimento, retornar informações de debug
                            debug: process.env.NODE_ENV !== 'production' ? {
                                link: resetLink,
                                etherealUrl: process.env.NODE_ENV !== 'production' ? 'https://ethereal.email/messages' : undefined
                            } : undefined
                        });
                    } catch (emailError) {
                        console.error('❌ Erro ao enviar email:', emailError);
                        // Fallback: mostrar link no console
                        console.log('🔗 Link de recuperação (fallback):', resetLink);
                        
                        res.json({ 
                            message: 'Link de recuperação gerado. Verifique seu email ou o console para testes.',
                            debug: process.env.NODE_ENV !== 'production' ? {
                                link: resetLink,
                                note: 'Email não enviado. Verifique o console.'
                            } : undefined
                        });
                    }
                }
            );
        });
    } catch (error) {
        console.error('❌ Erro no servidor:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Função para enviar email de recuperação
async function sendResetEmail(email, userName, resetLink) {
    const mailOptions = {
        from: process.env.EMAIL_FROM || 'Planner Premium <noreply@plannerpremium.com>',
        to: email,
        subject: 'Redefinir sua senha - Planner Premium',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📚</div>
                        <h1 style="color: #2c3e50; margin: 0;">Planner Premium</h1>
                    </div>
                    
                    <h2 style="color: #374151; margin-bottom: 20px;">Redefinir sua senha</h2>
                    
                    <p style="color: #64748b; line-height: 1.6; margin-bottom: 20px;">
                        Olá ${userName}!
                    </p>
                    
                    <p style="color: #64748b; line-height: 1.6; margin-bottom: 30px;">
                        Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 12px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px; 
                                  font-weight: 600;
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                            Redefinir Senha
                        </a>
                    </div>
                    
                    <p style="color: #64748b; line-height: 1.6; margin-bottom: 20px;">
                        Ou copie e cole este link no seu navegador:
                    </p>
                    
                    <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; word-break: break-all; margin-bottom: 30px;">
                        <a href="${resetLink}" style="color: #667eea; text-decoration: none;">${resetLink}</a>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin-bottom: 30px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            <strong>⚠️ Importante:</strong> Este link expira em 1 hora. Se você não solicitou, ignore este email.
                        </p>
                    </div>
                    
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                            Este é um email automático. Por favor, não responda.
                        </p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0; text-align: center;">
                            Planner Premium - Sua organização para concursos públicos
                        </p>
                    </div>
                </div>
            </div>
        `
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV !== 'production') {
        console.log('📧 URL do Ethereal para visualizar o email:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
}

// Reset de senha
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    try {
        // Verificar token válido
        db.get(
            'SELECT pr.user_id, u.email FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE pr.token = ? AND pr.used = FALSE AND pr.expires_at > ?',
            [token, new Date().toISOString()],
            async (err, reset) => {
                if (err) {
                    return res.status(500).json({ error: 'Erro no banco de dados' });
                }

                if (!reset) {
                    return res.status(400).json({ error: 'Token inválido ou expirado' });
                }

                // Hash da nova senha
                const hashedPassword = await bcrypt.hash(newPassword, 10);

                // Atualizar senha
                db.run(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashedPassword, reset.user_id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Erro ao atualizar senha' });
                        }

                        // Marcar token como usado
                        db.run(
                            'UPDATE password_resets SET used = TRUE WHERE token = ?',
                            [token]
                        );

                        console.log('✅ Senha redefinida com sucesso para:', reset.email);

                        res.json({ message: 'Senha redefinida com sucesso' });
                    }
                );
            }
        );
    } catch (error) {
        console.error('❌ Erro no servidor:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rotas do planner
app.get('/api/planner/data', authenticateToken, (req, res) => {
    db.get(
        'SELECT data FROM planner_data WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        [req.user.id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao buscar dados' });
            }

            if (row) {
                res.json({ data: JSON.parse(row.data) });
            } else {
                res.json({ data: {} });
            }
        }
    );
});

app.post('/api/planner/data', authenticateToken, (req, res) => {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Inserir ou atualizar dados do planner
    db.run(
        `INSERT INTO planner_data (user_id, data) 
         VALUES (?, ?) 
         ON CONFLICT(user_id) DO UPDATE SET 
         data = excluded.data, 
         updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, JSON.stringify(data)],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao salvar dados' });
            }

            res.json({ message: 'Dados salvos com sucesso' });
        }
    );
});

app.delete('/api/planner/data', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM planner_data WHERE user_id = ?',
        [req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao limpar dados' });
            }

            res.json({ message: 'Dados limpos com sucesso' });
        }
    );
});

// Rota principal - servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicializar servidor
async function startServer() {
    await setupEmail();
    
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
        console.log(`Auth: http://localhost:${PORT}/auth.html`);
    });
}

startServer();

module.exports = app;
