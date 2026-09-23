/**
 * GOOGLE APPS SCRIPT - CENTRAL DE COMANDO VOVÓ GRAZY V8
 * Atualizações: Auto-criação de abas e prevenção de erros de CORS.
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = {
    "Produtos": ["id", "name", "description", "price", "category", "image", "oldPrice", "variations"],
    "Pedidos": ["id", "date", "customerName", "customerPhone", "total", "itemsSummary", "paymentMethod", "status", "type", "address", "userId", "archived"],
    "Usuarios": ["id", "name", "email", "password", "phone", "address", "cart"],
    "Configuracoes": ["key", "value"]
  };

  for (const [sheetName, headers] of Object.entries(sheets)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    } else {
      const firstRow = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
      if (!firstRow[0] || firstRow.length < headers.length) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }
  }
}

function doGet(e) {
  try {
    setup();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e.parameter.action;

    if (!action || action === 'getProducts') {
      const sheet = ss.getSheetByName("Produtos");
      const data = sheet.getDataRange().getValues();
      data.shift(); // Remove existing headers
      const headers = ["id", "name", "description", "price", "category", "image", "oldPrice", "variations"];
      const products = data.map(row => {
        let obj = {};
        headers.forEach((header, i) => {
          let val = row[i];
          if (header.toLowerCase() === 'price') {
             val = String(val).replace(/[R$\s]/g, '').replace(',', '.');
             val = parseFloat(val) || 0;
          }
          obj[header] = val;
        });
        return obj;
      });
      return createResponse(products);
    }

    if (action === 'getOrders') {
      const sheet = ss.getSheetByName("Pedidos");
      const data = sheet.getDataRange().getValues();
      data.shift();
      const orders = data.filter(row => !row[11]).map(row => {
        return {
          id: row[0],
          date: row[1],
          customer: { name: row[2], phone: row[3], address: row[9] },
          total: row[4],
          itemsSummary: row[5],
          paymentMethod: row[6],
          status: row[7],
          type: row[8]
        };
      }).reverse();
      return createResponse(orders);
    }

    if (action === 'getUserOrders') {
      const userId = e.parameter.userId;
      const sheet = ss.getSheetByName("Pedidos");
      const data = sheet.getDataRange().getValues();
      data.shift();
      const orders = data.filter(row => row[10] === userId && !row[11]).map(row => {
        return {
          id: row[0],
          date: row[1],
          customer: { name: row[2], phone: row[3], address: row[9] },
          total: row[4],
          itemsSummary: row[5],
          paymentMethod: row[6],
          status: row[7],
          type: row[8]
        };
      }).reverse();
      return createResponse(orders);
    }

    if (action === 'getOrderStatus') {
      const orderId = e.parameter.orderId;
      const sheet = ss.getSheetByName("Pedidos");
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == orderId) {
          return createResponse({ status: data[i][7], lastUpdate: data[i][1] });
        }
      }
      return createResponse({ error: "Pedido não encontrado" });
    }

    if (action === 'getConfigs') {
      const sheet = ss.getSheetByName("Configuracoes");
      const data = sheet.getDataRange().getValues();
      const configs = {};
      data.forEach(row => {
        if (row[0]) configs[row[0]] = row[1];
      });
      return createResponse(configs);
    }

    if (action === 'getUsers') {
      const sheet = ss.getSheetByName("Usuarios");
      const data = sheet.getDataRange().getValues();
      data.shift();
      const users = data.map(row => {
        return {
          id: row[0],
          name: row[1],
          email: row[2],
          phone: row[4],
          address: row[5],
          cart: row[6]
        };
      });
      return createResponse(users);
    }

    return createResponse({ error: "Ação GET inválida" });
  } catch (error) {
    return createResponse({ error: error.toString() });
  }
}

function doPost(e) {
  try {
    setup();
    const params = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = params.action;
    
    if (action === 'register' || action === 'registerUser') {
      const sheet = ss.getSheetByName("Usuarios");
      const p = params.payload;
      const data = sheet.getDataRange().getValues();
      const checkEmail = String(p.email).trim().toLowerCase();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][2]).trim().toLowerCase() === checkEmail) {
          return createResponse({ error: "Meu anjo, esse e-mail já está cadastrado! Tente fazer login." });
        }
      }
      
      const newId = "USR-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      sheet.appendRow([newId, p.name, checkEmail, p.password, p.phone || '', p.address || '', '[]']);
      
      return createResponse({ 
        success: true, 
        user: { id: newId, name: p.name, email: checkEmail, phone: p.phone, address: p.address, cart: '[]' } 
      });
    }

    if (action === 'login' || action === 'loginUser') {
      const sheet = ss.getSheetByName("Usuarios");
      const p = params.payload;
      const data = sheet.getDataRange().getValues();
      const checkEmail = String(p.email).trim().toLowerCase();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][2]).trim().toLowerCase() === checkEmail && String(data[i][3]) === String(p.password)) {
          return createResponse({ 
            success: true, 
            user: { 
              id: data[i][0], 
              name: data[i][1], 
              email: data[i][2], 
              phone: data[i][4], 
              address: data[i][5], 
              cart: data[i][6] 
            } 
          });
        }
      }
      return createResponse({ error: "E-mail ou senha incorretos, querido. Tente novamente!" });
    }

    if (action === 'updateUser') {
      const sheet = ss.getSheetByName("Usuarios");
      const p = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === p.id) {
          if (p.name) sheet.getRange(i + 1, 2).setValue(p.name);
          if (p.phone) sheet.getRange(i + 1, 5).setValue(p.phone);
          if (p.address) sheet.getRange(i + 1, 6).setValue(p.address);
          
          if (p.cart !== undefined) {
            const cartString = typeof p.cart === 'string' ? p.cart : JSON.stringify(p.cart);
            sheet.getRange(i + 1, 7).setValue(cartString);
          }
          return createResponse({ success: true });
        }
      }
      return createResponse({ error: "Usuário não encontrado." });
    }

    if (action === 'order') {
      const sheet = ss.getSheetByName("Pedidos");
      const p = params.payload;
      sheet.appendRow([
        p.id, new Date(), p.customerName, p.customerPhone, p.total, 
        p.itemsSummary, p.paymentMethod, 'pendente', p.type, p.address, p.userId || '', false
      ]);
      return createResponse({ success: true });
    }

    if (action === 'archiveOrder') {
      const sheet = ss.getSheetByName("Pedidos");
      const { id } = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          sheet.getRange(i + 1, 12).setValue(true);
          return createResponse({ success: true });
        }
      }
      return createResponse({ error: "Pedido não encontrado" });
    }

    if (action === 'updateStatus') {
      const sheet = ss.getSheetByName("Pedidos");
      const { orderId, status } = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == orderId) {
          sheet.getRange(i + 1, 8).setValue(status);
          sheet.getRange(i + 1, 2).setValue(new Date()); 
          return createResponse({ success: true });
        }
      }
      return createResponse({ error: "Pedido não encontrado" });
    }

    if (action === 'addProduct') {
      const sheet = ss.getSheetByName("Produtos");
      const p = params.payload;
      sheet.appendRow([p.id, p.name, p.description, p.price, p.category, p.image, p.oldPrice || '', p.variations || '']);
      return createResponse({ success: true });
    }

    if (action === 'updateProduct') {
      const sheet = ss.getSheetByName("Produtos");
      const p = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == p.id) {
          sheet.getRange(i + 1, 2, 1, 7).setValues([[p.name, p.description, p.price, p.category, p.image, p.oldPrice || '', p.variations || '']]);
          return createResponse({ success: true });
        }
      }
      return createResponse({ error: "Produto não encontrado" });
    }

    if (action === 'deleteProduct') {
      const sheet = ss.getSheetByName("Produtos");
      const { id } = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          sheet.deleteRow(i + 1);
          return createResponse({ success: true });
        }
      }
      return createResponse({ error: "Produto não encontrado" });
    }

    if (action === 'updateConfig') {
      const sheet = ss.getSheetByName("Configuracoes");
      const p = params.payload;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == p.key) {
          sheet.getRange(i + 1, 2).setValue(p.value);
          return createResponse({ success: true });
        }
      }
      sheet.appendRow([p.key, p.value]);
      return createResponse({ success: true });
    }

    return createResponse({ error: "Ação POST inválida: " + action });
  } catch (error) {
    return createResponse({ error: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
