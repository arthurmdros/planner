// Test script for Planner API
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
    console.log('🧪 Testando API do Planner...\n');
    
    try {
        // 1. Teste de registro
        console.log('1️⃣ Testando registro de usuário...');
        const registerResponse = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Usuário Teste',
                email: 'teste@exemplo.com',
                password: '123456'
            })
        });
        
        const registerData = await registerResponse.json();
        console.log('Status:', registerResponse.status);
        console.log('Resposta:', registerData);
        
        if (registerResponse.ok) {
            const token = registerData.token;
            console.log('✅ Usuário criado com sucesso!\n');
            
            // 2. Teste de login
            console.log('2️⃣ Testando login...');
            const loginResponse = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'teste@exemplo.com',
                    password: '123456'
                })
            });
            
            const loginData = await loginResponse.json();
            console.log('Status:', loginResponse.status);
            console.log('Resposta:', loginData);
            console.log('✅ Login realizado com sucesso!\n');
            
            // 3. Teste de salvar dados do planner
            console.log('3️⃣ Testando salvamento de dados...');
            const saveResponse = await fetch(`${API_BASE}/planner/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    data: {
                        'semana1': {
                            'segunda': 'Estudar Matemática',
                            'terca': 'Estudar Português',
                            'quarta': 'Revisar Geral'
                        },
                        'progresso': {
                            'matematica': 75,
                            'portugues': 60,
                            'historia': 45
                        }
                    }
                })
            });
            
            const saveData = await saveResponse.json();
            console.log('Status:', saveResponse.status);
            console.log('Resposta:', saveData);
            console.log('✅ Dados salvos com sucesso!\n');
            
            // 4. Teste de buscar dados
            console.log('4️⃣ Testando busca de dados...');
            const getResponse = await fetch(`${API_BASE}/planner/data`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const getData = await getResponse.json();
            console.log('Status:', getResponse.status);
            console.log('Resposta:', JSON.stringify(getData, null, 2));
            console.log('✅ Dados recuperados com sucesso!\n');
            
            // 5. Teste de limpar dados
            console.log('5️⃣ Testando limpeza de dados...');
            const deleteResponse = await fetch(`${API_BASE}/planner/data`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const deleteData = await deleteResponse.json();
            console.log('Status:', deleteResponse.status);
            console.log('Resposta:', deleteData);
            console.log('✅ Dados limpos com sucesso!\n');
            
        } else {
            console.log('❌ Erro no registro:', registerData.error);
        }
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
        console.log('\n💡 Dica: Certifique-se de que o servidor está rodando em http://localhost:3000');
        console.log('   Execute: npm start');
    }
}

// Executar testes
testAPI();
