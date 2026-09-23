const GAS_API_URL = import.meta.env.VITE_API_URL || '/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(userId?: string, role: 'admin' | 'customer' = 'customer') {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Pega a chave pública do servidor
    const response = await fetch(`${GAS_API_URL}/push/public-key`);
    const { publicKey } = await response.json();
    
    const convertedVapidKey = urlBase64ToUint8Array(publicKey);

    // Inscreve o usuário
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Envia a subscription para o servidor
    await fetch(`${GAS_API_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userId,
        role
      }),
    });

    console.log('Push subscription successful');
    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}
