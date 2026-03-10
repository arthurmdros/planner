#!/bin/bash

# Script de deploy para Vercel
echo "Iniciando deploy do planner para Vercel..."

# Verificar se está logado no Vercel
if ! vercel whoami &>/dev/null; then
    echo "Você precisa fazer login no Vercel primeiro."
    echo "Execute: vercel login"
    exit 1
fi

# Fazer deploy em produção
echo "Fazendo deploy em produção..."
vercel --prod --yes

echo "Deploy concluído!"
