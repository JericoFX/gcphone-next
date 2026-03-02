import { isEnvBrowser } from './misc';
import { handleBrowserNui } from '../mock/browserMock';

export async function fetchNui<T = unknown>(
  eventName: string,
  data?: unknown,
  mockData?: T
): Promise<T> {
  if (isEnvBrowser()) {
    const mockResult = handleBrowserNui<T>(eventName, data);
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
    body: JSON.stringify(data),
  };
  
  try {
    const response = await fetch(`https://${resourceName}/${eventName}`, options);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`[gcphone] Error calling ${eventName}:`, error);
    return null as T;
  }
}
