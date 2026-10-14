export function formatWhatsApp(value: string) {
  let digits=value.replace(/\D/g,'').slice(0,13);
  const country=digits.length>11 && digits.startsWith('55');
  if(country)digits=digits.slice(2);
  const ddd=digits.slice(0,2),rest=digits.slice(2);
  const split=rest.length>8?5:4;
  return (country?'+55 ':'')+(ddd?'('+ddd+(ddd.length===2?') ':''):'')+rest.slice(0,split)+(rest.length>split?'-'+rest.slice(split):'');
}
