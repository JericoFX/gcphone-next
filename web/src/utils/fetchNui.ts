import { isEnvBrowser } from './misc';
import { handleBrowserNui } from '../mock/browserMock';

let nuiRequestToken = '';
let nuiRequestSeq = 0;

function buildNuiSig(token: string, seq: number, eventName: string): string {
  const input = `${token}|${seq}|${eventName}`;
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function setNuiAuthToken(token: string | undefined | null) {
  nuiRequestToken = typeof token === 'string' ? token : '';
  nuiRequestSeq = 0;
}

export async function fetchNui<T = unknown>(
  eventName: string,
  data?: unknown,
  mockData?: T
): Promise<T> {
  if (isEnvBrowser()) {
    const mockResult = await handleBrowserNui<T>(eventName, data);
    if (mockResult !== undefined) {
      return mockResult;
    }

    if (mockData !== undefined) {
      return mockData;
    }
  }
  
  const resourceName = (window as any).GetParentResourceName?.() || 'gcphone-next';
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      _gc: {
        token: nuiRequestToken,
        seq: ++nuiRequestSeq,
        sig: buildNuiSig(nuiRequestToken, nuiRequestSeq, eventName),
      },
      data,
    }),
  };
  
  try {
    const response = await fetch(`https://${resourceName}/${eventName}`, options);
    if (!response.ok) {
      if (mockData !== undefined) {
        return mockData;
      }
      return null as T;
    }

    const result = await response.json();
    if ((result === null || result === undefined) && mockData !== undefined) {
      return mockData;
    }
    return result;
  } catch (error) {
    console.error(`[gcphone] Error calling ${eventName}:`, error);
    if (mockData !== undefined) {
      return mockData;
    }
    return null as T;
  }
}
