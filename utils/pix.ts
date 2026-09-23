export function generatePixPayload(pixKey: string, amount: number, merchantName: string, merchantCity: string): string {
  const formatLength = (val: string) => String(val.length).padStart(2, '0');
  
  const payloadFormatIndicator = "000201";
  const pointOfInitiationMethod = "010211";
  
  const merchantAccountInfo = `0014br.gov.bcb.pix01${formatLength(pixKey)}${pixKey}`;
  const merchantAccountInfoField = `26${formatLength(merchantAccountInfo)}${merchantAccountInfo}`;
  
  const merchantCategoryCode = "52040000";
  const transactionCurrency = "5303986";
  const transactionAmount = `54${formatLength(amount.toFixed(2))}${amount.toFixed(2)}`;
  const countryCode = "5802BR";
  
  const mName = merchantName.substring(0, 25).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  const merchantNameField = `59${formatLength(mName)}${mName}`;
  
  const mCity = merchantCity.substring(0, 15).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  const merchantCityField = `60${formatLength(mCity)}${mCity}`;
  
  const additionalDataFieldTemplate = "62070503***";
  
  let payload = `${payloadFormatIndicator}${pointOfInitiationMethod}${merchantAccountInfoField}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantNameField}${merchantCityField}${additionalDataFieldTemplate}6304`;
  
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 0xFFFF;
  const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');
  
  return payload + crcStr;
}
