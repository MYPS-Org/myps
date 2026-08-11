import { Page } from '@playwright/test';

export interface ApiCallDetails {
  url: string;
  method: string;
  requestBody: any;
  status: number;
  responseBody: any;
}

export function captureApiCalls(page: Page, urlPatterns: string[]) {
  const apiCalls: ApiCallDetails[] = [];

  page.on('requestfinished', async (request) => {
    try {
      const response = await request.response();
      if (!response) return;
      const url = request.url();
      if (!urlPatterns.some((pattern) => url.includes(pattern))) return;

      const requestBody = request.postDataJSON?.() ?? null;
      const responseBody = await response.json().catch(() => null);

      apiCalls.push({
        url,
        method: request.method(),
        requestBody,
        status: response.status(),
        responseBody,
      });
    } catch (error) {
      // ignore capture errors
    }
  });

  return apiCalls;
}
