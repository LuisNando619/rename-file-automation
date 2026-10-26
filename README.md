# rename file

Aplicação local para automatizar a leitura com OCR, revisar os dados reconhecidos e salvar documentos de trabalho com um nome padronizado.

## Requisitos

- Node.js 22.13 ou superior
- npm

## Executar

```powershell
npm install
npm start
```

Abra `http://localhost:3000` no navegador. Em desenvolvimento, use `npm run dev`.

## Usar

1. Envie uma imagem ou PDF de até 10 MB.
2. Selecione **Ler documento com OCR** e confira os campos preenchidos.
3. Corrija os dados que não foram reconhecidos e salve o documento.

Imagens aceitas: PNG, JPG, TIFF e BMP. PDFs são lidos pela primeira página. Os arquivos processados são gravados em `processed/`; arquivos enviados ficam em `uploads/`.

## Testes

```powershell
npm test
```
