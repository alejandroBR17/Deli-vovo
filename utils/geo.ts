export const normalizeCoordinate = (value: string | number): number => {
  if (!value) return 0;
  
  // Converte para string e substitui vírgula por ponto
  let strVal = String(value).replace(',', '.');
  
  // Remove caracteres inválidos (mantém números, ponto e sinal de menos)
  strVal = strVal.replace(/[^0-9.-]/g, '');
  
  let numVal = parseFloat(strVal);
  
  if (isNaN(numVal)) return 0;
  
  // Se o valor absoluto for muito grande (provavelmente faltou o ponto decimal),
  // divide por 10 até ficar dentro do range válido (-180 a 180 para longitude, -90 a 90 para latitude)
  // Assumindo que coordenadas válidas nunca excedem 180 graus.
  while (Math.abs(numVal) > 180) {
    numVal /= 10;
  }
  
  return numVal;
};
