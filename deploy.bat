@echo off
echo Iniciando deploy do Planner Concurso no Vercel...
echo.

echo Verificando se o Vercel CLI esta instalado...
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Vercel CLI nao encontrado. Instalando...
    npm install -g vercel
    if %errorlevel% neq 0 (
        echo Erro ao instalar Vercel CLI. Por favor, instale manualmente:
        echo npm install -g vercel
        pause
        exit /b 1
    )
)

echo.
echo Fazendo login no Vercel (se necessario)...
vercel login

echo.
echo Iniciando deploy em producao...
vercel --prod

echo.
echo Deploy concluido! Sua aplicacao esta disponivel em:
echo https://planner-concurso.vercel.app
echo.
pause
