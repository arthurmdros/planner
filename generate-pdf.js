const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function createPDF() {
    try {
        console.log('Iniciando criação do PDF...');
        
        // Lê o arquivo HTML
        const htmlPath = path.join(__dirname, 'index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        
        // Inicia o Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Define o conteúdo HTML
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });
        
        // Configura o tamanho da página para A4
        await page.setViewport({
            width: 2100, // A4 width in pixels at higher resolution
            height: 2970, // A4 height in pixels at higher resolution
            deviceScaleFactor: 10 // Higher resolution for better quality
        });
        
        // Mostra todas as páginas antes de gerar o PDF
        await page.evaluate(() => {
            // Remove a classe 'active' de todas as páginas
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // Adiciona a classe 'active' a todas as páginas para mostrar todas
            document.querySelectorAll('.page').forEach(page => {
                page.classList.add('active');
                page.style.display = 'block';
            });
            
            // Esconde o menu de navegação
            const nav = document.querySelector('.top-nav');
            if (nav) {
                nav.style.display = 'none';
            }
        });
        
        // Aguarda um pouco para o CSS ser aplicado
        await page.waitForTimeout(1000);
        
        // Gera o PDF com todas as páginas
        const pdfBuffer = await page.pdf({
            path: 'planner-premium.pdf',
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            },
            preferCSSPageSize: true
        });
        
        await browser.close();
        
        console.log('PDF criado com sucesso: planner-premium.pdf');
        console.log(`Tamanho do arquivo: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (error) {
        console.error('Erro ao criar PDF:', error);
        process.exit(1);
    }
}

// Executa a função
createPDF();
