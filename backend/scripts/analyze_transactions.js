const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');

async function analyze() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set in .env");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    // Load models
    require('../models/pg/User');
    const BEZCoinTransaction = require('../models/pg/BEZCoinTransaction');

    const transactions = await BEZCoinTransaction.find({})
      .populate('user', 'email username walletAddress firstName lastName')
      .sort({ createdAt: -1 });

    console.log(`Found ${transactions.length} transactions in total.`);

    let markdown = `# Análisis de Transacciones y Transferencias de BEZ-Coin\n\n`;
    markdown += `Total de transacciones registradas: **${transactions.length}**\n\n`;

    markdown += `## Desglose por Tipo de Transacción\n`;
    
    const summary = {};
    for(const tx of transactions) {
      if(!summary[tx.type]) summary[tx.type] = { count: 0, totalAmount: 0 };
      summary[tx.type].count += 1;
      summary[tx.type].totalAmount += tx.amount || 0;
    }

    markdown += `| Tipo | Cantidad (Nº) | Volumen Total (BEZ) |\n`;
    markdown += `| :--- | :--- | :--- |\n`;
    for(const type in summary) {
      markdown += `| ${type} | ${summary[type].count} | ${summary[type].totalAmount.toFixed(2)} |\n`;
    }
    markdown += `\n`;

    markdown += `## Detalles de Transacciones\n`;
    markdown += `| Fecha | Tipo | Estado | De/Hacia (Usuario) | Billetera | BEZ | Monto Fiat |\n`;
    markdown += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    
    for(const tx of transactions) {
      const date = tx.createdAt ? tx.createdAt.toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
      const userInfo = tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''} (${tx.user.email})` : 'Usuario Desconocido / Eliminado';
      const wallet = tx.walletAddress ? `\`${tx.walletAddress}\`` : 'N/A';
      const amount = tx.amount ? tx.amount.toFixed(2) : '0.00';
      const status = tx.status || 'N/A';
      const fiat = tx.fiatAmount ? `${tx.fiatAmount.toFixed(2)} ${tx.currency || 'EUR'}` : '-';
      
      markdown += `| ${date} | ${tx.type} | ${status} | ${userInfo.trim()} | ${wallet} | **${amount}** | ${fiat} |\n`;
    }

    const outputPath = 'C:\\Users\\yoela\\.gemini\\antigravity\\brain\\d8b3f68e-f15f-4746-bdc2-2b5570827d4a\\bez_transactions_analysis.md';
    fs.writeFileSync(outputPath, markdown);
    console.log('Report written to ' + outputPath);

  } catch (error) {
    console.error("Error analyzing transactions:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

analyze();
