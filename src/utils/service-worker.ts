let pending: Promise<ServiceWorkerRegistration> | undefined;

export function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return Promise.reject(new Error('Abra o aplicativo por um endereço HTTPS no navegador.'));
  if (pending) return pending;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const registration = navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(worker => worker.active ? worker : navigator.serviceWorker.ready);
  pending = Promise.race([registration, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Não foi possível iniciar os avisos. Confira a conexão e tente ativar novamente.')), 15000);
  })]).catch(error => {
    pending = undefined;
    if (error instanceof Error && error.message.startsWith('Não foi possível iniciar')) throw error;
    throw new Error('O navegador não conseguiu preparar os avisos. Confira se este endereço está acessível e tente novamente.');
  }).finally(() => clearTimeout(timer));
  return pending;
}
