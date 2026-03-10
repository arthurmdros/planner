# Script de deploy para Vercel
Write-Host "Iniciando deploy do planner para Vercel..."

# Verificar se está logado no Vercel
try {
    vercel whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Você precisa fazer login no Vercel primeiro."
        Write-Host "Execute: vercel login"
        exit 1
    }
} catch {
    Write-Host "Você precisa fazer login no Vercel primeiro."
    Write-Host "Execute: vercel login"
    exit 1
}

# Fazer deploy em produção
Write-Host "Fazendo deploy em produção..."
vercel --prod --yes

Write-Host "Deploy concluído!"
