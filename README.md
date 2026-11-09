# rename file

Aplicativo desktop para Windows que usa OCR para identificar dados de documentos e renomear vários arquivos em sequência.

## Baixar para Windows

Baixe o executável portátil na página de [Downloads (v1.0.0)](https://github.com/LuisNando619/rename-file-automation/releases/tag/v1.0.0) ou clique diretamente aqui:

[**Baixar Rename-File-1.0.0.exe**](https://github.com/LuisNando619/rename-file-automation/releases/download/v1.0.0/Rename-File-1.0.0.exe)

Após o download, abra o arquivo `.exe`. Não é necessário instalar o Node.js para usar o executável.

## Requisitos

- Node.js 22.13 ou superior
- npm

Os requisitos acima são necessários apenas para executar o projeto a partir do código-fonte ou gerar um novo executável.

## Executar o aplicativo desktop

```powershell
npm install
npm run desktop
```

O aplicativo abre em uma janela própria e salva os documentos renomeados em `Documentos\Rename File\processed`.

## Gerar o executável

```powershell
npm run dist
```

O executável portátil será gerado na pasta `dist/`.

## Usar

1. Selecione ou arraste vários arquivos para a janela.
2. Clique em **Processar documentos**. O OCR e a renomeação ocorrem um arquivo por vez.
3. Confira os resultados. Falhas em um documento não interrompem o restante do lote.
4. Clique em **Abrir pasta de documentos renomeados** para acessar os arquivos.

Imagens aceitas: PNG, JPG, TIFF e BMP. PDFs são lidos pela primeira página. O limite é de 10 MB por arquivo. Os arquivos que não puderem ser identificados são indicados para revisão; o OCR é especialmente ajustado para notas fiscais/DANFE.

Para executar a API no navegador durante o desenvolvimento, use `npm start` e abra `http://localhost:3000`.

## Testes

```powershell
npm test
```
