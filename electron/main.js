const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // sometimes needed for local file loading in dev
    },
    titleBarStyle: 'hidden', // Apple style frameless
    titleBarOverlay: {
      color: 'rgba(0,0,0,0)',
      symbolColor: '#333'
    },
    vibrancy: 'under-window', // macOS vibrancy
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Transparent for glass effect
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Select File
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

// IPC Handler: Process PDF
ipcMain.handle('process-pdf', async (event, filePath) => {
  try {
    const existingPdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Register fontkit
    pdfDoc.registerFontkit(fontkit);

    // Load custom font
    // We assume the font is in ../assets/fonts/KoPubWorldDotumLight.ttf from this file's location
    const fontPath = isDev 
        ? path.join(__dirname, '../assets/fonts/KoPubWorldDotumLight.ttf') 
        : path.join(process.resourcesPath, 'assets/fonts/KoPubWorldDotumLight.ttf');

    let customFont;
    try {
        const fontBytes = fs.readFileSync(fontPath);
        customFont = await pdfDoc.embedFont(fontBytes);
    } catch (fontError) {
        console.error("Font load error:", fontError);
        console.log("Falling back to standard font due to missing file in:", fontPath);
        // Fallback if font missing
        customFont = await pdfDoc.embedFont('Helvetica'); 
    }

    const pages = pdfDoc.getPages();
    const fontSize = 10;
    
    // KoPubWorld Light might need scaling adjustments, but standard size is fine. 
    // Format: - 1 -

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width } = page.getSize();
        const text = `- ${i + 1} -`;
        const textWidth = customFont.widthOfTextAtSize(text, fontSize);
        
        page.drawText(text, {
            x: (width / 2) - (textWidth / 2),
            y: 30, // Bottom margin
            size: fontSize,
            font: customFont,
            color: rgb(0, 0, 0),
        });
    }

    const pdfBytes = await pdfDoc.save();
    
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const newPath = path.join(dir, `${name}_numbered${ext}`);

    fs.writeFileSync(newPath, pdfBytes);

    // Open folder
    shell.showItemInFolder(newPath);

    return { success: true, newPath };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
});
