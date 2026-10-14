export type CepAddress = { street: string; neighborhood: string; city: string; state: string };
const cache = new Map<string, { value: CepAddress; expires: number }>();
export async function lookupCep(raw: string, signal?: AbortSignal): Promise<CepAddress> {
  const cep = raw.replace(/\D/g, '');
  if (cep.length !== 8) throw new Error('Digite os 8 números do CEP.');
  if (signal?.aborted) throw new DOMException('Busca cancelada', 'AbortError');
  const hit = cache.get(cep);
  if (hit && hit.expires > Date.now()) return hit.value;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  let hedge: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;
  const provider = async (url: string, viaCep: boolean) => {
    const response = await fetch(url, {signal:controller.signal});
    if (!response.ok) throw new Error('Serviço indisponível');
    const data = await response.json();
    if (data.erro) throw new Error('CEP não encontrado');
    const city = viaCep ? data.localidade : data.city;
    const state = viaCep ? data.uf : data.state;
    if (typeof city !== 'string' || !city || typeof state !== 'string' || !/^[A-Z]{2}$/.test(state)) throw new Error('Resposta de CEP incompleta');
    return {street:String((viaCep ? data.logradouro : data.street) || ''),neighborhood:String((viaCep ? data.bairro : data.neighborhood) || ''),city,state};
  };
  try {
    const fallback = new Promise<CepAddress>((resolve,reject) => {
      hedge = setTimeout(() => { provider(`https://viacep.com.br/ws/${cep}/json/`,true).then(resolve,reject); },600);
    });
    const timeout = new Promise<never>((_,reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error('A busca de CEP demorou. Preencha o endereço manualmente ou tente novamente.')); },4500);
    });
    const canceled = new Promise<never>((_,reject) => { controller.signal.addEventListener('abort',()=>reject(new DOMException('Busca cancelada','AbortError')),{once:true}); });
    const value = await Promise.race([Promise.any([provider(`https://brasilapi.com.br/api/cep/v1/${cep}`,false),fallback]),timeout,canceled]);
    if (signal?.aborted) throw new DOMException('Busca cancelada','AbortError');
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(cep,{value,expires:Date.now()+30*60000});
    return value;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Busca cancelada','AbortError');
    throw new Error('Não foi possível buscar o CEP agora. Preencha o endereço manualmente ou tente novamente.');
  } finally {
    clearTimeout(hedge!); clearTimeout(deadline!);
    signal?.removeEventListener('abort',abort); controller.abort();
  }
}
export const formatCep = (value: string) => value.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');
